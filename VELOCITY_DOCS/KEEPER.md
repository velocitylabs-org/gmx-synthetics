# Keepers

This document explains what Keepers are in GMX V2, why they exist, and how to build a custom one.

> **Related Docs:** See [CONTRACT_ARCHITECTURE.md](./CONTRACT_ARCHITECTURE.md) for the full system overview.

---

## What is a Keeper?

A **Keeper** is an off-chain bot that executes pending orders on behalf of users. It's the critical piece that makes GMX V2's asynchronous execution model work.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GMX V2 EXECUTION MODEL                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   User                         GMX Contracts                    Keeper      │
│    │                               │                              │         │
│    │  1. createOrder()             │                              │         │
│    │──────────────────────────────>│                              │         │
│    │                               │                              │         │
│    │                               │  2. Store order in DataStore │         │
│    │                               │  3. Emit "OrderCreated" event│         │
│    │                               │─────────────────────────────>│         │
│    │                               │                              │         │
│    │                               │                              │ 4. Fetch│
│    │                               │                              │   prices│
│    │                               │                              │         │
│    │                               │  5. executeOrder(key, prices)│         │
│    │                               │<─────────────────────────────│         │
│    │                               │                              │         │
│    │  6. Receive tokens/position   │                              │         │
│    │<──────────────────────────────│                              │         │
│    │                               │                              │         │
│    │                               │  7. Pay execution fee        │         │
│    │                               │─────────────────────────────>│         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Why Keepers Exist

### 1. Prevent Front-Running (MEV Protection)

#### What is Front-Running?

**Front-running** is when someone sees your pending transaction in the mempool and submits their own transaction first to profit at your expense.

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        FRONT-RUNNING ATTACK EXAMPLE                        │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│   You                          Mempool                       Front-Runner  │
│    │                              │                              │         │
│    │  1. Submit: "Buy ETH         │                              │         │
│    │     at $2000"                │                              │         │
│    │─────────────────────────────>│                              │         │
│    │                              │                              │         │
│    │                              │  2. Front-runner sees        │         │
│    │                              │     your transaction         │         │
│    │                              │─────────────────────────────>│         │
│    │                              │                              │         │
│    │                              │  3. Submits same buy with    │         │
│    │                              │     higher gas (executes     │         │
│    │                              │     BEFORE yours)            │         │
│    │                              │<─────────────────────────────│         │
│    │                              │                              │         │
│    │  4. Your buy executes        │                              │         │
│    │     at $2005 (worse price    │                              │         │
│    │     after their buy)         │                              │         │
│    │<─────────────────────────────│                              │         │
│    │                              │                              │         │
│    │                              │  5. Front-runner sells at    │         │
│    │                              │     $2005, profits $5        │         │
│    │                              │<─────────────────────────────│         │
│                                                                            │
│   Result: You paid more, front-runner extracted value from your trade      │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

#### What is MEV?

**MEV (Maximal Extractable Value)** is the profit that can be extracted by reordering, inserting, or censoring transactions in a block. Front-running is one type of MEV.

Common MEV attacks:
- **Front-running** - Buy before a large buy order, sell after
- **Sandwich attack** - Buy before AND sell after your trade
- **Back-running** - Trade immediately after a large trade
- **Liquidation racing** - Compete to liquidate underwater positions

#### How GMX Prevents This

GMX's two-step execution model makes front-running **economically useless**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        GMX MEV PROTECTION MODEL                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   You                           GMX                           Front-Runner  │
│    │                             │                                │         │
│    │  1. Create order (no price  │                                │         │
│    │     in transaction)         │                                │         │
│    │────────────────────────────>│                                │         │
│    │                             │                                │         │
│    │                             │  2. Front-runner sees order    │         │
│    │                             │     creation, but NO PRICE     │         │
│    │                             │───────────────────────────────>│         │
│    │                             │                                │         │
│    │                             │  3. Front-runner can't profit: │         │
│    │                             │     - Price unknown until      │         │
│    │                             │       keeper executes          │         │
│    │                             │     - Keeper uses oracle price │         │
│    │                             │       at execution time        │         │
│    │                             │     - No mempool exposure      │         │
│    │                             │                                │         │
│    │  4. Keeper executes with    │                                │         │
│    │     fair oracle price       │                                │         │
│    │<────────────────────────────│                                │         │
│                                                                             │
│   Result: Fair execution price, MEV attacks defeated                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key protections:**

1. **Price decoupling**: The price used for execution is NOT in the user's transaction
2. **Oracle pricing**: Keepers provide signed oracle prices at execution time
3. **No mempool value**: Front-runners can't extract value because execution price is unknown
4. **Acceptable price**: Users set min/max acceptable price as slippage protection

#### Code Reference

The acceptable price check ensures users get fair execution:

```solidity
// contracts/order/BaseOrderUtils.sol:214
function getExecutionPriceForIncrease(
    uint256 sizeDeltaUsd,
    uint256 sizeDeltaInTokens,
    uint256 acceptablePrice,
    bool isLong
) internal pure returns (uint256) {
    // For longs: execution price must be <= acceptable price
    // For shorts: execution price must be >= acceptable price
    ...
}
```

### 2. Ensure Fair Pricing

Prices are fetched **at execution time**, not when the order is created. This means:
- No stale prices
- No price manipulation between order creation and execution
- Oracle prices are validated on-chain

### 3. Abstract Complexity

Users don't need to:
- Fetch and sign oracle prices
- Calculate gas costs
- Handle execution errors

Keepers handle all of this automatically.

---

## Keeper Roles in GMX V2

GMX V2 defines multiple keeper roles for different operations. These are defined in [Role.sol](../contracts/role/Role.sol):

| Role | Purpose | Handler Contract |
|------|---------|------------------|
| `ORDER_KEEPER` | Execute deposits, withdrawals, orders, shifts | [OrderHandler](../contracts/exchange/OrderHandler.sol#L249), [DepositHandler](../contracts/exchange/DepositHandler.sol#L105), [WithdrawalHandler](../contracts/exchange/WithdrawalHandler.sol#L106) |
| `LIQUIDATION_KEEPER` | Execute liquidations | [LiquidationHandler](../contracts/exchange/LiquidationHandler.sol#L55) |
| `ADL_KEEPER` | Auto-deleveraging operations | [AdlHandler](../contracts/exchange/AdlHandler.sol#L64) |
| `FROZEN_ORDER_KEEPER` | Execute frozen orders | [OrderHandler](../contracts/exchange/OrderHandler.sol#L427) |
| `FEE_KEEPER` | Process fee claims | [FeeHandler](../contracts/fee/FeeHandler.sol) |
| `PRICING_KEEPER` | Update price impact distributions | - |
| `CONFIG_KEEPER` | Protocol configuration | - |
| `MARKET_KEEPER` | Market creation/updates | - |

### Role Validation

Roles are validated via modifiers in [RoleModule.sol](../contracts/role/RoleModule.sol):

```solidity
// contracts/role/RoleModule.sol:123
modifier onlyOrderKeeper() {
    _validateRole(Role.ORDER_KEEPER, "ORDER_KEEPER");
    _;
}
```

---

## What Keepers Execute

### 1. Deposits (Add Liquidity)

```
User calls: ExchangeRouter.createDeposit()
Keeper calls: DepositHandler.executeDeposit(key, oracleParams)
Result: User receives GM tokens
```

**Handler:** [DepositHandler.executeDeposit](../contracts/exchange/DepositHandler.sol#L100)

### 2. Withdrawals (Remove Liquidity)

```
User calls: ExchangeRouter.createWithdrawal()
Keeper calls: WithdrawalHandler.executeWithdrawal(key, oracleParams)
Result: User receives long/short tokens
```

**Handler:** [WithdrawalHandler.executeWithdrawal](../contracts/exchange/WithdrawalHandler.sol#L100)

### 3. Orders (Positions & Swaps)

```
User calls: ExchangeRouter.createOrder()
Keeper calls: OrderHandler.executeOrder(key, oracleParams)
Result: Position opened/closed or tokens swapped
```

**Handler:** [OrderHandler.executeOrder](../contracts/exchange/OrderHandler.sol#L244)

### 4. Liquidations

```
Keeper monitors positions for liquidation conditions
Keeper calls: LiquidationHandler.executeLiquidation(account, market, ...)
Result: Underwater position is closed
```

**Handler:** [LiquidationHandler.executeLiquidation](../contracts/exchange/LiquidationHandler.sol#L47)

### 5. Auto-Deleveraging (ADL)

```
Keeper monitors PnL ratios
Keeper calls: AdlHandler.updateAdlState(market, isLong, oracleParams)
Keeper calls: AdlHandler.executeAdl(account, market, ...)
Result: Profitable positions reduced to balance pool
```

**Handler:** [AdlHandler](../contracts/exchange/AdlHandler.sol)

### 6. GLV Operations

```
User calls: GlvRouter.createGlvDeposit() or createGlvWithdrawal()
Keeper calls: GlvDepositHandler.executeGlvDeposit() or GlvWithdrawalHandler.executeGlvWithdrawal()
Result: GLV tokens minted/burned
```

**Handlers:** [GlvDepositHandler](../contracts/exchange/GlvDepositHandler.sol#L53), [GlvWithdrawalHandler](../contracts/exchange/GlvWithdrawalHandler.sol#L54)

---

## Oracle System

Keepers provide oracle prices when executing orders. The [Oracle.sol](../contracts/oracle/Oracle.sol) contract validates these prices.

### Price Flow

```
1. Keeper fetches prices from off-chain oracle network (Chainlink Data Streams)
2. Keeper provides prices in OracleUtils.SetPricesParams struct
3. Oracle.setPrices() validates:
   - Signer authorization
   - Timestamp age (must be fresh)
   - Deviation from reference price (Chainlink feeds)
   - Sequencer uptime (for L2 chains)
4. Prices stored temporarily during execution
5. Oracle.clearAllPrices() after execution completes
```

### OracleUtils.SetPricesParams Structure

```solidity
struct SetPricesParams {
    address[] tokens;           // Tokens to set prices for
    address[] providers;        // Oracle providers (e.g., ChainlinkDataStreamProvider)
    bytes[] data;               // Encoded price data with signatures
}
```

### Key Oracle Contracts

| Contract | Purpose | Location |
|----------|---------|----------|
| [Oracle.sol](../contracts/oracle/Oracle.sol#L32) | Main oracle with price validation | contracts/oracle/ |
| [OracleUtils.sol](../contracts/oracle/OracleUtils.sol) | Helper functions | contracts/oracle/ |
| [ChainlinkDataStreamProvider.sol](../contracts/oracle/ChainlinkDataStreamProvider.sol) | Chainlink Data Streams | contracts/oracle/ |
| [ChainlinkPriceFeedProvider.sol](../contracts/oracle/ChainlinkPriceFeedProvider.sol) | Chainlink price feeds | contracts/oracle/ |

---

## Execution Fee System

Users pay an **execution fee** when creating requests. This fee compensates Keepers for gas costs.

### Fee Flow

```
1. User includes executionFee when creating request
2. Fee held in Vault (OrderVault, DepositVault, etc.)
3. Keeper executes request
4. GasUtils.payExecutionFee() calculates actual gas used
5. Keeper receives: gasUsed * gasPrice
6. User receives refund: executionFee - keeperPayment
```

### GasUtils Functions

| Function | Purpose | Location |
|----------|---------|----------|
| [validateExecutionGas](../contracts/gas/GasUtils.sol#L68) | Ensure sufficient gas provided | contracts/gas/GasUtils.sol |
| [payExecutionFee](../contracts/gas/GasUtils.sol#L127) | Pay keeper, refund user | contracts/gas/GasUtils.sol |
| [estimateExecuteOrderGasLimit](../contracts/gas/GasUtils.sol#L442) | Estimate gas for orders | contracts/gas/GasUtils.sol |
| [estimateExecuteDepositGasLimit](../contracts/gas/GasUtils.sol#L398) | Estimate gas for deposits | contracts/gas/GasUtils.sol |

### Gas Calculation

```solidity
// contracts/gas/GasUtils.sol:146
uint256 gasUsed = startingGas - gasleft();
uint256 executionFeeForKeeper = adjustGasUsage(dataStore, gasUsed) * tx.gasprice;
```

---

## Events Keepers Listen To

Keepers monitor events from the [EventEmitter](../contracts/event/EventEmitter.sol) contract:

| Event | Meaning | Action |
|-------|---------|--------|
| `DepositCreated` | New deposit request | Execute deposit |
| `WithdrawalCreated` | New withdrawal request | Execute withdrawal |
| `OrderCreated` | New order request | Execute order |
| `OrderUpdated` | Order parameters changed | Re-evaluate execution |
| `OrderFrozen` | Order failed, needs FROZEN_ORDER_KEEPER | Execute with special role |
| `ShiftCreated` | New shift request | Execute shift |
| `GlvDepositCreated` | New GLV deposit | Execute GLV deposit |
| `GlvWithdrawalCreated` | New GLV withdrawal | Execute GLV withdrawal |

### Event Structure

All events are emitted through EventEmitter with a generic structure:

```solidity
// contracts/event/EventEmitter.sol
event EventLog1(
    address msgSender,
    string eventName,
    string indexed eventNameHash,
    bytes32 indexed topic1,
    EventUtils.EventLogData eventData
);
```

## GMX Express (Gelato Integration)

GMX recently introduced **GMX Express** which uses Gelato for gasless execution:

### How It Works

```
1. User signs a payload off-chain (no wallet transaction)
2. Payload submitted via Gelato Relayer
3. GMX verifies and processes the transaction on-chain
```

### Benefits

- **No RPC bottlenecks**: Bypasses traditional RPC
- **Custom gas tokens**: Pay gas in USDC, WETH, etc.
- **One-Click Trading**: No wallet pop-ups after initial setup
- **Auto gas selection**: Automatically uses token with highest balance

### Supported Gas Tokens

| Network | Gas Tokens |
|---------|------------|
| Arbitrum | USDC, WETH |
| Avalanche | USDC, WAVAX |

---

## Key Configuration Parameters

Parameters keepers should be aware of (from [Keys.sol](../contracts/data/Keys.sol)):

### Gas Configuration

| Key | Purpose |
|-----|---------|
| `EXECUTION_GAS_FEE_BASE_AMOUNT_V2_1` | Base gas for fee calculation |
| `EXECUTION_GAS_FEE_PER_ORACLE_PRICE` | Additional gas per oracle price |
| `EXECUTION_GAS_FEE_MULTIPLIER_FACTOR` | Gas fee multiplier |
| `MIN_HANDLE_EXECUTION_ERROR_GAS` | Minimum gas for error handling |

### Oracle Configuration

| Key | Purpose |
|-----|---------|
| `MAX_ORACLE_PRICE_AGE` | Maximum age for oracle prices |
| `MAX_ORACLE_REF_PRICE_DEVIATION_FACTOR` | Max deviation from reference |
| `SEQUENCER_GRACE_DURATION` | Grace period after sequencer restart |

### Request Configuration

| Key | Purpose | Default |
|-----|---------|---------|
| `REQUEST_EXPIRATION_TIME` | Time before request can be cancelled | 300 seconds |

---

## Reference Implementation

For a working keeper implementation that can be adapted for GMX V2, see:

- [Buffer Keepers](https://github.com/Supurr-App/Buffer-Keepers) - A production keeper implementation for Buffer Finance that demonstrates similar patterns
