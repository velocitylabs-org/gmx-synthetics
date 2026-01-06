# GMX V2 Contract Architecture

This document explains the GMX V2 contract architecture in simple terms, with links to the actual code.

> **Video Tutorial:** For a detailed walkthrough, watch the [Cyfrin GMX Contract Architecture lesson](https://updraft.cyfrin.io/courses/gmx-perpetuals-trading/foundation/gmx-contract-architecture).

---

## Visual Overview

### How GMX V2 Protocol Works

![How GMX V2 Protocol Works](./assets/gmx_v2.png)

This diagram shows the **three main actors** in GMX V2:

1. **Trader (Left)** - Creates orders to swap, go long, or go short. Pays execution fee and can claim funding fees.

2. **Liquidity Provider (Right)** - Creates orders to deposit or withdraw long & short tokens. Pays execution fee.

3. **Keeper (Bottom)** - Off-chain bot that executes orders and sets oracle prices. Receives execution fee (with excess refunded to user).

**Key Insight:** Both traders and liquidity providers don't execute their actions directly. They create orders that Keepers execute later with fresh price data.

---

### Full Contract Architecture

![GMX V2 Contract Architecture](./assets/gmx_v2_contracts.png)

This diagram shows how contracts connect. The architecture is organized into **layers**:

| Layer | Contracts | Purpose |
|-------|-----------|---------|
| **User Entry** (Left) | ExchangeRouter, GlvRouter | Where users call functions like `createDeposit`, `createOrder` |
| **Handlers** (Center-Left) | DepositHandler, OrderHandler, etc. | Entry points for both Routers and Keepers |
| **Utils** (Center-Right) | DepositUtils, ExecuteOrderUtils, etc. | Core business logic for storing and executing orders |
| **Calculation Utils** (Right) | MarketUtils, PositionUtils, etc. | Calculate fees, PnL, token amounts |
| **Data Storage** (Far Right) | DataStore | Stores all orders, positions, and configuration |
| **Vaults** (Bottom-Left) | OrderVault, DepositVault, etc. | Temporarily hold user funds |
| **Gas** (Bottom-Center) | GasUtils | Pay Keepers and refund excess fees |
| **Tokens** (Bottom-Right) | MarketToken, GlvToken | LP tokens representing pool shares |

**Token Flow:**
- User sends tokens → **Vault** (temporary holding)
- Keeper executes → tokens move from Vault → **MarketToken** (permanent storage)
- For swaps/withdrawals → tokens move from MarketToken → **User**

---

## How GMX V2 Works (Simple Overview)

GMX V2 uses a **two-step process** for all operations:

```
Step 1: User creates a REQUEST (deposit, withdrawal, order)
Step 2: Keeper EXECUTES the request with oracle prices
```

**Why two steps?** To prevent front-running. Prices are fetched at execution time, not when the user submits the request.

---

## The Big Picture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER ACTIONS                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ROUTERS (User Entry Points)                                                │
│  ┌─────────────────┐  ┌─────────────────┐                                   │
│  │ ExchangeRouter  │  │   GlvRouter     │                                   │
│  │ - createDeposit │  │ - createGlvDep  │                                   │
│  │ - createOrder   │  │ - createGlvWith │                                   │
│  │ - createWithdraw│  └─────────────────┘                                   │
│  └─────────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  VAULTS (Hold Funds Temporarily)                                            │
│  ┌────────────┐ ┌──────────────────┐ ┌───────────────────┐ ┌─────────────┐  │
│  │ OrderVault │ │   DepositVault   │ │ WithdrawalVault   │ │  GlvVault   │  │
│  └────────────┘ └──────────────────┘ └───────────────────┘ └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  DATASTORE (Central Storage)                                                │
│  - Stores all pending requests (orders, deposits, withdrawals)              │
│  - Stores all positions                                                     │
│  - Stores all configuration                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        │                    KEEPER MONITORS                    │
        │              (Off-chain bot watches DataStore)        │
        └───────────────────────────┬───────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  HANDLERS (Keeper Entry Points)                                             │
│  ┌────────────────┐ ┌────────────────────┐ ┌──────────────┐                 │
│  │ DepositHandler │ │ WithdrawalHandler  │ │ OrderHandler │                 │
│  │ -executeDeposit│ │ -executeWithdrawal │ │ -executeOrder│                 │
│  └────────────────┘ └────────────────────┘ └──────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ORACLE (Price Validation)                                                  │
│  - Validates prices provided by Keeper                                      │
│  - Temporarily stores prices during execution                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  UTILS (Core Business Logic)                                                │
│  ┌───────────────────────┐  ┌─────────────────────────┐                     │
│  │ ExecuteDepositUtils   │  │  ExecuteWithdrawalUtils │                     │
│  ├───────────────────────┤  ├─────────────────────────┤                     │
│  │ ExecuteOrderUtils     │──│> IncreasePositionUtils  │                     │
│  │                       │  │> DecreasePositionUtils  │                     │
│  │                       │  │> SwapUtils              │                     │
│  └───────────────────────┘  └─────────────────────────┘                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Calculation Utils: MarketUtils, PositionUtils, SwapPricingUtils,    │    │
│  │                    PositionPricingUtils                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  TOKENS (Liquidity Representations)                                         │
│  ┌───────────────────────────────┐  ┌───────────────────────────────────┐   │
│  │ MarketToken (GM)              │  │ GlvToken (GLV)                    │   │
│  │ - ETH/USD pool shares         │  │ - Basket of multiple GM tokens    │   │
│  │ - BTC/USD pool shares         │  │ - WETH-USDC GLV                   │   │
│  │ - GMX/USD pool shares         │  │ - WBTC-USDC GLV                   │   │
│  └───────────────────────────────┘  └───────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Contract Categories

### 1. Routers (User Entry Points)

Users interact with GMX V2 through Router contracts. These are the **starting point** for all user actions.

| Contract | Purpose | Key Functions |
|----------|---------|---------------|
| [ExchangeRouter.sol](contracts/router/ExchangeRouter.sol) | Main entry for GM pools | [createDeposit](contracts/router/ExchangeRouter.sol#L135), [createWithdrawal](contracts/router/ExchangeRouter.sol#L167), [createOrder](contracts/router/ExchangeRouter.sol#L243) |
| [GlvRouter.sol](contracts/router/GlvRouter.sol) | Entry for GLV pools | [createGlvDeposit](contracts/router/GlvRouter.sol#L42), [createGlvWithdrawal](contracts/router/GlvRouter.sol#L77) |
| [Router.sol](contracts/router/Router.sol) | Token approval management | sendWnt, sendTokens |
| [SubaccountRouter.sol](contracts/router/SubaccountRouter.sol) | Subaccount management | - |

**Important:** Calling `createDeposit`, `createOrder`, etc. does NOT execute the action immediately. It only creates a request stored in DataStore for later execution by Keepers.

---

### 2. Vaults (Temporary Fund Holding)

When you create a request, your funds go into a Vault until a Keeper executes the request.

| Contract | Purpose | Location |
|----------|---------|----------|
| [DepositVault.sol](contracts/deposit/DepositVault.sol) | Holds deposit tokens | contracts/deposit/ |
| [WithdrawalVault.sol](contracts/withdrawal/WithdrawalVault.sol) | Holds GM tokens for withdrawal | contracts/withdrawal/ |
| [OrderVault.sol](contracts/order/OrderVault.sol) | Holds order collateral | contracts/order/ |
| [GlvVault.sol](contracts/glv/GlvVault.sol) | Holds GLV-related tokens | contracts/glv/ |

---

### 3. DataStore (Central State Storage)

ALL protocol state is stored in [DataStore.sol](contracts/data/DataStore.sol#L10) as key-value pairs.

**Why?** This allows upgrading logic contracts without migrating storage.

| Contract | Purpose |
|----------|---------|
| [DataStore.sol](contracts/data/DataStore.sol#L10) | Central key-value storage |
| [Keys.sol](contracts/data/Keys.sol#L7) | Key constants (150+ keys for configuration) |

---

### 4. Handlers (Keeper Entry Points)

Keepers are off-chain bots that monitor DataStore for pending requests. When conditions are met, they call Handler contracts to execute.

| Contract | Purpose | Key Function |
|----------|---------|--------------|
| [DepositHandler.sol](contracts/exchange/DepositHandler.sol) | Execute deposits | [executeDeposit](contracts/exchange/DepositHandler.sol#L100) |
| [WithdrawalHandler.sol](contracts/exchange/WithdrawalHandler.sol) | Execute withdrawals | [executeWithdrawal](contracts/exchange/WithdrawalHandler.sol#L100) |
| [OrderHandler.sol](contracts/exchange/OrderHandler.sol) | Execute orders | [executeOrder](contracts/exchange/OrderHandler.sol#L244) |
| [ShiftHandler.sol](contracts/exchange/ShiftHandler.sol) | Execute shifts | [executeShift](contracts/exchange/ShiftHandler.sol#L87) |
| [LiquidationHandler.sol](contracts/exchange/LiquidationHandler.sol) | Execute liquidations | [executeLiquidation](contracts/exchange/LiquidationHandler.sol#L47) |
| [AdlHandler.sol](contracts/exchange/AdlHandler.sol) | Auto-deleveraging | [executeAdl](contracts/exchange/AdlHandler.sol#L90) |
| [GlvDepositHandler.sol](contracts/exchange/GlvDepositHandler.sol) | Execute GLV deposits | [executeGlvDeposit](contracts/exchange/GlvDepositHandler.sol#L53) |
| [GlvWithdrawalHandler.sol](contracts/exchange/GlvWithdrawalHandler.sol) | Execute GLV withdrawals | [executeGlvWithdrawal](contracts/exchange/GlvWithdrawalHandler.sol#L54) |

---

### 5. Oracle (Price System)

The [Oracle.sol](contracts/oracle/Oracle.sol#L32) contract validates and temporarily stores prices during execution.

**Flow:**
1. Keeper fetches prices from off-chain oracle network
2. Keeper provides prices when calling execute functions
3. Oracle validates prices (signers, timestamp, deviation)
4. Prices stored temporarily for the execution
5. Prices cleared after execution

---

### 6. Utils (Core Business Logic)

Utils contracts contain ALL the business logic. They are stateless and read/write to DataStore.

#### Storage Utils (Create & Store Requests)
| Contract | Purpose |
|----------|---------|
| [DepositUtils.sol](contracts/deposit/DepositUtils.sol#L25) | Create deposit requests |
| [WithdrawalUtils.sol](contracts/withdrawal/WithdrawalUtils.sol) | Create withdrawal requests |
| [OrderUtils.sol](contracts/order/OrderUtils.sol) | Create order requests |

#### Execution Utils (Execute Requests)
| Contract | Purpose | Key Function |
|----------|---------|--------------|
| [ExecuteDepositUtils.sol](contracts/deposit/ExecuteDepositUtils.sol#L30) | Execute deposits | [executeDeposit](contracts/deposit/ExecuteDepositUtils.sol#L84) |
| [ExecuteWithdrawalUtils.sol](contracts/withdrawal/ExecuteWithdrawalUtils.sol#L27) | Execute withdrawals | [executeWithdrawal](contracts/withdrawal/ExecuteWithdrawalUtils.sol#L77) |
| [ExecuteOrderUtils.sol](contracts/order/ExecuteOrderUtils.sol#L24) | Execute orders | [executeOrder](contracts/order/ExecuteOrderUtils.sol#L32) |

#### Order Type Utils (Called by ExecuteOrderUtils)
| Contract | Purpose | Key Function |
|----------|---------|--------------|
| [IncreaseOrderUtils.sol](contracts/order/IncreaseOrderUtils.sol) | Open/increase positions | [processOrder](contracts/order/IncreaseOrderUtils.sol#L18) |
| [DecreaseOrderUtils.sol](contracts/order/DecreaseOrderUtils.sol) | Close/decrease positions | [processOrder](contracts/order/DecreaseOrderUtils.sol#L29) |
| [SwapOrderUtils.sol](contracts/order/SwapOrderUtils.sol) | Execute swaps | [processOrder](contracts/order/SwapOrderUtils.sol#L25) |

#### Position Utils
| Contract | Purpose | Key Function |
|----------|---------|--------------|
| [IncreasePositionUtils.sol](contracts/position/IncreasePositionUtils.sol#L18) | Open/increase positions | [increasePosition](contracts/position/IncreasePositionUtils.sol#L55) |
| [DecreasePositionUtils.sol](contracts/position/DecreasePositionUtils.sol#L22) | Close/decrease positions | [decreasePosition](contracts/position/DecreasePositionUtils.sol#L63) |
| [PositionUtils.sol](contracts/position/PositionUtils.sol) | Position calculations | [getPositionPnlUsd](contracts/position/PositionUtils.sol#L180), [isPositionLiquidatable](contracts/position/PositionUtils.sol#L316) |

#### Swap Utils
| Contract | Purpose | Key Function |
|----------|---------|--------------|
| [SwapUtils.sol](contracts/swap/SwapUtils.sol#L17) | Swap execution | [swap](contracts/swap/SwapUtils.sol#L77) |

#### Calculation Utils
| Contract | Purpose | Key Function |
|----------|---------|--------------|
| [MarketUtils.sol](contracts/market/MarketUtils.sol#L29) | Market calculations | [getMarketTokenPrice](contracts/market/MarketUtils.sol#L157), [getPoolValueInfo](contracts/market/MarketUtils.sol#L298) |
| [SwapPricingUtils.sol](contracts/pricing/SwapPricingUtils.sol) | Swap price impact | [getPriceImpactUsd](contracts/pricing/SwapPricingUtils.sol#L109) |
| [PositionPricingUtils.sol](contracts/pricing/PositionPricingUtils.sol) | Position price impact | [getPriceImpactUsd](contracts/pricing/PositionPricingUtils.sol#L161) |

#### Gas Utils
| Contract | Purpose |
|----------|---------|
| [GasUtils.sol](contracts/gas/GasUtils.sol) | Execution fee payment/refund to Keepers |

---

### 7. Store Utils (Serialization)

Each major struct has a `*StoreUtils` contract for serializing/deserializing to DataStore.

| Contract | Purpose |
|----------|---------|
| [OrderStoreUtils.sol](contracts/order/OrderStoreUtils.sol) | Store/retrieve orders ([get](contracts/order/OrderStoreUtils.sol#L46), [set](contracts/order/OrderStoreUtils.sol#L155)) |
| [PositionStoreUtils.sol](contracts/position/PositionStoreUtils.sol) | Store/retrieve positions ([get](contracts/position/PositionStoreUtils.sol#L34), [set](contracts/position/PositionStoreUtils.sol#L99)) |
| [DepositStoreUtils.sol](contracts/deposit/DepositStoreUtils.sol) | Store/retrieve deposits |
| [WithdrawalStoreUtils.sol](contracts/withdrawal/WithdrawalStoreUtils.sol) | Store/retrieve withdrawals |
| [MarketStoreUtils.sol](contracts/market/MarketStoreUtils.sol) | Store/retrieve markets |
| [GlvStoreUtils.sol](contracts/glv/GlvStoreUtils.sol) | Store/retrieve GLVs |

---

### 8. Token Contracts

| Contract | Purpose |
|----------|---------|
| [MarketToken.sol](contracts/market/MarketToken.sol) | LP token for GM pools (minted on deposit, burned on withdrawal) |
| [GlvToken.sol](contracts/glv/GlvToken.sol) | LP token for GLV pools (basket of GM tokens) |

---

### 9. Reader Contracts (View Functions)

For reading data without modifying state.

| Contract | Purpose | Key Functions |
|----------|---------|---------------|
| [Reader.sol](contracts/reader/Reader.sol) | Read positions, markets, prices | [getAccountPositions](contracts/reader/Reader.sol#L69), [getMarketTokenPrice](contracts/reader/Reader.sol#L193) |
| [GlvReader.sol](contracts/reader/GlvReader.sol) | Read GLV data | [getGlvTokenPrice](contracts/reader/GlvReader.sol#L42), [getGlvInfoList](contracts/reader/GlvReader.sol#L99) |

---

### 10. Factory Contracts

| Contract | Purpose | Key Function |
|----------|---------|--------------|
| [MarketFactory.sol](contracts/market/MarketFactory.sol) | Create new markets | [createMarket](contracts/market/MarketFactory.sol#L41) |
| [GlvFactory.sol](contracts/glv/GlvFactory.sol) | Create new GLVs | [createGlv](contracts/glv/GlvFactory.sol#L30) |

---

## Key Data Structures

### Order ([Order.sol](contracts/order/Order.sol#L9))

```solidity
// Line 12-34: Order types
enum OrderType {
    MarketSwap,           // Swap at current price
    LimitSwap,            // Swap when price target reached
    MarketIncrease,       // Open/increase position at market
    LimitIncrease,        // Open/increase at limit price
    MarketDecrease,       // Close/decrease at market
    LimitDecrease,        // Take profit
    StopLossDecrease,     // Stop loss
    Liquidation,          // Forced closure
    StopIncrease          // Open when trigger price reached
}

// Line 55-60: Main struct
struct Props {
    Addresses addresses;
    Numbers numbers;
    Flags flags;
}
```

### Position ([Position.sol](contracts/position/Position.sol#L31))

```solidity
// Line 38-42: Main struct
struct Props {
    Addresses addresses;  // account, market, collateralToken
    Numbers numbers;      // sizeInUsd, sizeInTokens, collateralAmount, etc.
    Flags flags;          // isLong
}

// Line 201: Position key calculation
function getPositionKey(account, market, collateralToken, isLong) returns (bytes32)
```

### Market ([Market.sol](contracts/market/Market.sol#L31))

```solidity
// Line 37-42: Market struct
struct Props {
    address marketToken;   // LP token address
    address indexToken;    // Asset whose price is tracked
    address longToken;     // Collateral for longs
    address shortToken;    // Collateral for shorts
}
```

### Deposit ([Deposit.sol](contracts/deposit/Deposit.sol#L7))

```solidity
// Line 21-26: Main struct
struct Props {
    Addresses addresses;  // account, receiver, market, tokens, swapPaths
    Numbers numbers;      // amounts, minMarketTokens, executionFee
    Flags flags;          // shouldUnwrapNativeToken
}
```

### Withdrawal ([Withdrawal.sol](contracts/withdrawal/Withdrawal.sol#L9))

```solidity
// Line 23-28: Main struct
struct Props {
    Addresses addresses;  // account, receiver, market, swapPaths
    Numbers numbers;      // marketTokenAmount, minAmounts, executionFee
    Flags flags;          // shouldUnwrapNativeToken
}
```

---

## GLV System (Multi-Market Liquidity)

GLV (GMX Liquidity Vault) holds multiple GM tokens with the same long/short tokens.

### GLV Contracts

| Contract | Purpose |
|----------|---------|
| [Glv.sol](contracts/glv/Glv.sol#L4) | GLV struct definition |
| [GlvUtils.sol](contracts/glv/GlvUtils.sol) | GLV calculations |
| [GlvDeposit.sol](contracts/glv/glvDeposit/GlvDeposit.sol) | GLV deposit struct |
| [GlvDepositUtils.sol](contracts/glv/glvDeposit/GlvDepositUtils.sol) | GLV deposit logic |
| [ExecuteGlvDepositUtils.sol](contracts/glv/glvDeposit/ExecuteGlvDepositUtils.sol) | GLV deposit execution |
| [GlvWithdrawal.sol](contracts/glv/glvWithdrawal/GlvWithdrawal.sol) | GLV withdrawal struct |
| [GlvWithdrawalUtils.sol](contracts/glv/glvWithdrawal/GlvWithdrawalUtils.sol) | GLV withdrawal logic |
| [GlvShift.sol](contracts/glv/glvShift/GlvShift.sol) | GLV shift struct |
| [GlvShiftUtils.sol](contracts/glv/glvShift/GlvShiftUtils.sol) | GLV shift logic (rebalancing) |

---

## Workflow Examples

### 1. Adding Liquidity to a GM Pool

```
User                          System                              Keeper
  │                              │                                   │
  │ 1. sendTokens to DepositVault│                                   │
  │─────────────────────────────>│                                   │
  │                              │                                   │
  │ 2. createDeposit             │                                   │
  │─────────────────────────────>│                                   │
  │                              │ 3. Store deposit in DataStore     │
  │                              │                                   │
  │                              │                                   │
  │                              │ 4. Monitor DataStore              │
  │                              │<──────────────────────────────────│
  │                              │                                   │
  │                              │ 5. executeDeposit (with prices)   │
  │                              │<──────────────────────────────────│
  │                              │                                   │
  │ 6. Receive GM tokens         │                                   │
  │<─────────────────────────────│                                   │
```

**Code path:**
1. [ExchangeRouter.createDeposit](contracts/router/ExchangeRouter.sol#L135)
2. [DepositHandler.executeDeposit](contracts/exchange/DepositHandler.sol#L100)
3. [ExecuteDepositUtils.executeDeposit](contracts/deposit/ExecuteDepositUtils.sol#L84)
4. [MarketToken](contracts/market/MarketToken.sol) (mint)

### 2. Opening a Position

```
User                          System                              Keeper
  │                              │                                   │
  │ 1. sendTokens to OrderVault  │                                   │
  │─────────────────────────────>│                                   │
  │                              │                                   │
  │ 2. createOrder               │                                   │
  │─────────────────────────────>│                                   │
  │                              │ 3. Store order in DataStore       │
  │                              │                                   │
  │                              │ 4. Monitor DataStore              │
  │                              │<──────────────────────────────────│
  │                              │                                   │
  │                              │ 5. executeOrder (with prices)     │
  │                              │<──────────────────────────────────│
  │                              │                                   │
  │ 6. Position created          │                                   │
```

**Code path:**
1. [ExchangeRouter.createOrder](contracts/router/ExchangeRouter.sol#L243)
2. [OrderHandler.executeOrder](contracts/exchange/OrderHandler.sol#L244)
3. [ExecuteOrderUtils.executeOrder](contracts/order/ExecuteOrderUtils.sol#L32)
4. [IncreaseOrderUtils.processOrder](contracts/order/IncreaseOrderUtils.sol#L18)
5. [IncreasePositionUtils.increasePosition](contracts/position/IncreasePositionUtils.sol#L55)

### 3. Swapping Tokens

```
User                          System                              Keeper
  │                              │                                   │
  │ 1. sendTokens to OrderVault  │                                   │
  │─────────────────────────────>│                                   │
  │                              │                                   │
  │ 2. createOrder (MarketSwap)  │                                   │
  │─────────────────────────────>│                                   │
  │                              │ 3. Store order in DataStore       │
  │                              │                                   │
  │                              │ 4. executeOrder (with prices)     │
  │                              │<──────────────────────────────────│
  │                              │                                   │
  │ 5. Receive swapped tokens    │                                   │
  │<─────────────────────────────│                                   │
```

**Code path:**
1. [ExchangeRouter.createOrder](contracts/router/ExchangeRouter.sol#L243)
2. [OrderHandler.executeOrder](contracts/exchange/OrderHandler.sol#L244)
3. [ExecuteOrderUtils.executeOrder](contracts/order/ExecuteOrderUtils.sol#L32)
4. [SwapOrderUtils.processOrder](contracts/order/SwapOrderUtils.sol#L25)
5. [SwapUtils.swap](contracts/swap/SwapUtils.sol#L77)

---

## Directory Structure

```
contracts/
├── router/             # User entry points
│   ├── ExchangeRouter.sol
│   ├── GlvRouter.sol
│   ├── Router.sol
│   └── SubaccountRouter.sol
│
├── exchange/           # Keeper handlers
│   ├── DepositHandler.sol
│   ├── WithdrawalHandler.sol
│   ├── OrderHandler.sol
│   ├── ShiftHandler.sol
│   ├── LiquidationHandler.sol
│   ├── AdlHandler.sol
│   ├── GlvDepositHandler.sol
│   ├── GlvWithdrawalHandler.sol
│   └── GlvShiftHandler.sol
│
├── data/               # Central storage
│   ├── DataStore.sol
│   └── Keys.sol
│
├── deposit/            # Deposit logic
│   ├── Deposit.sol
│   ├── DepositUtils.sol
│   ├── ExecuteDepositUtils.sol
│   ├── DepositStoreUtils.sol
│   └── DepositVault.sol
│
├── withdrawal/         # Withdrawal logic
│   ├── Withdrawal.sol
│   ├── WithdrawalUtils.sol
│   ├── ExecuteWithdrawalUtils.sol
│   ├── WithdrawalStoreUtils.sol
│   └── WithdrawalVault.sol
│
├── order/              # Order logic
│   ├── Order.sol
│   ├── OrderUtils.sol
│   ├── ExecuteOrderUtils.sol
│   ├── IncreaseOrderUtils.sol
│   ├── DecreaseOrderUtils.sol
│   ├── SwapOrderUtils.sol
│   ├── BaseOrderUtils.sol
│   ├── OrderStoreUtils.sol
│   └── OrderVault.sol
│
├── position/           # Position logic
│   ├── Position.sol
│   ├── PositionUtils.sol
│   ├── IncreasePositionUtils.sol
│   ├── DecreasePositionUtils.sol
│   └── PositionStoreUtils.sol
│
├── market/             # Market logic
│   ├── Market.sol
│   ├── MarketUtils.sol
│   ├── MarketToken.sol
│   ├── MarketFactory.sol
│   └── MarketStoreUtils.sol
│
├── swap/               # Swap logic
│   └── SwapUtils.sol
│
├── pricing/            # Price impact calculations
│   ├── SwapPricingUtils.sol
│   └── PositionPricingUtils.sol
│
├── oracle/             # Oracle system
│   └── Oracle.sol
│
├── gas/                # Gas/fee handling
│   └── GasUtils.sol
│
├── glv/                # GLV system
│   ├── Glv.sol
│   ├── GlvUtils.sol
│   ├── GlvToken.sol
│   ├── GlvFactory.sol
│   ├── GlvVault.sol
│   ├── GlvStoreUtils.sol
│   ├── glvDeposit/
│   │   ├── GlvDeposit.sol
│   │   ├── GlvDepositUtils.sol
│   │   └── ExecuteGlvDepositUtils.sol
│   ├── glvWithdrawal/
│   │   ├── GlvWithdrawal.sol
│   │   └── GlvWithdrawalUtils.sol
│   └── glvShift/
│       ├── GlvShift.sol
│       └── GlvShiftUtils.sol
│
├── reader/             # View functions
│   ├── Reader.sol
│   └── GlvReader.sol
│
└── event/              # Event emission
    └── EventEmitter.sol
```

---

## Key Takeaways

1. **Two-Step Execution**: Users create requests, Keepers execute them with oracle prices
2. **Modular Design**: State (DataStore) separated from logic (Utils)
3. **Vaults as Buffers**: Funds held temporarily between creation and execution
4. **Utils = Business Logic**: All core logic in stateless Utils contracts
5. **StoreUtils Pattern**: Each struct has a StoreUtils for DataStore serialization
6. **Routers vs Handlers**: Routers for users, Handlers for Keepers
