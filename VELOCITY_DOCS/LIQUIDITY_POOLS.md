# Liquidity Pools - Already Set Up

This document explains that liquidity pool infrastructure is **already built** in GMX. You don't need to build anything new for basic LP functionality.

---

## Table of Contents

1. [TL;DR - What You Need to Know](#tldr---what-you-need-to-know)
2. [How Liquidity Pools Work](#how-liquidity-pools-work)
3. [What's Already Built](#whats-already-built)
4. [Adding Liquidity (For MVP)](#adding-liquidity-for-mvp)
5. [LP Tokens Explained](#lp-tokens-explained)
6. [The Two-Step Process](#the-two-step-process)
7. [GLV (Advanced - Not Needed for MVP)](#glv-advanced---not-needed-for-mvp)
8. [Summary](#summary)

---

## TL;DR - What You Need to Know

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   DO YOU NEED TO BUILD LIQUIDITY POOL CONTRACTS?            │
│                                                             │
│                         NO ❌                                │
│                                                             │
│   Everything is already built:                              │
│   ✅ Deposit contracts (add liquidity)                      │
│   ✅ Withdrawal contracts (remove liquidity)                │
│   ✅ LP token contracts (MarketToken)                       │
│   ✅ Fee distribution                                       │
│   ✅ Pool accounting                                        │
│                                                             │
│   What you need to do:                                      │
│   1. Deploy the contracts (standard GMX deployment)         │
│   2. Seed liquidity (deposit USDC into your market)         │
│   3. That's it!                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## How Liquidity Pools Work

### The Basic Concept

```
LIQUIDITY PROVIDERS (LPs)                    TRADERS
        │                                        │
        │ Deposit USDC                           │ Open SHORT on BRL
        ▼                                        ▼
┌─────────────────────────────────────────────────────────────┐
│                      BRL/USD POOL                            │
│                                                              │
│   Pool Balance: $5,000,000 USDC                             │
│                                                              │
│   ┌─────────────────┐    ┌─────────────────┐               │
│   │   LP Deposits   │    │  Trader Profits │               │
│   │   + Trading Fees│    │  (paid from pool)│               │
│   └─────────────────┘    └─────────────────┘               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
        │                                        │
        ▼                                        ▼
   Get LP Tokens                           Position Opened
   (MarketTokens)
```

### What LPs Provide and Receive

| LPs Provide | LPs Receive |
|-------------|-------------|
| USDC (liquidity) | MarketTokens (LP tokens) |
| Risk capital | Trading fees |
| | Borrowing fees |
| | Funding fees (sometimes) |

### The Risk for LPs

LPs take the **opposite side** of traders:
- If traders profit → LPs lose
- If traders lose → LPs gain
- Plus LPs always earn fees

This is why LPs are compensated with fees - they're providing a service and taking risk.

---

## What's Already Built

### Contracts That Handle Liquidity

| Contract | Location | Purpose |
|----------|----------|---------|
| `ExchangeRouter` | `contracts/router/ExchangeRouter.sol` | Entry point for deposits/withdrawals |
| `DepositHandler` | `contracts/exchange/DepositHandler.sol` | Executes deposits |
| `DepositVault` | `contracts/deposit/DepositVault.sol` | Holds tokens during deposit process |
| `WithdrawalHandler` | `contracts/exchange/WithdrawalHandler.sol` | Executes withdrawals |
| `WithdrawalVault` | `contracts/withdrawal/WithdrawalVault.sol` | Holds tokens during withdrawal |
| `MarketToken` | `contracts/market/MarketToken.sol` | ERC20 LP token for each market |
| `MarketUtils` | `contracts/market/MarketUtils.sol` | Pool calculations |

### Functions Already Available

```solidity
// Adding liquidity
ExchangeRouter.createDeposit(...)     // LP initiates deposit
DepositHandler.executeDeposit(...)    // Keeper executes

// Removing liquidity
ExchangeRouter.createWithdrawal(...)  // LP initiates withdrawal
WithdrawalHandler.executeWithdrawal(...)  // Keeper executes

// Reading pool state
Reader.getMarket(...)                 // Get market info
Reader.getMarketTokenPrice(...)       // Get LP token price
Reader.getPoolAmount(...)             // Get pool balances
```

---

## Adding Liquidity (For MVP)

### Option 1: Script (Simplest for MVP)

You can seed liquidity with a simple script:

```typescript
// scripts/seed-liquidity.ts
import { ethers } from "hardhat";
import { expandDecimals } from "../utils/math";

async function main() {
  const [deployer] = await ethers.getSigners();

  // Get contracts
  const usdc = await ethers.getContract("USDC");
  const depositVault = await ethers.getContract("DepositVault");
  const exchangeRouter = await ethers.getContract("ExchangeRouter");
  const depositHandler = await ethers.getContract("DepositHandler");

  const brlUsdMarket = "0x..."; // Your BRL/USD market address
  const depositAmount = expandDecimals(100_000, 6); // $100,000 USDC

  console.log("Seeding liquidity...");

  // 1. Approve router to spend USDC
  await usdc.approve(exchangeRouter.address, depositAmount.mul(2));

  // 2. Create deposit request
  const tx = await exchangeRouter.createDeposit({
    receiver: deployer.address,           // Who receives LP tokens
    callbackContract: ethers.constants.AddressZero,
    uiFeeReceiver: ethers.constants.AddressZero,
    market: brlUsdMarket,
    initialLongToken: usdc.address,
    initialShortToken: usdc.address,
    longTokenSwapPath: [],
    shortTokenSwapPath: [],
    minMarketTokens: 0,                   // Set slippage protection in production
    shouldUnwrapNativeToken: false,
    executionFee: ethers.utils.parseEther("0.01"),
    callbackGasLimit: 0,
  }, { value: ethers.utils.parseEther("0.01") });

  console.log("Deposit created:", tx.hash);

  // 3. In production, your keeper executes this
  // For testing/MVP, you can execute directly if you have keeper role

  console.log("Liquidity seeded successfully!");
}

main().catch(console.error);
```

### Option 2: Direct Contract Interaction

For even simpler MVP setup, interact directly via Hardhat console:

```javascript
// npx hardhat console --network localhost

const usdc = await ethers.getContract("USDC");
const router = await ethers.getContract("ExchangeRouter");
const market = "0x..."; // BRL/USD market

// Approve and deposit
await usdc.approve(router.address, ethers.constants.MaxUint256);
await router.createDeposit({...});
```

### Option 3: Build LP UI (Later)

For production, you might want a UI where external LPs can:
1. Connect wallet
2. Enter USDC amount
3. Click "Add Liquidity"
4. Receive MarketTokens

But this is **not required for MVP** - you can be your own LP initially.

---

## LP Tokens Explained

### What Are MarketTokens?

When you add liquidity, you receive **MarketTokens** - an ERC20 token representing your share of the pool:

```
You deposit: $10,000 USDC
Pool total:  $100,000 USDC
Your share:  10%

You receive: MarketTokens worth 10% of the pool
```

### MarketToken Price

The LP token price changes based on:

```
MarketToken Price = Pool Value / Total MarketToken Supply

Pool Value includes:
├── USDC in pool
├── Pending PnL of open positions
├── Accrued fees
└── Other factors
```

### Redeeming LP Tokens

When LPs withdraw:

```
You have:    10% of MarketTokens
Pool value:  $120,000 (grew from fees!)
You receive: $12,000 USDC (minus fees)
```

---

## The Two-Step Process

Like orders, deposits and withdrawals use the **two-step keeper model**:

```
DEPOSIT FLOW
════════════

Step 1: LP creates deposit
─────────────────────────
LP calls: ExchangeRouter.createDeposit()
Result:   USDC transferred to DepositVault
          Deposit request stored in DataStore

Step 2: Keeper executes
───────────────────────
Keeper calls: DepositHandler.executeDeposit()
Result:       USDC moved to pool
              MarketTokens minted to LP


WITHDRAWAL FLOW
═══════════════

Step 1: LP creates withdrawal
────────────────────────────
LP calls: ExchangeRouter.createWithdrawal()
Result:   MarketTokens transferred to WithdrawalVault
          Withdrawal request stored in DataStore

Step 2: Keeper executes
───────────────────────
Keeper calls: WithdrawalHandler.executeWithdrawal()
Result:       MarketTokens burned
              USDC sent to LP
```

### Why Two Steps?

Same reasons as orders:
- Prevents front-running
- Allows price validation at execution time
- Keeper bundles with oracle prices

### Your Keeper Handles This Too

Your keeper service needs to watch for:
- Pending orders → execute orders
- Pending deposits → execute deposits
- Pending withdrawals → execute withdrawals

It's all the same pattern!

---

## GLV (Advanced - Not Needed for MVP)

### What is GLV?

GLV (GMX Liquidity Vault) is an **advanced feature** that wraps multiple markets:

```
Standard LP:
────────────
LP deposits into ONE market
├── BRL/USD pool → Get BRL/USD MarketTokens
└── COP/USD pool → Get COP/USD MarketTokens (separate)


GLV:
────
LP deposits into GLV wrapper
└── GLV [USDC] → Get GLV tokens
    ├── Automatically distributed to BRL/USD
    ├── Automatically distributed to COP/USD
    └── Automatically distributed to ARS/USD
    └── Auto-rebalances based on utilization
```

### Do You Need GLV?

| Scenario | Need GLV? |
|----------|-----------|
| MVP with 1-3 forex markets | ❌ No |
| Simple LP experience | ❌ No |
| Want auto-rebalancing across markets | ✅ Yes |
| Want single LP token for multiple markets | ✅ Yes |
| Production with many markets | Maybe |

### GLV Contracts (Already Exist)

If you need GLV later, the contracts exist:

| Contract | Purpose |
|----------|---------|
| `GlvFactory` | Creates new GLV vaults |
| `GlvToken` | ERC20 token for GLV shares |
| `GlvHandler` | Executes GLV operations |
| `GlvRouter` | Entry point for GLV deposits/withdrawals |

### When to Consider GLV

Consider GLV when:
- You have 5+ markets with same collateral (USDC)
- LPs want simplified experience
- You want automatic rebalancing

**For MVP: Skip GLV. Use standard market deposits.**

---

## Summary

### What's Already Done (No Work Needed)

```
✅ Deposit contracts      - ExchangeRouter.createDeposit()
✅ Withdrawal contracts   - ExchangeRouter.createWithdrawal()
✅ LP token (MarketToken) - ERC20, auto-created per market
✅ Pool accounting        - MarketUtils handles everything
✅ Fee distribution       - Built into the protocol
✅ Price calculations     - Reader.getMarketTokenPrice()
```

### What You Need to Do

```
For MVP:
────────
1. Deploy contracts (standard deployment)
2. Seed liquidity via script (you are the LP)
3. Build keeper (handles deposits too)
4. Done!

For Production (later):
───────────────────────
5. Build LP UI for external liquidity providers
6. (Optional) Add GLV if you want multi-market vaults
```

### Commands Quick Reference

```bash
# Deploy contracts
npx hardhat deploy --network <your-network>

# Seed liquidity (after deployment)
npx hardhat run scripts/seed-liquidity.ts --network <your-network>

# Check pool status
npx hardhat console --network <your-network>
> const reader = await ethers.getContract("Reader")
> await reader.getMarket(dataStore.address, marketAddress)
```

### The Bottom Line

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   LIQUIDITY POOLS: NOTHING TO BUILD                        │
│                                                             │
│   • All contracts exist and work                           │
│   • Just deploy and deposit                                │
│   • Your keeper executes deposits (same as orders)         │
│   • GLV is optional, not needed for MVP                    │
│                                                             │
│   Focus your time on:                                       │
│   1. Keeper service                                        │
│   2. Trading UI                                            │
│   3. (Optional) LP UI                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

*Last updated: December 2024*
