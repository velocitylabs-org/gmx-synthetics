# Keeper Implementation Guide

This guide explains how to build a keeper service for GMX V2 Synthetics, broken down into clear, understandable parts.

> **Reference Implementation:** [Buffer Keepers](https://github.com/Supurr-App/Buffer-Keepers) - An open-source keeper for Buffer Finance that demonstrates similar patterns.

---

## Table of Contents

1. [What Does a Keeper Do?](#1-what-does-a-keeper-do)
2. [Part 1: Watching the Blockchain](#part-1-watching-the-blockchain)
   - [ORDER vs POSITION - Important Distinction](#order-vs-position---important-distinction)
3. [Part 2: Fetching Prices](#part-2-fetching-prices)
4. [Part 3: Executing Operations](#part-3-executing-operations)
5. [Part 4: Monitoring Positions](#part-4-monitoring-positions)
6. [Part 4.5: How the Keeper Enforces Market Parameters](#part-45-how-the-keeper-enforces-market-parameters)
7. [Part 4.6: ADL Deep Dive - Keeper Creates the Orders](#part-46-adl-deep-dive---keeper-creates-the-orders)
8. [Part 4.7: Execution Failure Handling](#part-47-execution-failure-handling)
9. [Part 5: Notifications & Logging](#part-5-notifications--logging)
10. [Part 6: Health Checks & Monitoring](#part-6-health-checks--monitoring)
11. [Roles Required](#roles-required)
12. [Gas Fees & Keeper Economics](#gas-fees--keeper-economics)
13. [Role Architecture & Separation of Concerns](#role-architecture--separation-of-concerns)
14. [Execution Queue (FIFO)](#execution-queue-fifo)
15. [Retry Mechanisms & Failsafes](#retry-mechanisms--failsafes)
16. [Security Considerations](#security-considerations)
17. [Architecture: Microservices vs Monolith](#architecture-microservices-vs-monolith)

---

## 1. What Does a Keeper Do?

A keeper is an **off-chain bot** that bridges user requests with blockchain execution. Here's the simple flow:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           KEEPER'S JOB                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   USER                           KEEPER                        BLOCKCHAIN    │
│    │                               │                               │         │
│    │  1. "I want to open           │                               │         │
│    │     a SHORT on BRL"           │                               │         │
│    │──────────────────────────────>│                               │         │
│    │                               │                               │         │
│    │                               │  2. Store request             │         │
│    │                               │──────────────────────────────>│         │
│    │                               │                               │         │
│    │                               │  3. KEEPER sees request       │         │
│    │                               │<─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │         │
│    │                               │                               │         │
│    │                               │  4. Fetch BRL price           │         │
│    │                               │     from oracle               │         │
│    │                               │                               │         │
│    │                               │  5. Execute order             │         │
│    │                               │     with signed price         │         │
│    │                               │──────────────────────────────>│         │
│    │                               │                               │         │
│    │  6. Position opened!          │                               │         │
│    │<──────────────────────────────│───────────────────────────────│         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**The keeper does 6 main things:**
1. **WATCH** - Monitor blockchain for pending requests (orders, deposits, withdrawals)
2. **FETCH** - Get current prices from oracles
3. **EXECUTE** - Submit transactions to complete the requests
4. **MONITOR** - Watch open positions and close them if needed (liquidation or end date), also detect positions at risk so users can add collateral
5. **NOTIFY** - Send notifications/emails to users for important events and log all major events for auditing
6. **HEALTH** - Track keeper health, metrics, and handle failed operations via dead letter queue

---

## Part 1: Watching the Blockchain

### What to Watch

The keeper monitors the `EventEmitter` contract for two types of events:

1. **🔴 Action Required** - Keeper must fetch prices and execute
2. **🟢 Notification Only** - Just update local tracking (action already happened)

### Events Reference Table

**🔴 Events that REQUIRE keeper execution (fetch prices + call handler):**

| Event Name | What It Means | Has orderType? | Handler to Call |
|------------|---------------|----------------|-----------------|
| `DepositCreated` | User wants to **add liquidity** | ❌ No | `DepositHandler.executeDeposit()` |
| `WithdrawalCreated` | User wants to **remove liquidity** | ❌ No | `WithdrawalHandler.executeWithdrawal()` |
| `OrderCreated` | User wants to **trade** (open/close/swap) | ✅ **Yes (0-8)** | `OrderHandler.executeOrder()` |
| `OrderFrozen` | Order **failed**, needs retry | ✅ Yes | `OrderHandler.executeOrder()` (FROZEN_ORDER_KEEPER role) |
| `GlvDepositCreated` | User wants to add to **GLV vault** | ❌ No | `GlvDepositHandler.executeGlvDeposit()` |
| `GlvWithdrawalCreated` | User wants to remove from **GLV vault** | ❌ No | `GlvWithdrawalHandler.executeGlvWithdrawal()` |
| `ShiftCreated` | GLV wants to **rebalance** | ❌ No | `ShiftHandler.executeShift()` |

**🟢 Events that are NOTIFICATIONS only (just update local tracking):**

| Event Name | What It Means | What Keeper Does |
|------------|---------------|------------------|
| `OrderUpdated` | User **changed** their pending order | Update order params in local queue |
| `OrderCancelled` | User **cancelled** their order | Remove from queue |
| `DepositCancelled` | User **cancelled** their deposit | Remove from queue |
| `WithdrawalCancelled` | User **cancelled** their withdrawal | Remove from queue |
| `OrderExecuted` | Order was **successfully executed** | Log success, remove from queue |
| `DepositExecuted` | Deposit was **successfully executed** | Log success, remove from queue |
| `WithdrawalExecuted` | Withdrawal was **successfully executed** | Log success, remove from queue |

> 📖 See [Events that DON'T need a handler call](#events-that-dont-need-a-handler-call) in Part 3 for more details on why these are notification-only.

### Order Types Explained

When you see `OrderCreated`, check the `orderType` field to know what kind of order it is:

| Order Type | Number | What It Is | When Keeper Executes |
|------------|--------|------------|---------------------|
| `MarketSwap` | 0 | Swap tokens at current price | **Immediately** |
| `LimitSwap` | 1 | Swap tokens when price reaches target | When price condition met |
| `MarketIncrease` | 2 | Open/increase position at current price | **Immediately** |
| `LimitIncrease` | 3 | Open/increase position at specific price | When price ≤ trigger (long) or ≥ trigger (short) |
| `MarketDecrease` | 4 | Close/decrease position at current price | **Immediately** |
| `LimitDecrease` | 5 | Take profit order | When price ≥ trigger (long) or ≤ trigger (short) |
| `StopLossDecrease` | 6 | Stop loss order | When price ≤ trigger (long) or ≥ trigger (short) |
| `Liquidation` | 7 | Force close underwater position | When position health is bad |
| `StopIncrease` | 8 | Open position when price reaches trigger | When price condition met |

### Order Lifecycle Events

**Important:** `OrderUpdated`, `OrderCancelled`, and `OrderFrozen` use the **same orderType values (0-8)** as `OrderCreated`. These are lifecycle events for the same order:

```
ORDER LIFECYCLE
═══════════════

  OrderCreated (orderType: 3)     ← User creates a LimitIncrease order
         │
         ├──→ OrderUpdated (orderType: 3)    ← User modifies the same order
         │                                      (e.g., changes trigger price)
         │
         ├──→ OrderCancelled (orderType: 3)  ← User cancels the order
         │                                      (order never executed)
         │
         ├──→ OrderFrozen (orderType: 3)     ← Order failed during execution
         │                                      (needs retry with FROZEN_ORDER_KEEPER)
         │
         └──→ OrderExecuted (orderType: 3)   ← Order successfully executed
                                                (position opened/closed)
```

| Event | Same orderType? | What It Means |
|-------|-----------------|---------------|
| `OrderCreated` | Original | New order created with type 0-8 |
| `OrderUpdated` | ✅ Same | User modified the pending order (same type) |
| `OrderCancelled` | ✅ Same | User cancelled the order (same type) |
| `OrderFrozen` | ✅ Same | Order failed, now frozen (same type) |
| `OrderExecuted` | ✅ Same | Order completed successfully (same type) |

**Example:**
- User creates a `LimitIncrease` (type 3) order to open a long at $0.15 BRL
- User changes their mind, updates trigger to $0.14 → `OrderUpdated` with orderType 3
- User cancels entirely → `OrderCancelled` with orderType 3

The `orderType` tells you **what kind of order** it is, the **event name** tells you **what happened** to it.

### ORDER vs POSITION - Important Distinction

**These are two different things:**

```
ORDER                                    POSITION
═════                                    ════════
A REQUEST to do something                The RESULT of an executed order

• Stored temporarily                     • Stored permanently (until closed)
• Can be updated/cancelled               • Cannot be "updated"
• Waiting to be executed                 • Already exists on-chain
• Has an order key                       • Has a position key

Examples:                                Examples:
• "Open a long at $0.15"                 • "I have a long position in BRL"
• "Close my position at market"          • "My position is $10,000 size"
• "Swap 100 USDC to ETH"                 • "My unrealized PnL is +$500"
```

**The lifecycle:**

```
                    PENDING ORDER                      OPEN POSITION
                ┌─────────────────────┐            ┌─────────────────────┐
                │                     │            │                     │
  User creates  │  Order waiting to   │  Keeper    │  Position exists    │
  ───────────>  │  be executed        │  executes  │  on-chain           │
                │                     │  ────────> │                     │
                │  ✅ Can UPDATE      │            │  ❌ Cannot update   │
                │  ✅ Can CANCEL      │            │  ✅ Can MODIFY via  │
                │                     │            │     NEW orders      │
                └─────────────────────┘            └─────────────────────┘
```

**Why can you only update PENDING orders?**

- A pending order is just a **request** stored in DataStore
- The keeper hasn't executed it yet
- User can change their mind: different price, different size, etc.
- Once executed, it's **done** - the trade happened, tokens moved

**How to modify an existing POSITION:**

```
To modify a position, create NEW orders:

┌─────────────────────────────────────────────────────────────────────┐
│  EXISTING POSITION: Long BRL, $10,000 size, $1,000 collateral       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Want to ADD more size?                                             │
│  └── Create: MarketIncrease or LimitIncrease order                  │
│                                                                     │
│  Want to ADD more collateral?                                       │
│  └── Create: MarketIncrease order (with collateral, no size)        │
│                                                                     │
│  Want to CLOSE partially?                                           │
│  └── Create: MarketDecrease or LimitDecrease order                  │
│                                                                     │
│  Want to set TAKE PROFIT?                                           │
│  └── Create: LimitDecrease order (type 5) at target price           │
│                                                                     │
│  Want to set STOP LOSS?                                             │
│  └── Create: StopLossDecrease order (type 6) at stop price          │
│                                                                     │
│  Want to CLOSE entirely?                                            │
│  └── Create: MarketDecrease order for full size                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

Each of these creates a NEW OrderCreated event → Keeper executes it
```

**What happens to the original order?**

Orders are **temporary** - they get deleted after execution. Positions are **persistent**.

```
WHAT HAPPENS TO ORDERS:

1. User creates order      → Order stored in DataStore
2. Keeper executes order   → Order DELETED from DataStore
3. Result                  → Position created/modified (stored separately)

The original order is GONE after execution. It doesn't exist anymore.
```

**When modifying a position, you're creating independent orders:**

```
EXISTING STATE:
├── Position: Long BRL $10,000 (stored in DataStore under position key)
├── Original order: DOES NOT EXIST (was deleted after execution)

USER WANTS TO ADD SIZE:
├── Creates NEW order (MarketIncrease) ← completely separate order
├── Keeper executes it
├── Order gets DELETED
├── Position gets UPDATED (now $15,000 size)
```

**Timeline example:**

```
Order 1 (open position)       →  Executed & DELETED  →  Position exists ($10k)
Order 2 (add size)            →  Executed & DELETED  →  Position updated ($15k)
Order 3 (partial close)       →  Executed & DELETED  →  Position updated ($10k)
Order 4 (full close)          →  Executed & DELETED  →  Position CLOSED (gone)
```

Each order is independent. They don't "replace" each other - they just affect the same position when executed.

> **📝 NIVO NOTE:** In Nivo, users can only open SHORT or LONG positions at market price - we don't support limit orders that execute at a future price. This means **all orders execute immediately**. To modify a position (add collateral, partial close, full close), the user creates a new market order through the UI, which the keeper executes right away. There's no "pending order" state in typical Nivo usage.

**Practical example:**

```
1. User creates LimitIncrease order (open long at $0.15)
   └── OrderCreated event
   └── Order is PENDING ✅ Can update/cancel

2. User changes trigger to $0.14
   └── ExchangeRouter.updateOrder()
   └── OrderUpdated event
   └── Still PENDING ✅ Can still update/cancel

3. Price hits $0.14, keeper executes
   └── OrderHandler.executeOrder()
   └── OrderExecuted event
   └── Now it's a POSITION ❌ Cannot update this order anymore

4. User wants to add a take-profit at $0.20
   └── ExchangeRouter.createOrder(LimitDecrease at $0.20)
   └── NEW OrderCreated event (this is a different order!)
   └── This NEW order is PENDING ✅ Can update/cancel this one
```

### Simple Categorization

```
IMMEDIATE EXECUTION (execute right away):
├── MarketSwap (0)
├── MarketIncrease (2)
└── MarketDecrease (4)

PRICE-TRIGGERED (wait for price condition):
├── LimitSwap (1)
├── LimitIncrease (3)
├── LimitDecrease (5) - Take Profit
├── StopLossDecrease (6) - Stop Loss
└── StopIncrease (8)

KEEPER-INITIATED (keeper decides when):
└── Liquidation (7)
```

### How to Listen for Events

**Method 1: WebSocket (Recommended)**
- Real-time event streaming from the EventEmitter contract

**Method 2: Polling (Like Buffer Keepers)**
- Query subgraph or RPC for pending requests every ~5 seconds

### Event Data Structure

All GMX events use a generic structure:

```typescript
interface EventLog1 {
  msgSender: string;       // Who triggered the event (address)
  eventName: string;       // "OrderCreated", "DepositCreated", etc.
  eventData: {
    addressItems: Array<{ key: string; value: string }>;   // e.g., {key: "account", value: "0x..."}
    uintItems: Array<{ key: string; value: BigNumber }>;   // e.g., {key: "sizeDeltaUsd", value: 1000000...}
    bytes32Items: Array<{ key: string; value: string }>;   // e.g., {key: "key", value: "0x..."} ← Order key is here!
    boolItems: Array<{ key: string; value: boolean }>;     // e.g., {key: "isLong", value: true}
    intItems: Array<{ key: string; value: BigNumber }>;    // For signed integers
    stringItems: Array<{ key: string; value: string }>;    // For string values
    bytesItems: Array<{ key: string; value: string }>;     // For bytes values
  };
}
```

**Important fields to extract:**

| Field | Where to Find | What It Is |
|-------|---------------|------------|
| `key` | bytes32Items | Unique identifier for the order/deposit/withdrawal |
| `account` | addressItems | User's wallet address |
| `market` | addressItems | Which market (e.g., BRL/USD) |
| `orderType` | uintItems | Type of order (0-8) |
| `sizeDeltaUsd` | uintItems | Position size in USD |
| `triggerPrice` | uintItems | Price that triggers limit orders |
| `isLong` | boolItems | Long (true) or Short (false) |

---

## Part 2: Fetching Prices

### Why Prices Are Needed

When executing orders, the keeper must provide **signed price data** so the contract knows the current market price. This prevents manipulation.

### How Price Signing Works

**Important:** The keeper does NOT sign prices. Prices come **pre-signed** from the oracle provider.

```
PRICE FLOW
══════════

       ◄─────────── OFF-CHAIN ───────────►  │  ◄──── ON-CHAIN ────►
                                            │
  Oracle Provider                 Keeper    │        GMX Contract
  (Chainlink/Pyth)                   │      │             │
        │                            │      │             │
        │  1. Oracle signs prices    │      │             │
        │     with their private key │      │             │
        │                            │      │             │
        │  2. Keeper fetches         │      │             │
        │     pre-signed prices      │      │             │
        │     (HTTP API call)        │      │             │
        │───────────────────────────>│      │             │
        │                            │      │             │
        │     Returns:               │      │             │
        │     - price: $0.16         │      │             │
        │     - timestamp: 1234567890│      │             │
        │     - signature: 0xabc...  │      │             │
        │       (signed by oracle)   │  3. Keeper submits │
        │                            │     transaction    │
        │                            │─────────────────────────────>│
        │                            │      │             │
        │                            │      │             │  4. Contract verifies
        │                            │      │             │     signature is from
        │                            │      │             │     authorized oracle
        │                            │      │             │
        │                            │      │             │  5. If valid, execute
        │                            │      │             │     order with price
```

**Who signs what:**

| Component | Signs Prices? | Role |
|-----------|---------------|------|
| Chainlink/Pyth Oracle | ✅ **Yes** | Signs prices with their trusted keys |
| Keeper | ❌ **No** | Just fetches and forwards pre-signed prices |
| GMX Contract | ❌ **No** | Verifies oracle signature is authorized |

### Price Sources

| Source | Pre-signed? | Best For |
|--------|-------------|----------|
| **Chainlink Data Streams** | ✅ Yes (by Chainlink) | Primary source for GMX production |
| **Pyth Network** | ✅ Yes (by Pyth) | Alternative, good for forex |
| **Custom Oracle** | ✅ Yes (by you) | If building your own oracle service |

**For Forex (BRL, COP, ARS) Options:**
1. Chainlink forex feeds (if available for your pairs)
2. Pyth forex feeds (has many forex pairs)
3. Custom oracle - you run an oracle service that:
   - Fetches prices from forex data providers
   - Signs them with your oracle private key
   - Registers your oracle address in GMX's `OracleStore`

### Price Format

GMX uses **30 decimal precision** for all prices:

```
Formula: StoredPrice = ActualPrice × 10^(30 - tokenDecimals)

Examples:
┌────────────┬──────────────┬──────────┬─────────────────────────┐
│ Asset      │ Actual Price │ Decimals │ Stored Price            │
├────────────┼──────────────┼──────────┼─────────────────────────┤
│ ETH        │ $5,000       │ 18       │ 5000 × 10^12            │
│ BTC        │ $60,000      │ 8        │ 60000 × 10^22           │
│ USDC       │ $1.00        │ 6        │ 1 × 10^24               │
│ BRL        │ $0.16        │ 8        │ 0.16 × 10^22 = 1.6×10^21│
└────────────┴──────────────┴──────────┴─────────────────────────┘
```

### Min/Max Prices (Bid/Ask Spread)

Oracles provide TWO prices instead of one. Think of it like a currency exchange booth:

**Example: BRL/USD at an exchange booth**
```
┌─────────────────────────────────────────────────────────────┐
│                    EXCHANGE BOOTH                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   "We BUY your BRL at $0.159"  ← minPrice (lower)           │
│   "We SELL you BRL at $0.161"  ← maxPrice (higher)          │
│                                                              │
│   The $0.002 difference is the spread (booth's profit)       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Why two prices?**
- Protects the protocol from price manipulation
- The "worse" price is always used for the user (like a real exchange)

**Simple rule:**
```
YOU (the trader) always get the WORSE price:

  LONG position (betting BRL goes UP):
  ├── Opening: You BUY at maxPrice ($0.161) - you pay more
  └── Closing: You SELL at minPrice ($0.159) - you receive less

  SHORT position (betting BRL goes DOWN):
  ├── Opening: You SELL at minPrice ($0.159) - you receive less
  └── Closing: You BUY at maxPrice ($0.161) - you pay more
```

**In practice:** The spread is usually very small (0.01-0.1%), so the difference is minimal, but it prevents manipulation attacks.

**Do I need to choose which price to send?**

**NO!** You send BOTH prices, GMX picks the right one automatically:

```typescript
// What you get from oracle (Pyth/Chainlink):
const signedPriceData = {
  minPrice: 0.159,   // Both prices included
  maxPrice: 0.161,   // in the signed data
  signature: "0x..."
};

// What you send to GMX:
oracleParams.data = [signedPriceData];  // Send the whole thing

// GMX internally decides:
// - Is this a LONG or SHORT?
// - Is this OPENING or CLOSING?
// - Based on that, use minPrice or maxPrice
```

**The keeper's job is simple:** Fetch signed prices → Pass them to GMX → Done.

GMX handles all the logic of which price to use.

### Passing Prices When Executing Orders

**Example: Execute a COP/USD order with Pyth prices**

```typescript
// 1. You have a pending order for COP/USD market
const orderKey = "0xabc123...";  // From OrderCreated event

// 2. The order needs prices for these tokens:
const tokensNeeded = [
  "0x111...",  // COP token address (index token)
  "0x222..."   // USDC token address (collateral)
];

// 3. Fetch signed prices from Pyth (off-chain HTTP call)
const pythPrices = await fetchFromPyth(["COP/USD", "USDC/USD"]);
// Returns: { price, signature, timestamp } for each

// 4. Build oracle params - tell GMX which prices you're providing
const oracleParams = {
  tokens: tokensNeeded,                           // Which tokens
  providers: [PYTH_PROVIDER, PYTH_PROVIDER],      // Which oracle for each
  data: [pythPrices.COP.signedData, pythPrices.USDC.signedData]  // Signed price data
};

// 5. Execute the order with prices
await orderHandler.executeOrder(orderKey, oracleParams);
```

**What GMX does with the prices:**
1. Checks each `provider` is authorized in `OracleStore`
2. Verifies the `signature` in `data` matches the provider
3. Extracts `minPrice` and `maxPrice` from the signed data
4. Uses prices to calculate PnL, fees, and execute the order

**The `oracleParams` structure:**

| Field | What It Contains |
|-------|------------------|
| `tokens` | Array of token addresses that need prices |
| `providers` | Array of oracle provider addresses (Chainlink, Pyth, etc.) |
| `data` | Array of signed price data blobs from each provider |

---

## Part 3: Executing Operations

### Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXECUTION FLOW                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. GET REQUEST DETAILS                                         │
│      │                                                           │
│      └──> Read order/deposit/withdrawal from DataStore           │
│                                                                  │
│   2. DETERMINE REQUIRED TOKENS                                   │
│      │                                                           │
│      ├──> For Order: index token + collateral token              │
│      ├──> For Deposit: long token + short token                  │
│      └──> For Withdrawal: long token + short token               │
│                                                                  │
│   3. FETCH PRICES                                                │
│      │                                                           │
│      └──> Get signed prices from oracle for all tokens           │
│                                                                  │
│   4. SIMULATE (Optional but recommended)                         │
│      │                                                           │
│      └──> Call simulate function to check if execution will work │
│                                                                  │
│   5. EXECUTE                                                     │
│      │                                                           │
│      └──> Submit transaction to handler contract                 │
│                                                                  │
│   6. CONFIRM                                                     │
│      │                                                           │
│      └──> Wait for transaction receipt, log result               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Handler Contracts Reference

**Complete list of all handlers:**

| Operation | Handler Contract | Function to Call | Triggered By |
|-----------|------------------|------------------|--------------|
| Execute Deposit | `DepositHandler` | `executeDeposit(key, oracleParams)` | `DepositCreated` event |
| Execute Withdrawal | `WithdrawalHandler` | `executeWithdrawal(key, oracleParams)` | `WithdrawalCreated` event |
| Execute Order | `OrderHandler` | `executeOrder(key, oracleParams)` | `OrderCreated` event (all types 0-8) |
| Execute Frozen Order | `OrderHandler` | `executeOrder(key, oracleParams)` | `OrderFrozen` event (needs FROZEN_ORDER_KEEPER role) |
| Execute Liquidation | `LiquidationHandler` | `executeLiquidation(account, market, collateralToken, isLong, oracleParams)` | Keeper monitors positions |
| Execute ADL | `AdlHandler` | `executeAdl(account, market, collateralToken, isLong, sizeDeltaUsd, oracleParams)` | Keeper monitors PnL factors |
| Update ADL State | `AdlHandler` | `updateAdlState(market, isLong, oracleParams)` | Before executing ADL |
| Execute GLV Deposit | `GlvDepositHandler` | `executeGlvDeposit(key, oracleParams)` | `GlvDepositCreated` event |
| Execute GLV Withdrawal | `GlvWithdrawalHandler` | `executeGlvWithdrawal(key, oracleParams)` | `GlvWithdrawalCreated` event |
| Execute Shift | `ShiftHandler` | `executeShift(key, oracleParams)` | `ShiftCreated` event |

### Example: Executing a BRL SHORT Position

Here's a complete TypeScript example of a keeper executing a SHORT order on BRL/USD:

```typescript
import { ethers } from "ethers";

// Contract addresses (from your deployment)
const ORDER_HANDLER_ADDRESS = "0x...";  // OrderHandler contract
const PYTH_PROVIDER_ADDRESS = "0x...";  // Pyth oracle provider
const BRL_TOKEN_ADDRESS = "0x...";      // BRL token (index token)
const USDC_TOKEN_ADDRESS = "0x...";     // USDC token (collateral)

// 1. Keeper receives OrderCreated event with this data:
const orderKey = "0xabc123...";  // Unique order identifier from event
const orderType = 2;             // MarketIncrease (open position at market price)
const isLong = false;            // SHORT position

// 2. Fetch signed prices from Pyth (off-chain API call)
const brlPriceData = await fetchPythPrice("BRL/USD");
// Returns something like:
// {
//   minPrice: "159000000000000000000",  // $0.159 in 30 decimals
//   maxPrice: "161000000000000000000",  // $0.161 in 30 decimals
//   signature: "0x...",
//   timestamp: 1704067200
// }

const usdcPriceData = await fetchPythPrice("USDC/USD");
// Returns:
// {
//   minPrice: "1000000000000000000000000",  // $1.00 in 30 decimals
//   maxPrice: "1000000000000000000000000",
//   signature: "0x...",
//   timestamp: 1704067200
// }

// 3. Build oracleParams - this is what GMX needs
const oracleParams = {
  tokens: [
    BRL_TOKEN_ADDRESS,   // Index token (what we're shorting)
    USDC_TOKEN_ADDRESS   // Collateral token
  ],
  providers: [
    PYTH_PROVIDER_ADDRESS,  // Oracle for BRL
    PYTH_PROVIDER_ADDRESS   // Oracle for USDC
  ],
  data: [
    brlPriceData.signedBlob,   // Signed price data for BRL
    usdcPriceData.signedBlob   // Signed price data for USDC
  ]
};

// 4. Execute the order
const orderHandler = new ethers.Contract(
  ORDER_HANDLER_ADDRESS,
  ["function executeOrder(bytes32 key, tuple(address[] tokens, address[] providers, bytes[] data) oracleParams)"],
  keeperWallet
);

const tx = await orderHandler.executeOrder(orderKey, oracleParams, {
  gasLimit: 3_900_000  // Standard gas limit for order execution
});

const receipt = await tx.wait();
console.log(`SHORT BRL executed! Tx: ${receipt.transactionHash}`);

// 5. Result: User now has a SHORT position on BRL/USD
//    - If BRL price drops (devaluation), user profits
//    - If BRL price rises, user loses
```

**What happens inside GMX when this executes:**

```
1. GMX receives oracleParams with BRL and USDC prices
2. Verifies Pyth signatures are valid
3. Since it's a SHORT opening, uses minPrice ($0.159) for BRL
4. Calculates position size, fees, collateral requirements
5. Creates/updates the position in DataStore
6. Emits OrderExecuted event
7. Deletes the order from DataStore
```

### Events that DON'T need a handler call

These events are just **notifications** - the action already happened. The keeper just updates its local tracking.

| Event | Why No Handler Needed | Who Did The Action |
|-------|----------------------|-------------------|
| `OrderUpdated` | User already updated the order | **User** called `ExchangeRouter.updateOrder()` |
| `OrderCancelled` | User already cancelled the order | **User** called `ExchangeRouter.cancelOrder()` |
| `DepositCancelled` | User already cancelled the deposit | **User** called `ExchangeRouter.cancelDeposit()` |
| `WithdrawalCancelled` | User already cancelled the withdrawal | **User** called `ExchangeRouter.cancelWithdrawal()` |
| `OrderExecuted` | Order already executed | **Keeper** already called handler |
| `DepositExecuted` | Deposit already executed | **Keeper** already called handler |
| `WithdrawalExecuted` | Withdrawal already executed | **Keeper** already called handler |

**Understanding the split:**

```
WHO DOES WHAT IN GMX:
═════════════════════

  USER (via ExchangeRouter)          KEEPER (via Handlers)
  ─────────────────────────          ─────────────────────
  • createOrder()                    • executeOrder()
  • updateOrder()                    • executeLiquidation()
  • cancelOrder()                    • executeDeposit()
  • createDeposit()                  • executeWithdrawal()
  • cancelDeposit()                  • executeAdl()
  • createWithdrawal()               • etc.
  • cancelWithdrawal()

  User CREATES/MODIFIES/CANCELS      Keeper EXECUTES
  (stored in DataStore)              (with oracle prices)

  ↑
  These user actions are executed
  through your FRONTEND (UI) that
  calls the ExchangeRouter contract
```

**Example flow:**
```
1. User calls ExchangeRouter.createOrder()     → OrderCreated event
2. User changes mind, calls updateOrder()      → OrderUpdated event (keeper just notes the change)
3. User cancels entirely, calls cancelOrder()  → OrderCancelled event (keeper removes from queue)

OR

1. User calls ExchangeRouter.createOrder()     → OrderCreated event
2. Keeper calls OrderHandler.executeOrder()    → OrderExecuted event (keeper logs success)
```

**Note:** `OrderHandler.executeOrder()` handles ALL order types (0-8):
- MarketSwap, LimitSwap
- MarketIncrease, LimitIncrease, StopIncrease
- MarketDecrease, LimitDecrease, StopLossDecrease

The `orderType` is already stored in the order - you just call `executeOrder()` and GMX routes it correctly.

### Price-Triggered Orders (Not Used in Nivo)

In GMX, there are two categories of orders:

```
IMMEDIATE EXECUTION (keeper executes right away):
├── MarketSwap (0)      - Swap tokens now
├── MarketIncrease (2)  - Open/add to position now
└── MarketDecrease (4)  - Close/reduce position now

PRICE-TRIGGERED (keeper waits for price condition):
├── LimitSwap (1)          - Swap when price reaches X
├── LimitIncrease (3)      - Open position when price reaches X
├── LimitDecrease (5)      - Take profit: close when price is favorable
├── StopLossDecrease (6)   - Stop loss: close when price is unfavorable
└── StopIncrease (8)       - Open position when price breaks out
```

**For price-triggered orders**, the keeper must continuously monitor prices and only execute when the trigger condition is met. This adds complexity because the keeper needs to:
1. Track all pending limit/stop orders
2. Continuously fetch current prices
3. Compare against each order's trigger price
4. Execute only when the condition is satisfied

> **📝 NIVO NOTE:** In Nivo, we only support **immediate execution orders**. Users open SHORT positions at market price and close them at market price. There are no limit orders, stop-loss orders, or take-profit orders that wait for a specific price.
>
> **When a Nivo user "closes early":**
> - They click "Close Position" in the UI
> - UI creates a `MarketDecrease` order (type 4)
> - Keeper executes it **immediately** at current market price
> - No price conditions to check
>
> This simplifies the keeper significantly - just execute every order as soon as you see it. No need to track trigger prices or wait for conditions.

---

## Part 4: Monitoring Positions

### Liquidations

The keeper must monitor all open positions and liquidate unhealthy ones.

**When is a position liquidatable?**

```
Position is LIQUIDATABLE when:

  remainingCollateral < minCollateralUsd
    OR
  remainingCollateral < (positionSize × minCollateralFactor)

Where:
  remainingCollateral = collateral - losses - fees
  minCollateralUsd = usually $1
  minCollateralFactor = usually 1% (0.01)
```

### Position Monitoring Process

The keeper needs to **continuously monitor all open positions** to detect when they need to be closed. This is a separate process from executing orders.

**When should a position be closed by the keeper?**

```
KEEPER MUST CLOSE POSITION WHEN:

1. LIQUIDATION - Position is unhealthy
   └── remainingCollateral < minimum required
   └── User is losing too much, must force-close to protect the pool

2. END DATE REACHED - Position has expired (Nivo-specific)
   └── position.endDate <= today
   └── Insurance contract period is over, must settle

3. ADL (Auto-Deleveraging) - Pool is over-exposed
   └── Too many profitable positions on one side
   └── Must reduce some positions to protect the pool
```

**How the monitoring process works:**

```
POSITION MONITORING LOOP
════════════════════════

┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Every 1-5 minutes (configurable):                                 │
│                                                                     │
│   1. FETCH ALL OPEN POSITIONS                                       │
│      └── Query DataStore or subgraph for all positions              │
│      └── Get: account, market, size, collateral, endDate, etc.      │
│                                                                     │
│   2. FETCH CURRENT PRICES                                           │
│      └── Get prices for all tokens involved                         │
│      └── BRL/USD, USDC/USD, etc.                                    │
│                                                                     │
│   3. CHECK EACH POSITION                                            │
│      │                                                              │
│      ├── Is endDate <= today?                                       │
│      │   └── YES → Close position (MarketDecrease)                  │
│      │                                                              │
│      ├── Is position liquidatable?                                  │
│      │   └── Calculate: collateral - losses - fees                  │
│      │   └── If remaining < minimum → Liquidate                     │
│      │                                                              │
│      └── Is ADL needed? (check pool exposure)                       │
│          └── If pool over-exposed → Execute ADL                     │
│                                                                     │
│   4. EXECUTE NECESSARY ACTIONS                                      │
│      └── Call appropriate handler with oracle prices                │
│                                                                     │
│   5. WAIT AND REPEAT                                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Where to get open positions:**

| Method | Description | Best For |
|--------|-------------|----------|
| DataStore query | Read directly from contract using `Reader.getAccountPositions()` | Accurate, real-time |
| Subgraph | Query indexed data via GraphQL | Faster for large datasets |
| Local cache | Track positions from events, update on changes | Lowest latency |

**Recommended approach for Nivo:**

```
NIVO POSITION MONITOR
═════════════════════

1. Maintain a local cache of open positions
   └── Update when you see PositionIncrease/PositionDecrease events

2. Every 1-5 minutes:
   └── Fetch current BRL price
   └── For each position:
       ├── Check endDate → if expired, close it
       └── Check health → if liquidatable, liquidate it

3. For each position that needs closing:
   └── Fetch fresh oracle prices
   └── Call LiquidationHandler.executeLiquidation() or
       Create a MarketDecrease order to close
```

> **📝 NIVO NOTE:** End date checking is Nivo-specific. Standard GMX positions don't have end dates - they stay open until the user closes them or they get liquidated. In Nivo, insurance contracts have a fixed duration, so the keeper must automatically close positions when they expire.

### Auto-Deleveraging (ADL)

ADL is a **safety mechanism** that protects the liquidity pool when too many traders are winning at once.

**The problem ADL solves:**

```
SCENARIO: BRL crashes 30% in one day
═══════════════════════════════════

Pool has: $1,000,000 USDC

Traders have SHORT positions worth:
├── Trader A: +$200,000 profit
├── Trader B: +$150,000 profit
├── Trader C: +$180,000 profit
├── Trader D: +$120,000 profit
└── ... more winners

Total profits owed: $1,200,000
Pool only has: $1,000,000

PROBLEM: Pool can't pay everyone if they all close at once!
```

**What ADL does:**

```
ADL SOLUTION
════════════

Instead of letting the pool become insolvent:

1. Keeper detects: "PnL factor too high" (profits > safe threshold)

2. Keeper identifies most profitable positions (sorted by profit %)

3. Keeper FORCIBLY REDUCES these positions:
   ├── Trader A: Position reduced from $500k to $300k
   ├── Trader B: Position reduced from $400k to $250k
   └── They still keep their profit, just with smaller size

4. This reduces the pool's liability to a safe level

Result: Pool stays solvent, traders keep (reduced) profits
```

**How ADL works step by step:**

```
1. DETECT
   └── Keeper monitors: totalProfits / poolValue = PnL factor
   └── If PnL factor > threshold (e.g., 0.8) → ADL needed

2. UPDATE STATE
   └── Keeper calls: AdlHandler.updateAdlState(market, isLong, oracleParams)
   └── This enables ADL for that side of the market

3. SELECT POSITIONS
   └── Get positions sorted by profit percentage (most profitable first)
   └── These are the ones that will be reduced

4. EXECUTE ADL
   └── Keeper calls: AdlHandler.executeAdl(account, market, collateralToken, isLong, sizeDeltaUsd, oracleParams)
   └── Position is partially closed at current market price
   └── Trader receives their profit for the closed portion

5. REPEAT
   └── Keep reducing positions until PnL factor is safe again
```

**ADL vs Liquidation - what's the difference?**

| Aspect | Liquidation | ADL |
|--------|-------------|-----|
| Who gets affected | **Losing** positions | **Winning** positions |
| Why it happens | Position is unhealthy (losses > collateral) | Pool is over-exposed (too many winners) |
| Trader's fault? | Yes (took too much risk) | No (just unlucky timing) |
| Trader loses money? | Yes (collateral lost) | No (keeps profits, just smaller position) |
| How common? | Regular occurrence | Rare, extreme markets only |

**For Nivo:**

```
NIVO ADL SCENARIO
═════════════════

BRL crashes significantly (currency crisis):
├── All SHORT holders are winning big
├── Pool might not have enough to pay everyone
└── ADL kicks in to reduce the largest winners

This protects:
├── The pool (stays solvent)
├── Liquidity providers (don't lose everything)
└── Other traders (can still close their positions)
```

> **📝 NIVO NOTE:** ADL is rare but important. It typically only triggers during extreme market events (currency crisis, flash crash). For MVP, implement the basic ADL monitoring, but prioritize liquidations and end-date closures first. ADL is a safety net for extreme scenarios.

---

## Part 4.5: How the Keeper Enforces Market Parameters

This section explains how the keeper interacts with market configuration parameters (maxOpenInterest, reserveFactor, etc.) and what happens in various scenarios.

### The Two-Step Execution Model

```
USER ACTION                           KEEPER EXECUTION
    │                                       │
    ▼                                       ▼
┌─────────────────┐                 ┌─────────────────────────────┐
│ createOrder()   │                 │ executeOrder()              │
│                 │                 │                             │
│ - No validation │   ──────────>   │ - ALL validation happens    │
│ - Just stores   │   (your keeper) │ - Can REVERT if invalid     │
│   the request   │                 │ - Applies fees & impact     │
└─────────────────┘                 └─────────────────────────────┘
```

**Key insight:** The keeper doesn't "decide" to reject orders - the **smart contracts** validate everything during execution. Your keeper just calls `executeOrder()` and the contract either succeeds or reverts.

### What This Means for Your Keeper

1. **Your keeper is NOT a gatekeeper** - it doesn't filter or validate orders
2. **The contracts handle all validation** - parameters, balances, prices
3. **Your keeper handles failures gracefully** - catch reverts, log them, move on
4. **Failed orders stay in DataStore** - users can cancel after expiration

---

### Scenario: Position Too Large (Exceeds maxOpenInterest)

```
USER: "I want to open $5M LONG BRL position"
MARKET CONFIG: maxOpenInterest = $2M

┌─────────────────────────────────────────────────────────────────┐
│ FLOW:                                                           │
│                                                                 │
│ 1. User calls createOrder(sizeDeltaUsd: $5M)                   │
│    └── SUCCESS - order stored in DataStore                     │
│                                                                 │
│ 2. Keeper detects OrderCreated event                           │
│                                                                 │
│ 3. Keeper calls executeOrder(key, oracleParams)                │
│    └── Contract checks: currentOI + $5M > maxOpenInterest?     │
│    └── YES → REVERT with error                                 │
│                                                                 │
│ 4. Order is now "frozen" or can be cancelled                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**What your keeper does:** Just tries to execute. The contract handles rejection.

**Relevant code path:**
```
OrderHandler.executeOrder()
  → IncreaseOrderUtils.processOrder()
    → IncreasePositionUtils.increasePosition()
      → MarketUtils.validateOpenInterest()  ← REVERTS HERE
```

**Error thrown:** `MaxOpenInterestExceeded(openInterest, maxOpenInterest)`

---

### Scenario: Pool Imbalance (Funding Rate)

```
MARKET STATE:
  Long Open Interest:  $1.5M (75%)
  Short Open Interest: $0.5M (25%)

FUNDING RATE KICKS IN:
  - Longs PAY shorts
  - Rate increases over time if imbalance persists
```

**Your keeper's role: NONE for funding calculation**

Funding is calculated **on-chain** when positions are modified:
```
contracts/position/PositionUtils.sol
  → getFundingFees()  ← calculated at execution time
```

**However, your keeper DOES affect funding indirectly:**
- Faster execution = more accurate funding calculations
- Delayed execution = stale funding state

---

### Scenario: Price Impact on Large Orders

```
USER: Opens $500K position
MARKET: Only $2M total liquidity

PRICE IMPACT CALCULATION (happens in contract):
  imbalanceDelta = $500K
  impactFactor = negativePositionImpactFactor (e.g., 1e-9)
  exponent = 2

  impact = imbalanceDelta^2 * impactFactor
         = ($500K)^2 * 1e-9
         = ~$250 (0.05% impact)
```

**Your keeper's role:** Just execute. The contract calculates impact automatically.

```
OrderHandler.executeOrder()
  → PositionPricingUtils.getPositionPricing()
    → getPriceImpactUsd()  ← Calculates impact
    → Adjusts execution price accordingly
```

**What the trader experiences:**
- Wanted to buy at $5.00 (BRL/USD)
- Actual execution: $5.0025 (0.05% worse due to impact)

---

### Summary: Keeper Responsibilities vs Contract Responsibilities

```
┌─────────────────────────────────────────────────────────────────┐
│                     KEEPER RESPONSIBILITIES                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ REACTIVE (Event-Driven):                                        │
│ ├── OrderCreated      → executeOrder()                          │
│ ├── DepositCreated    → executeDeposit()                        │
│ ├── WithdrawalCreated → executeWithdrawal()                     │
│ └── ShiftCreated      → executeShift() (GLV)                    │
│                                                                 │
│ PROACTIVE (Polling/Monitoring):                                 │
│ ├── Check liquidatable positions → executeLiquidation()         │
│ ├── Check ADL conditions → updateAdlState() + executeAdl()      │
│ └── (Optional) Frozen order cleanup                             │
│                                                                 │
│ THE CONTRACT HANDLES (not keeper):                              │
│ ├── Parameter validation (maxOpenInterest, etc.)                │
│ ├── Price impact calculation                                    │
│ ├── Fee calculation                                             │
│ ├── Funding rate calculation                                    │
│ └── Borrowing fee calculation                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 4.6: ADL Deep Dive - Keeper Creates the Orders

This section provides detailed information about Auto-Deleveraging and clarifies that **the keeper must create ADL orders** - the protocol does NOT create them automatically.

### Does GMX Create ADL Orders Automatically?

**NO.** The keeper must:
1. **Monitor** the PnL-to-pool ratio
2. **Create** ADL orders by calling `executeAdl()`
3. The **contract creates** the actual decrease order internally during the `executeAdl()` call

```
┌─────────────────────────────────────────────────────────────────┐
│ ADL ORDER CREATION - WHO DOES WHAT?                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ KEEPER:                                                         │
│ ├── Monitors: getPnlToPoolFactor() > maxPnlFactorForAdl?       │
│ ├── Calls: updateAdlState(market, isLong, oracleParams)        │
│ └── Calls: executeAdl(account, market, collateral, isLong,     │
│            sizeDeltaUsd, oracleParams)                          │
│                                                                 │
│ CONTRACT (AdlUtils.createAdlOrder - called internally):         │
│ ├── Creates a MarketDecrease order internally                  │
│ ├── Sets acceptablePrice to 0 (long) or max (short)            │
│ ├── No slippage protection (trader gets market price)          │
│ └── Executes immediately in same transaction                   │
│                                                                 │
│ RESULT:                                                         │
│ ├── Profitable position is reduced                             │
│ ├── Trader receives their (capped) profits                     │
│ └── Pool PnL ratio returns to safe level                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### ADL Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ ADL FLOW (Keeper-Initiated):                                    │
│                                                                 │
│ 1. Keeper monitors: getPnlToPoolFactor() > maxPnlFactorForAdl? │
│                                                                 │
│ 2. If YES:                                                      │
│    a. updateAdlState(market, isLong) - enables ADL             │
│    b. Find most profitable positions                           │
│    c. executeAdl() for each until PnL ratio is healthy         │
│                                                                 │
│ 3. Result: Profitable positions forcibly reduced               │
│    - Traders get their profits (capped)                        │
│    - Pool PnL ratio returns to safe level                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### ADL Fees

| Fee Type | Who Pays | Amount |
|----------|----------|--------|
| Position Fee | Trader (from profits) | Same as regular close (0.04-0.06%) |
| Price Impact | Trader | Calculated normally |
| Execution Fee | **Protocol** (not trader) | No execution fee charged |
| Gas Cost | Keeper | Keeper pays gas, not reimbursed from trader |

**Important:** ADL orders have `executionFee: 0` - the protocol absorbs the cost. Your keeper pays gas without direct reimbursement for ADL executions. This is by design - ADL protects the pool, so the protocol bears the cost.

### ADL Errors

| Error | Cause | Keeper Action |
|-------|-------|---------------|
| `AdlNotRequired` | PnL ratio is below threshold | Skip ADL, market is healthy |
| `AdlNotEnabled` | `updateAdlState()` wasn't called first | Call `updateAdlState()` before `executeAdl()` |
| `InvalidSizeDeltaForAdl` | Trying to close more than position size | Reduce `sizeDeltaUsd` |
| `OracleTimestampsAreSmallerThanRequired` | Stale oracle prices | Refresh oracle prices |

### ADL vs Liquidation - Summary Comparison

| Aspect | Liquidation | ADL |
|--------|-------------|-----|
| Who gets affected | **Losing** positions | **Winning** positions |
| Why it happens | Position is unhealthy (losses > collateral) | Pool is over-exposed (too many winners) |
| Keeper initiates? | Yes | Yes |
| Execution fee | Reimbursed from position | NOT reimbursed (keeper pays) |
| How common? | Regular occurrence | Rare, extreme markets only |

---

## Part 4.7: Execution Failure Handling

When your keeper tries to execute and it fails, you need to handle it gracefully.

### Error Handling Code Pattern

```typescript
try {
  await orderHandler.executeOrder(orderKey, oracleParams);
} catch (error) {
  // Parse the error to understand what happened
  const errorName = parseRevertReason(error);

  switch (errorName) {
    // ORDER-RELATED ERRORS
    case 'EmptyOrder':
      // Order already executed or cancelled
      // Action: Remove from queue, log, continue
      break;

    case 'OrderNotFulfillableAtAcceptablePrice':
      // Limit order: price not reached
      // Action: Keep in queue, retry later
      break;

    case 'OrderNotFound':
      // Order was cancelled
      // Action: Remove from queue
      break;

    // MARKET LIMIT ERRORS
    case 'MaxOpenInterestExceeded':
      // Position would exceed market's max OI
      // Action: Order will stay frozen, user must cancel
      break;

    case 'MaxPoolAmountExceeded':
      // Deposit exceeds pool limit
      // Action: Order stays pending, may execute later if withdrawals happen
      break;

    case 'InsufficientReserve':
      // Not enough liquidity
      // Action: Order stays pending
      break;

    // ORACLE ERRORS
    case 'InvalidOraclePrice':
    case 'OracleTimestampsAreSmallerThanRequired':
    case 'OracleTimestampsAreLargerThanRequestExpirationTime':
      // Stale or invalid oracle prices
      // Action: Refresh prices and retry immediately
      break;

    // POSITION ERRORS
    case 'InsufficientCollateral':
      // User doesn't have enough collateral
      // Action: Order stays frozen
      break;

    default:
      // Unknown error
      // Action: Log for investigation
      console.error('Unknown execution error:', error);
  }
}
```

### Order States After Failure

```
┌─────────────────────────────────────────────────────────────────┐
│ WHAT HAPPENS TO FAILED ORDERS?                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ RECOVERABLE FAILURES:                                           │
│ ├── Limit order price not reached → Stays pending              │
│ ├── Stale oracle prices → Retry with fresh prices              │
│ └── Temporary liquidity issue → May succeed later              │
│                                                                 │
│ NON-RECOVERABLE FAILURES:                                       │
│ ├── MaxOpenInterestExceeded → Order frozen                     │
│ ├── InsufficientCollateral → Order frozen                      │
│ └── Other validation failures → Order frozen                   │
│                                                                 │
│ USER OPTIONS FOR FROZEN ORDERS:                                 │
│ ├── Wait for REQUEST_EXPIRATION_TIME (300s)                    │
│ └── Call cancelOrder() to get collateral back                  │
│                                                                 │
│ FROZEN ORDER EXECUTION:                                         │
│ └── Requires FROZEN_ORDER_KEEPER role (special permission)     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Complete Error Reference Table

**Order Execution Errors:**

| Error | Description | Keeper Action |
|-------|-------------|---------------|
| `EmptyOrder` | Order doesn't exist or already executed | Remove from queue |
| `OrderNotFound` | Order key not in DataStore | Remove from queue |
| `OrderAlreadyFrozen` | Cannot freeze an already frozen order | Skip |
| `OrderNotFulfillableAtAcceptablePrice` | Price moved beyond slippage | Retry later (limit orders) |
| `OrderValidFromTimeNotReached` | Order not yet valid | Retry after validFromTime |
| `UnsupportedOrderType` | Invalid order type | Log error, skip |
| `EmptySizeDeltaInTokens` | Size calculation resulted in 0 | Log error |
| `InvalidOrderPrices` | Trigger price conditions not met | Retry later |

**Market Limit Errors:**

| Error | Description | Keeper Action |
|-------|-------------|---------------|
| `MaxOpenInterestExceeded` | OI would exceed limit | Order frozen |
| `MaxPoolAmountExceeded` | Pool at capacity | Order stays pending |
| `MaxPoolUsdForDepositExceeded` | Deposit USD too high | Order stays pending |
| `MaxCollateralSumExceeded` | Too much collateral on side | Order frozen |
| `InsufficientReserve` | Not enough liquidity | Order stays pending |
| `InsufficientReserveForOpenInterest` | Reserve check failed | Order frozen |

**Oracle Errors:**

| Error | Description | Keeper Action |
|-------|-------------|---------------|
| `OracleTimestampsAreSmallerThanRequired` | Prices too old | Refresh prices, retry |
| `OracleTimestampsAreLargerThanRequestExpirationTime` | Prices newer than allowed | Wait for new prices |
| `InvalidOraclePrice` | Price validation failed | Check oracle config |
| `MaxOraclePriceAgeExceeded` | Prices expired | Fetch fresh prices |

**Position Errors:**

| Error | Description | Keeper Action |
|-------|-------------|---------------|
| `InsufficientCollateral` | Not enough margin | Order frozen |
| `InvalidPositionMarket` | Wrong market for position type | Log error |
| `InvalidCollateralTokenForMarket` | Collateral not supported | Log error |
| `UnexpectedPositionState` | Position state inconsistent | Log error |

**ADL Errors:**

| Error | Description | Keeper Action |
|-------|-------------|---------------|
| `AdlNotRequired` | PnL below threshold | Skip, market healthy |
| `AdlNotEnabled` | State not updated first | Call updateAdlState() |
| `InvalidSizeDeltaForAdl` | Closing more than position | Reduce sizeDeltaUsd |

**Liquidation Errors:**

| Error | Description | Keeper Action |
|-------|-------------|---------------|
| `PositionNotLiquidatable` | Position is healthy | Remove from liquidation queue |
| `InvalidLiquidationPrice` | Price calculation error | Check oracle prices |

### Retry Logic

```python
RETRYABLE_ERRORS = [
    'MaxOraclePriceAgeExceeded',
    'OracleBlockNumbersAreSmallerThanRequired',
    'nonce too low',
    'replacement transaction underpriced'
]

NON_RETRYABLE_ERRORS = [
    'EmptyOrder',
    'EmptyDeposit',
    'EmptyWithdrawal',
    'InsufficientCollateral',
    'OrderNotFulfillableAtAcceptablePrice'
]
```

---

## Part 5: Notifications & Logging

The keeper should notify users about important events and maintain logs for auditing.

**User Notifications:**

```
EVENTS THAT SHOULD NOTIFY THE USER
══════════════════════════════════

🟡 WARNING NOTIFICATIONS (user can take action):
├── Position at risk of liquidation
│   └── "Your BRL position is at 85% liquidation threshold. Add collateral to avoid liquidation."
│   └── Send when: remainingCollateral < 1.5x minimum (configurable threshold)
│
├── Position approaching end date
│   └── "Your BRL insurance expires in 24 hours."
│   └── Send when: endDate - now < 24 hours (or 48 hours, configurable)

🔴 CRITICAL NOTIFICATIONS (something happened):
├── Position was liquidated
│   └── "Your BRL position was liquidated. Remaining collateral: $X returned."
│
├── Position expired and closed
│   └── "Your BRL insurance has expired. Final settlement: +$X profit / -$X loss."
│
├── Order executed successfully
│   └── "Your SHORT position on BRL is now open. Size: $10,000"

🟢 INFORMATIONAL:
├── Order created/updated/cancelled
├── Deposit/withdrawal completed
└── Price alerts (if configured)
```

**How to send notifications:**

| Channel | Best For | Implementation |
|---------|----------|----------------|
| Email | Critical alerts, end-of-day summaries | SendGrid, AWS SES, etc. |
| Push notifications | Real-time alerts (mobile app) | Firebase, OneSignal |
| Webhook | Integration with user's systems | HTTP POST to user's endpoint |
| In-app | All events | Store in database, show in UI |

**Logging & Auditing:**

```
EVENTS TO LOG (for auditing and debugging)
══════════════════════════════════════════

Every keeper action should be logged:

├── Order executions
│   └── timestamp, orderKey, orderType, user, market, size, price, txHash, gasUsed
│
├── Liquidations
│   └── timestamp, positionKey, user, market, collateralLost, remainingReturned, txHash
│
├── Position closures (end date)
│   └── timestamp, positionKey, user, market, pnl, settlementAmount, txHash
│
├── Errors and retries
│   └── timestamp, operation, error, retryCount, resolved
│
└── System events
    └── keeper started/stopped, balance low, price fetch failed, etc.
```

**Recommended logging services:**

| Service | Description |
|---------|-------------|
| Papertrail | Cloud-hosted log management, easy search |
| Datadog | Logs + metrics + monitoring in one |
| AWS CloudWatch | If already on AWS |
| Self-hosted ELK | Elasticsearch + Logstash + Kibana |

**Example log structure:**

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "event": "ORDER_EXECUTED",
  "level": "INFO",
  "data": {
    "orderKey": "0xabc123...",
    "orderType": "MarketIncrease",
    "user": "0x742d35...",
    "market": "BRL/USD",
    "isLong": false,
    "sizeUsd": "10000000000000000000000000000000",
    "executionPrice": "0.16",
    "txHash": "0xdef456...",
    "gasUsed": 2850000,
    "executionTimeMs": 1250
  }
}
```

> **📝 NIVO NOTE:** For MVP, prioritize:
> 1. **Liquidation warnings** - Most important, users can add collateral to save their position
> 2. **End date reminders** - Users should know when their insurance expires
> 3. **Basic logging** - At minimum, log all executions to a file or simple service
> 4. Email notifications can be added later, start with in-app notifications

---

## Roles Required

### Keeper Wallet Setup

The keeper is a backend service that needs its own blockchain wallet to submit transactions. This wallet:

1. **Holds the private key** used to sign transactions
2. **Holds native tokens** (ETH) to pay for gas fees
3. **Has specific roles granted** that authorize it to execute operations

```
KEEPER WALLET ARCHITECTURE
══════════════════════════

┌─────────────────────────────────────────────────────────────┐
│                     KEEPER SERVICE                          │
│                                                             │
│  ┌─────────────────┐    ┌─────────────────────────────┐    │
│  │  Private Key    │    │  Wallet Address             │    │
│  │  (NEVER EXPOSE) │───▶│  0x1234...abcd              │    │
│  │                 │    │                             │    │
│  │  Stored in:     │    │  This address is granted    │    │
│  │  - .env file    │    │  KEEPER roles on-chain      │    │
│  │  - AWS Secrets  │    │                             │    │
│  │  - Vault        │    │  Must hold ETH for gas      │    │
│  └─────────────────┘    └─────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Creating the Keeper Wallet

```typescript
// Option 1: Generate a new wallet
import { ethers } from "ethers";

const wallet = ethers.Wallet.createRandom();
console.log("Address:", wallet.address);
console.log("Private Key:", wallet.privateKey);  // Save securely!
console.log("Mnemonic:", wallet.mnemonic.phrase); // Backup!

// Option 2: Use existing private key from environment
const keeper = new ethers.Wallet(
  process.env.KEEPER_PRIVATE_KEY,
  provider
);
```

**Important Security Practices:**
- NEVER commit the private key to git
- Use environment variables or a secrets manager
- Consider using a hardware wallet for production
- The keeper wallet is a HOT WALLET (always online) - only keep necessary funds

### Required Roles for Nivo

For Nivo's keeper to function, these roles are **required**:

| Role | Required? | What It Allows |
|------|-----------|----------------|
| `ORDER_KEEPER` | ✅ Yes | Execute deposits, withdrawals, orders, shifts |
| `LIQUIDATION_KEEPER` | ✅ Yes | Execute liquidations when positions are underwater |
| `ADL_KEEPER` | ✅ Yes | Auto-deleverage positions when pool is at risk |
| `FROZEN_ORDER_KEEPER` | ⚠️ Optional | Execute orders that failed and got frozen |

**Why each role matters:**
- **ORDER_KEEPER**: Core functionality - without this, users can't open/close positions
- **LIQUIDATION_KEEPER**: Protects LPs - liquidates positions before they go negative
- **ADL_KEEPER**: Protects the pool - reduces winning positions if pool can't pay
- **FROZEN_ORDER_KEEPER**: Recovery - handles edge cases where orders fail mid-execution

### Who Can Grant Roles?

Roles are managed by the `RoleStore` contract. Only addresses with `ROLE_ADMIN` can grant roles:

```
ROLE HIERARCHY
══════════════

┌─────────────────────────────────────────────────────────────┐
│                     ROLE_ADMIN                              │
│            (Usually the protocol deployer)                  │
│                                                             │
│    Can grant/revoke all roles including:                    │
│    ├── ORDER_KEEPER                                         │
│    ├── LIQUIDATION_KEEPER                                   │
│    ├── ADL_KEEPER                                           │
│    ├── FROZEN_ORDER_KEEPER                                  │
│    └── ROLE_ADMIN (can add more admins)                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### How to Grant Roles

**Option 1: Using a Hardhat Script**

```typescript
// scripts/grant-keeper-roles.ts
import { ethers } from "hardhat";

async function main() {
  const [admin] = await ethers.getSigners();  // Must be ROLE_ADMIN

  const roleStore = await ethers.getContract("RoleStore");
  const keeperAddress = "0x1234...";  // Your keeper wallet address

  // Role hashes (from contracts/role/Role.sol)
  const ORDER_KEEPER = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("ORDER_KEEPER")
  );
  const LIQUIDATION_KEEPER = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("LIQUIDATION_KEEPER")
  );
  const ADL_KEEPER = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes("ADL_KEEPER")
  );

  console.log("Granting ORDER_KEEPER role...");
  await roleStore.grantRole(keeperAddress, ORDER_KEEPER);

  console.log("Granting LIQUIDATION_KEEPER role...");
  await roleStore.grantRole(keeperAddress, LIQUIDATION_KEEPER);

  console.log("Granting ADL_KEEPER role...");
  await roleStore.grantRole(keeperAddress, ADL_KEEPER);

  console.log("All roles granted to:", keeperAddress);
}

main().catch(console.error);
```

Run with:
```bash
npx hardhat run scripts/grant-keeper-roles.ts --network <your-network>
```

**Option 2: Using Hardhat Console**

```bash
npx hardhat console --network localhost
```

```javascript
const roleStore = await ethers.getContract("RoleStore");
const keeper = "0x1234...";  // Your keeper address

// Grant roles one by one
await roleStore.grantRole(keeper, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORDER_KEEPER")));
await roleStore.grantRole(keeper, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LIQUIDATION_KEEPER")));
await roleStore.grantRole(keeper, ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADL_KEEPER")));
```

### Verifying Roles Were Granted

```typescript
// Check if keeper has a specific role
const hasOrderKeeper = await roleStore.hasRole(
  keeperAddress,
  ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORDER_KEEPER"))
);
console.log("Has ORDER_KEEPER:", hasOrderKeeper);  // true
```

### Keeper Wallet Funding

The keeper wallet needs native tokens (ETH) to pay for gas:

```
KEEPER WALLET REQUIREMENTS
══════════════════════════

1. INITIAL FUNDING
   └── Send enough ETH to cover ~1000 transactions
   └── Example: 0.5 ETH for local testing, 2+ ETH for production

2. MONITORING
   └── Set up alerts when balance drops below threshold
   └── Example: Alert when < 0.1 ETH remaining

3. AUTO-REFILL (Production)
   └── Script that monitors balance and refills from treasury
   └── Or use a service like OpenZeppelin Defender
```

### Environment Variables for Keeper

```bash
# .env file for keeper service
KEEPER_PRIVATE_KEY=0x...your_private_key...
RPC_URL=http://localhost:8545
ROLE_STORE_ADDRESS=0x...
DATA_STORE_ADDRESS=0x...
ORDER_HANDLER_ADDRESS=0x...
DEPOSIT_HANDLER_ADDRESS=0x...
WITHDRAWAL_HANDLER_ADDRESS=0x...
LIQUIDATION_HANDLER_ADDRESS=0x...
```

---

## Gas Fees & Keeper Economics

### How Does the Keeper Pay for Gas?

The keeper submits transactions to the blockchain, which requires paying gas fees. Here's how it works:

```
KEEPER GAS FLOW
═══════════════

1. KEEPER WALLET
   └── Must hold native token (ETH on Arbitrum, AVAX on Avalanche, etc.)
   └── This is used to pay for transaction gas fees
   └── Needs to be funded and monitored

2. USER PAYS EXECUTION FEE
   └── When user creates an order, they pay an "executionFee"
   └── This fee is sent along with the order (in native token)
   └── Stored in the OrderVault until execution

3. KEEPER GETS REIMBURSED
   └── When keeper executes the order, GMX reimburses the keeper
   └── Keeper receives the executionFee from the vault
   └── This covers (or exceeds) the gas cost
```

**The economic flow:**

```
USER CREATES ORDER                         KEEPER EXECUTES
─────────────────                         ────────────────

User pays:                                Keeper pays:
├── executionFee: 0.001 ETH               ├── Gas fee: ~0.0008 ETH
└── Sent to OrderVault                    └── From keeper wallet

                    ↓ After execution ↓

                    Keeper receives:
                    └── executionFee: 0.001 ETH (from vault)

                    Keeper profit: 0.0002 ETH
```

### Keeper Wallet Setup

```
KEEPER WALLET REQUIREMENTS
══════════════════════════

1. FUND THE WALLET
   └── Transfer native token (ETH) to the keeper address
   └── Recommended: Start with 0.5-1 ETH for testing
   └── Production: Monitor and top up as needed

2. MONITOR BALANCE
   └── Set up alerts when balance falls below threshold
   └── Example: Alert if balance < 0.1 ETH

3. EXECUTION FEES REIMBURSE YOU
   └── For orders/deposits/withdrawals: User pays executionFee
   └── Keeper gets reimbursed after execution
   └── Should be net positive (slight profit per execution)

4. LIQUIDATIONS ARE DIFFERENT
   └── Liquidations don't have a user-paid executionFee
   └── Keeper pays gas but receives a liquidation reward
   └── Reward comes from the liquidated position's collateral
```

### Who Pays What?

| Operation | User Pays | Keeper Pays | Keeper Receives |
|-----------|-----------|-------------|-----------------|
| Order execution | executionFee upfront | Gas | executionFee (reimbursement) |
| Deposit execution | executionFee upfront | Gas | executionFee (reimbursement) |
| Withdrawal execution | executionFee upfront | Gas | executionFee (reimbursement) |
| Liquidation | Nothing | Gas | Liquidation reward (from collateral) |
| ADL | Nothing | Gas | Small reward (configured in protocol) |

### Execution Fee Calculation

The execution fee the user pays is calculated based on:

```
executionFee = estimatedGasLimit × currentGasPrice × multiplier

Where:
├── estimatedGasLimit: Expected gas for the operation
├── currentGasPrice: Current network gas price
└── multiplier: Safety buffer (usually 1.2x to 1.5x)
```

The frontend calculates this when the user creates an order. If gas prices spike after order creation, the keeper might lose money on that execution (rare).

> **📝 NIVO NOTE:** For Nivo MVP, you'll need to:
> 1. Fund the keeper wallet with ETH (or native token of your chain)
> 2. Set up balance monitoring/alerts
> 3. The keeper should be profitable over time since users pay execution fees
> 4. For liquidations, ensure the liquidation reward covers gas costs

---

## Role Architecture & Separation of Concerns

Not all parts of the keeper need blockchain write access. Only the **executor** component needs the private key and keeper role.

### Which Components Need What Access?

```
KEEPER COMPONENTS - ACCESS LEVELS
═════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   COMPONENT              ACCESS NEEDED           ROLE REQUIRED              │
│   ─────────              ─────────────           ─────────────              │
│                                                                             │
│   1. EVENT WATCHER       Read-only               None                       │
│      └── Just listens to blockchain events                                  │
│      └── No private key needed                                              │
│                                                                             │
│   2. PRICE FETCHER       Off-chain only          None                       │
│      └── Calls oracle APIs (Pyth, Chainlink)                                │
│      └── No blockchain access needed                                        │
│                                                                             │
│   3. POSITION MONITOR    Read-only               None                       │
│      └── Reads positions from DataStore/subgraph                            │
│      └── No private key needed                                              │
│                                                                             │
│   4. NOTIFICATION        Off-chain only          None                       │
│      └── Sends emails, logs events                                          │
│      └── No blockchain access needed                                        │
│                                                                             │
│   5. EXECUTOR ⚠️          Write access            ORDER_KEEPER               │
│      └── THE ONLY component that writes to blockchain                       │
│      └── Needs private key                                                  │
│      └── Needs keeper roles (ORDER_KEEPER, LIQUIDATION_KEEPER, etc.)        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why This Separation Matters

```
SECURITY BENEFIT:
─────────────────

Only ONE component has the private key:
├── If Event Watcher is compromised → No funds at risk
├── If Price Fetcher is compromised → No funds at risk
├── If Notification service is compromised → No funds at risk
├── If Executor is compromised → ⚠️ Funds at risk

Minimize attack surface by isolating the Executor
```

### Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KEEPER ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐               │
│   │ Event Watcher│     │Price Fetcher │     │Position Mon. │               │
│   │  (read-only) │     │ (off-chain)  │     │  (read-only) │               │
│   └──────┬───────┘     └──────┬───────┘     └──────┬───────┘               │
│          │                    │                    │                        │
│          └────────────────────┼────────────────────┘                        │
│                               │                                             │
│                               ▼                                             │
│                    ┌─────────────────────┐                                  │
│                    │   EXECUTION QUEUE   │ ◄── FIFO Queue                   │
│                    │   (in-memory/Redis) │                                  │
│                    └──────────┬──────────┘                                  │
│                               │                                             │
│                               ▼                                             │
│                    ┌─────────────────────┐                                  │
│                    │      EXECUTOR       │ ◄── Only this has private key    │
│                    │  (write access)     │                                  │
│                    │  ORDER_KEEPER role  │                                  │
│                    └──────────┬──────────┘                                  │
│                               │                                             │
│                               ▼                                             │
│                    ┌─────────────────────┐                                  │
│                    │     BLOCKCHAIN      │                                  │
│                    └─────────────────────┘                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Execution Queue (FIFO)

Use a **First-In-First-Out (FIFO)** queue to manage orders waiting to be executed. This ensures fair ordering and prevents race conditions.

### Why Use a Queue?

```
PROBLEMS WITHOUT A QUEUE:
─────────────────────────

1. Race conditions - Multiple processes trying to execute same order
2. Lost orders - If server crashes, pending orders are forgotten
3. No priority - Urgent orders (liquidations) wait behind regular orders
4. No retry - Failed orders are lost forever
```

### Queue Structure

```
EXECUTION QUEUE
═══════════════

Each queue item contains:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   {                                                                         │
│     id: "unique-id",                                                        │
│     type: "ORDER" | "LIQUIDATION" | "END_DATE_CLOSE" | "DEPOSIT" | ...,     │
│     priority: 1-10,           // Higher = more urgent                       │
│     key: "0xabc123...",       // Order/position key                         │
│     market: "BRL/USD",                                                      │
│     account: "0x742d35...",   // User address                               │
│     createdAt: 1704067200,    // When added to queue                        │
│     attempts: 0,              // Retry counter                              │
│     lastError: null,          // Last error message                         │
│     data: { ... }             // Additional data needed for execution       │
│   }                                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Priority Levels

| Priority | Type | Reason |
|----------|------|--------|
| 10 (highest) | Liquidation | Protect the pool, time-critical |
| 9 | ADL | Pool protection |
| 8 | End date closure | Contract expiration |
| 5 | Market orders | User is waiting |
| 3 | Deposits/Withdrawals | Less time-sensitive |
| 1 (lowest) | Limit orders | Can wait for price |

### Queue Flow

```
HOW THE QUEUE WORKS
═══════════════════

1. PRODUCERS (add items to queue):
   ├── Event Watcher → sees OrderCreated → adds to queue
   ├── Position Monitor → detects liquidation → adds to queue (high priority)
   └── Position Monitor → detects end date → adds to queue

2. QUEUE STORAGE:
   ├── In-memory (simple, but lost on crash)
   ├── Redis (persistent, recommended)
   └── PostgreSQL (if you need complex queries)

3. CONSUMER (Executor):
   ├── Polls queue for next item (highest priority first)
   ├── Fetches prices
   ├── Executes transaction
   ├── On success → remove from queue
   └── On failure → increment attempts, retry or dead-letter

FLOW:
─────

  Event Watcher ──┐
                  │
  Position Monitor┼──► QUEUE ──► Executor ──► Blockchain
                  │     │
  Manual trigger ─┘     │
                        ▼
                   Dead Letter Queue
                   (failed after max retries)
```

### Queue Implementation Options

| Option | Pros | Cons |
|--------|------|------|
| **Redis + Bull/BullMQ** | Fast, persistent, built-in retry | Requires Redis server |
| **PostgreSQL** | Already have DB, ACID guarantees | Slower, more complex |
| **In-memory array** | Simple, no dependencies | Lost on crash, not scalable |
| **AWS SQS** | Managed, scalable | Cloud dependency, latency |

> **📝 NIVO NOTE:** For MVP, start with Redis + BullMQ. It's battle-tested, has built-in retry logic, and persists across restarts.

---

## Retry Mechanisms & Failsafes

### Retry Strategy

```
RETRY CONFIGURATION
═══════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   MAX_RETRIES = 5                                                           │
│   RETRY_DELAYS = [1s, 5s, 15s, 60s, 300s]  // Exponential backoff           │
│                                                                             │
│   Attempt 1: Immediate                                                      │
│   Attempt 2: Wait 1 second                                                  │
│   Attempt 3: Wait 5 seconds                                                 │
│   Attempt 4: Wait 15 seconds                                                │
│   Attempt 5: Wait 60 seconds                                                │
│   Attempt 6: Wait 300 seconds (5 minutes)                                   │
│   After 6 failures: Move to Dead Letter Queue                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Which Errors Should Retry?

```
RETRYABLE ERRORS (temporary, might succeed on retry):
─────────────────────────────────────────────────────
├── Network errors (timeout, connection refused)
├── "nonce too low" (another tx was faster)
├── "replacement transaction underpriced" (gas price changed)
├── "MaxOraclePriceAgeExceeded" (price became stale)
├── RPC node errors (rate limit, temporary outage)
└── Gas estimation failed (network congestion)

NON-RETRYABLE ERRORS (will always fail, don't retry):
─────────────────────────────────────────────────────
├── "EmptyOrder" (order was already executed or cancelled)
├── "EmptyDeposit" (deposit already processed)
├── "InsufficientCollateral" (user's problem)
├── "OrderNotFulfillableAtAcceptablePrice" (slippage too tight)
├── "MaxOpenInterestExceeded" (market at capacity)
└── Invalid signature (data corruption)
```

### Failsafes for Server Crashes

```
CRASH RECOVERY
══════════════

PROBLEM: Server crashes while processing orders

SOLUTION 1: Persistent Queue (Redis)
────────────────────────────────────
├── Queue survives server restart
├── In-progress items are re-queued automatically
└── Use "visibility timeout" to prevent double processing

SOLUTION 2: Checkpoint/Resume
─────────────────────────────
├── Periodically save "last processed block" to database
├── On restart, resume from last checkpoint
└── Re-scan events from that block forward

SOLUTION 3: Idempotent Execution
────────────────────────────────
├── Before executing, check if order still exists
├── GMX will reject if already executed ("EmptyOrder")
└── Safe to retry same order multiple times
```

---

## Part 6: Health Checks & Monitoring

```
HEALTH MONITORING
═════════════════

1. LIVENESS CHECK (is the keeper alive?)
   └── Heartbeat endpoint: GET /health → 200 OK
   └── Alert if no heartbeat for 60 seconds

2. READINESS CHECK (is the keeper ready to process?)
   ├── RPC connection OK?
   ├── Oracle API reachable?
   ├── Queue connection OK?
   └── Keeper wallet balance sufficient?

3. METRICS TO TRACK:
   ├── Queue depth (how many pending items)
   ├── Execution latency (time from event to execution)
   ├── Success/failure rate
   ├── Gas costs
   └── Wallet balance

4. ALERTS:
   ├── Queue depth > 100 (backlog building up)
   ├── Failure rate > 10% (something wrong)
   ├── Wallet balance < 0.1 ETH (needs refill)
   └── No executions in 10 minutes (might be stuck)
```

### Dead Letter Queue

```
DEAD LETTER QUEUE (DLQ)
═══════════════════════

When an item fails after MAX_RETRIES, move it to the DLQ:

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Dead Letter Queue Item:                                                   │
│   {                                                                         │
│     originalItem: { ... },       // The failed queue item                   │
│     failedAt: 1704067200,                                                   │
│     attempts: 5,                                                            │
│     errors: [                                                               │
│       "Attempt 1: timeout",                                                 │
│       "Attempt 2: nonce too low",                                           │
│       "Attempt 3: gas estimation failed",                                   │
│       ...                                                                   │
│     ]                                                                       │
│   }                                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

DLQ HANDLING:
─────────────
├── Send alert to team
├── Manual investigation required
├── Can manually retry after fixing issue
└── Or acknowledge as "won't fix" (e.g., order was cancelled by user)
```

---

## Security Considerations

### Private Key Protection

```
PRIVATE KEY SECURITY
════════════════════

⚠️ THE KEEPER PRIVATE KEY CAN DRAIN THE KEEPER WALLET ⚠️

MUST DO:
────────
├── NEVER commit private key to git
├── NEVER log the private key
├── Store in environment variable or secrets manager
├── Use different keys for testnet vs mainnet
└── Rotate keys periodically

RECOMMENDED:
────────────
├── AWS Secrets Manager / GCP Secret Manager
├── HashiCorp Vault
├── Hardware Security Module (HSM) for production
└── Separate wallet with minimal balance needed

ARCHITECTURE:
─────────────

  ┌─────────────────┐
  │ Secrets Manager │ ◄── Private key stored here
  └────────┬────────┘
           │
           ▼ (fetched at startup only)
  ┌─────────────────┐
  │    Executor     │ ◄── Key in memory, never written to disk
  └─────────────────┘
```

### Access Control

```
ROLE SEPARATION
═══════════════

1. KEEPER WALLET (on-chain roles):
   ├── ORDER_KEEPER - can execute orders, deposits, withdrawals
   ├── LIQUIDATION_KEEPER - can execute liquidations
   ├── ADL_KEEPER - can execute ADL
   └── FROZEN_ORDER_KEEPER - can retry frozen orders

   These roles are granted in the GMX RoleStore contract.

2. INFRASTRUCTURE ACCESS:
   ├── Server SSH - limited to ops team
   ├── Database - read-only for most services
   ├── Redis - only executor needs write access
   └── Secrets Manager - only executor needs access

3. API ACCESS:
   ├── Oracle APIs - can be public (prices are public data)
   ├── RPC nodes - can use public endpoints
   └── Notification services - separate credentials
```

### Network Security

```
NETWORK PROTECTION
══════════════════

1. RPC ENDPOINTS:
   ├── Use private RPC nodes if possible (Alchemy, Infura, QuickNode)
   ├── Don't rely on a single provider (have fallbacks)
   └── Rate limit your requests

2. API KEYS:
   ├── Rotate regularly
   ├── Use separate keys per environment
   └── Set IP allowlists where possible

3. INFRASTRUCTURE:
   ├── Run in private VPC
   ├── No public SSH access (use bastion host)
   ├── Firewall: only allow outbound to known endpoints
   └── DDoS protection for any public endpoints
```

### Audit Trail

```
AUDIT LOGGING
═════════════

Log EVERY sensitive action:

├── Order executions (who, what, when, txHash)
├── Liquidations (position details, amount)
├── Private key access (when key was loaded)
├── Configuration changes
├── Manual interventions (DLQ retries)
└── Failed authentication attempts

Store logs:
├── Minimum 90 days retention
├── Immutable storage (can't be deleted)
├── Off-server (in case of compromise)
└── Include timestamps and request IDs
```

> **📝 NIVO NOTE:** Security priorities for MVP:
> 1. **Private key in environment variable** (not in code)
> 2. **Separate testnet/mainnet keys**
> 3. **Basic logging of all executions**
> 4. **Monitor wallet balance**
>
> Advanced security (HSM, Vault, VPC) can come later for production.

---

## Architecture: Microservices vs Monolith

### Recommendation: Go with the Monolith

For a keeper service, a **modular monolith** is the right choice. Here's why:

```
WHY MONOLITH IS BETTER FOR A KEEPER
═══════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   MICROSERVICES (5 separate services)      MONOLITH (1 service, 5 modules) │
│   ────────────────────────────────────     ─────────────────────────────── │
│                                                                             │
│   ❌ Network latency between services      ✅ In-memory communication       │
│   ❌ 5 deployments to manage               ✅ 1 deployment                  │
│   ❌ 5 health checks to monitor            ✅ 1 health check                │
│   ❌ Distributed tracing complexity        ✅ Simple stack traces           │
│   ❌ Service discovery needed              ✅ Just function calls           │
│   ❌ Shared queue = network calls          ✅ Shared queue = memory         │
│   ❌ Docker orchestration (K8s?)           ✅ Single container              │
│   ❌ 5x logging/monitoring setup           ✅ 1 logging setup               │
│   ❌ Partial failures (service A up,       ✅ All or nothing                │
│       service B down)                                                       │
│                                                                             │
│   Good for: 50+ engineers, Netflix         Good for: Small team, single    │
│             scale, independent releases            purpose service          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

The keeper is a **SINGLE PURPOSE service**. Microservices add complexity without benefit here.

### Modular Monolith Architecture

```
MODULAR MONOLITH ARCHITECTURE
═════════════════════════════

┌─────────────────────────────────────────────────────────────────────────────┐
│                           KEEPER SERVICE (Single Process)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   EVENT     │  │   PRICE     │  │  POSITION   │  │ NOTIFICATION│        │
│  │  WATCHER    │  │  FETCHER    │  │  MONITOR    │  │   SERVICE   │        │
│  │             │  │             │  │             │  │             │        │
│  │ • WebSocket │  │ • Pyth API  │  │ • Health    │  │ • Email     │        │
│  │ • Polling   │  │ • Cache     │  │ • End dates │  │ • Logging   │        │
│  │ • Events    │  │ • Format    │  │ • Alerts    │  │ • Alerts    │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │               │
│         │    ┌───────────┴────────────────┴────────────────┘               │
│         │    │                                                              │
│         ▼    ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                     EXECUTION QUEUE                              │       │
│  │                     (In-Memory + Redis backup)                   │       │
│  │                                                                  │       │
│  │  Priority Queue: [Liquidation, ADL, EndDate, Orders, Deposits]  │       │
│  └─────────────────────────────────┬───────────────────────────────┘       │
│                                    │                                        │
│                                    ▼                                        │
│                    ┌─────────────────────────────┐                          │
│                    │         EXECUTOR            │                          │
│                    │                             │                          │
│                    │  • Has private key 🔐       │                          │
│                    │  • Builds transactions      │                          │
│                    │  • Submits to blockchain    │                          │
│                    │  • Handles retries          │                          │
│                    └─────────────────────────────┘                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  SHARED INFRASTRUCTURE                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│  │  Config  │  │  Logger  │  │  Metrics │  │  Health  │                    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────┐
                    │        BLOCKCHAIN           │
                    │   (Hardhat / Testnet /      │
                    │         Mainnet)            │
                    └─────────────────────────────┘
```
