# GMX V2 Local Deployment Guide

This guide explains how to deploy GMX V2 Synthetics locally for development and testing.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start (In-Memory)](#quick-start-in-memory)
3. [Persistent Local Node](#persistent-local-node)
4. [Fork Mainnet](#fork-mainnet)
5. [Test Script: SHORT Position](#test-script-short-position)
6. [Understanding the Test Flow](#understanding-the-test-flow)
7. [Key Concepts](#key-concepts)
8. [Available Test Markets](#available-test-markets)
9. [Utility Functions](#utility-functions)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Node.js Version

```bash
# Required: Node.js v20 (check .nvmrc)
nvm use 20

# Verify
node --version  # Should output v20.x.x
```

### Install Dependencies

```bash
cd gmx-synthetics
npm install
```

### Compile Contracts

```bash
npx hardhat compile
```

> **Note:** First compilation takes several minutes (300+ contracts).

---

## Quick Start (In-Memory)

The **simplest approach** - no separate node needed. Hardhat creates an in-memory blockchain that exists only during script execution.

### Run a Script

```bash
npx hardhat run scripts/test-short-position.ts
```

### Run Tests

```bash
# Run all tests
npm test

# Run specific test file
npx hardhat test test/exchange/MarketIncreaseOrder.ts

# Run with verbose output
npx hardhat test --verbose
```

### Interactive Console

```bash
npx hardhat console --network hardhat
```

Then in the console:

```javascript
// Deploy all contracts
await hre.deployments.fixture();

// Get contracts
const dataStore = await ethers.getContract("DataStore");
const exchangeRouter = await ethers.getContract("ExchangeRouter");
const reader = await ethers.getContract("Reader");
const wnt = await ethers.getContract("WETH");
const usdc = await ethers.getContract("USDC");

// Get markets
const markets = await reader.getMarkets(dataStore.address, 0, 10);
console.log("Markets:", markets.length);
```

### Pros & Cons

| Pros | Cons |
|------|------|
| Simple - one command | State lost after script ends |
| Fast startup | Can't run multiple scripts against same state |
| No port conflicts | No JSON-RPC endpoint for external tools |

---

## Persistent Local Node

Use this when you need to:
- Run multiple scripts against the same deployed contracts
- Connect external tools (like a frontend)
- Debug with longer-running sessions

### Step 1: Start Local Node

```bash
# Terminal 1
npx hardhat node
```

This starts a local Ethereum node at `http://127.0.0.1:8545`

### Step 2: Deploy Contracts

```bash
# Terminal 2
npx hardhat deploy --network localhost
```

### Step 3: Run Scripts

```bash
# Terminal 2
npx hardhat run scripts/test-short-position.ts --network localhost
```

### Step 4: Interactive Console (Optional)

```bash
# Terminal 2
npx hardhat console --network localhost
```

### Pros & Cons

| Pros | Cons |
|------|------|
| State persists between scripts | Two terminals needed |
| JSON-RPC endpoint available | Slower initial deploy |
| Can connect frontend/tools | Must restart node to reset state |

---

## Fork Mainnet

Test against real Arbitrum/Avalanche state (real prices, real liquidity):

```bash
# Fork Arbitrum
npm run fork:arbitrum

# Fork Avalanche
npm run fork:avalanche

# Fork Avalanche Fuji testnet
npm run fork:avalancheFuji
```

> **Note:** Forking requires network access and may be slower.

---

## Test Script: SHORT Position

We have a test script that demonstrates the complete trading flow:

**Location:** `scripts/test-short-position.ts`

### What It Does

1. Deploys all GMX contracts (~160 contracts)
2. Adds liquidity to ETH/USD market
3. Opens a SHORT position (betting ETH will drop)
4. Displays position details
5. Closes the position with a different price (simulating profit)

### Run It

```bash
npx hardhat run scripts/test-short-position.ts
```

### Expected Output

```
╔═══════════════════════════════════════════════════════════════╗
║          GMX V2 - SHORT POSITION TEST SCRIPT                  ║
╚═══════════════════════════════════════════════════════════════╝

📦 Step 1: Deploying all contracts...
   ✅ Contracts deployed successfully!

💰 Step 2: Adding liquidity to ETH/USD market...
   ✅ Liquidity added: 1,000 ETH + $5,000,000 USDC

📉 Step 4: Opening SHORT position on ETH/USD...
   - Direction: SHORT
   - Collateral: 5,000 USDC
   - Position Size: $50,000 USD
   ✅ Position opened! (User positions: 1)

🔍 Step 5: Position details...
   - Size (USD): $50,000
   - Size (Tokens): 10.0 ETH
   - Collateral: 5000.0 USDC

🔒 Step 7: Closing the SHORT position...
   ✅ Position closed! (User positions: 0)
```

---

## Understanding the Test Flow

### GMX Two-Step Execution Model

GMX uses a **keeper-based execution** model to prevent front-running:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   USER          │     │   DATASTORE     │     │   KEEPER        │
│                 │     │                 │     │                 │
│  createOrder()  │────▶│  Store Order    │────▶│  executeOrder() │
│                 │     │                 │     │  with prices    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

1. **User creates request** (deposit/order/withdrawal)
2. **Request stored** in DataStore
3. **Keeper executes** with signed oracle prices
4. **State updated**, tokens transferred

### In Tests/Scripts

We simulate the keeper by calling execute functions directly with mock oracle prices:

```typescript
// Create order (user action)
await createOrder(fixture, {
  market: ethUsdMarket,
  orderType: OrderType.MarketIncrease,
  isLong: false,  // SHORT
  // ...
});

// Execute order (simulated keeper action)
await executeOrder(fixture, {
  ...getExecuteParams(fixture, { tokens: [wnt, usdc] }),
});
```

---

## Key Concepts

### Order Types

| Type | Value | Description |
|------|-------|-------------|
| `MarketSwap` | 0 | Instant swap at market price |
| `LimitSwap` | 1 | Swap when price target reached |
| `MarketIncrease` | 2 | Open/increase position at market |
| `LimitIncrease` | 3 | Open/increase at limit price |
| `MarketDecrease` | 4 | Close/decrease at market |
| `LimitDecrease` | 5 | Take profit order |
| `StopLossDecrease` | 6 | Stop loss order |
| `Liquidation` | 7 | Forced closure (keeper only) |
| `StopIncrease` | 8 | Open when trigger price reached |

### Position Direction

| isLong | Direction | Profits When |
|--------|-----------|--------------|
| `true` | LONG | Price goes UP |
| `false` | SHORT | Price goes DOWN |

### Price Precision

All prices in GMX use **30 decimals** precision:

```typescript
import { expandDecimals, decimalToFloat } from "../utils/math";

// Token amounts (use token's decimals)
expandDecimals(1, 18);      // 1 ETH (18 decimals)
expandDecimals(5000, 6);    // 5000 USDC (6 decimals)

// USD values (always 30 decimals)
decimalToFloat(50000);      // $50,000 position size
```

---

## Available Test Markets

After `deployFixture()`, these markets are available:

| Variable | Index Token | Long Token | Short Token | Description |
|----------|-------------|------------|-------------|-------------|
| `ethUsdMarket` | WETH | WETH | USDC | Standard ETH perp |
| `ethUsdtMarket` | WETH | WETH | USDT | ETH with USDT |
| `btcUsdMarket` | WBTC | WBTC | USDC | Standard BTC perp |
| `solUsdMarket` | SOL (synthetic) | WETH | USDC | Synthetic SOL |
| `ethUsdSpotOnlyMarket` | None | WETH | USDC | Swap only |
| `ethUsdSingleTokenMarket` | WETH | USDC | USDC | Single collateral |
| `ethUsdSingleTokenMarket2` | WETH | WETH | WETH | WETH only |
| `btcUsdSingleTokenMarket` | WBTC | USDC | USDC | BTC single token |

### Access Markets

```typescript
const fixture = await deployFixture();
const {
  ethUsdMarket,
  btcUsdMarket,
  solUsdMarket
} = fixture.contracts;

console.log("ETH/USD Market:", ethUsdMarket.marketToken);
```

---

## Utility Functions

### Location: `utils/`

| File | Purpose | Key Functions |
|------|---------|---------------|
| `fixture.ts` | Deploy all contracts | `deployFixture()` |
| `deposit.ts` | Liquidity operations | `handleDeposit()`, `createDeposit()`, `executeDeposit()` |
| `order.ts` | Trading operations | `handleOrder()`, `createOrder()`, `executeOrder()` |
| `exchange.ts` | Oracle params | `getExecuteParams()` |
| `position.ts` | Position queries | `getPositionCount()`, `getAccountPositionCount()` |
| `math.ts` | Number formatting | `expandDecimals()`, `decimalToFloat()` |
| `prices.ts` | Default test prices | `prices.wnt`, `prices.usdc`, etc. |

### Common Patterns

```typescript
import { deployFixture } from "../utils/fixture";
import { handleDeposit } from "../utils/deposit";
import { createOrder, executeOrder, OrderType } from "../utils/order";
import { getExecuteParams } from "../utils/exchange";
import { expandDecimals, decimalToFloat } from "../utils/math";

// Deploy everything
const fixture = await deployFixture();

// Add liquidity
await handleDeposit(fixture, {
  create: {
    market: ethUsdMarket,
    longTokenAmount: expandDecimals(100, 18),   // 100 ETH
    shortTokenAmount: expandDecimals(500000, 6), // 500k USDC
  },
});

// Create and execute order
await createOrder(fixture, {
  market: ethUsdMarket,
  initialCollateralToken: usdc,
  initialCollateralDeltaAmount: expandDecimals(1000, 6),
  sizeDeltaUsd: decimalToFloat(10000),
  orderType: OrderType.MarketIncrease,
  isLong: false,
});

await executeOrder(fixture, {
  ...getExecuteParams(fixture, { tokens: [wnt, usdc] }),
});
```

---

## Troubleshooting

### Compilation Issues

```bash
# Clear cache and recompile
npx hardhat clean
npx hardhat compile
```

### Memory Issues

```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=8192" npx hardhat test
```

### Contract Size Issues

```bash
# Check contract sizes (must be < 24KB)
npx hardhat measure-contract-sizes
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `INVALID_ARGUMENT` | Wrong address format | Use `.address` property on contracts |
| `EmptyChainlinkPriceFeed` | Missing price feed | Ensure token has price feed configured |
| `InsufficientPoolAmount` | Not enough liquidity | Add more liquidity via `handleDeposit()` |
| `OrderNotFound` | Order already executed | Check order key exists before execute |

### Debug Tips

```typescript
// Check order count
const orderCount = await getOrderCount(dataStore);
console.log("Pending orders:", orderCount);

// Check positions
const positions = await reader.getAccountPositions(
  dataStore.address,
  user0.address,
  0,
  10
);
console.log("Positions:", positions.length);

// Get specific order
const orderKeys = await getOrderKeys(dataStore, 0, 10);
const order = await reader.getOrder(dataStore.address, orderKeys[0]);
console.log("Order:", order);
```

---

## Quick Reference

### Commands Cheat Sheet

```bash
# Compile
npx hardhat compile

# Test (all)
npm test

# Test (specific)
npx hardhat test test/exchange/MarketIncreaseOrder.ts

# Run script (in-memory)
npx hardhat run scripts/test-short-position.ts

# Start local node
npx hardhat node

# Deploy to local node
npx hardhat deploy --network localhost

# Run script on local node
npx hardhat run scripts/test-short-position.ts --network localhost

# Console (in-memory)
npx hardhat console --network hardhat

# Console (local node)
npx hardhat console --network localhost

# Fork Arbitrum
npm run fork:arbitrum
```

### File Locations

```
gmx-synthetics/
├── scripts/
│   └── test-short-position.ts    # Our test script
├── utils/
│   ├── fixture.ts                # Deploy helper
│   ├── deposit.ts                # Deposit functions
│   ├── order.ts                  # Order functions
│   └── math.ts                   # Number utilities
├── test/exchange/                # Example tests
│   ├── MarketIncreaseOrder.ts
│   ├── MarketDecreaseOrder.ts
│   └── Deposit.ts
└── config/
    ├── tokens.ts                 # Token definitions
    └── markets.ts                # Market parameters
```
