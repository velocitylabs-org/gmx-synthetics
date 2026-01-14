# Market Configuration Guide

This guide explains all the configuration parameters when creating a GMX V2 Synthetics market, with specific recommendations for forex/synthetic markets like BRL/USD, COP/USD, and ARS/USD.

---

## Table of Contents

1. [The Game Theory / Economics](#the-game-theory--economics)
2. [Pool Limits](#1-pool-limits---how-big-can-this-market-get)
3. [Reserve Factors](#2-reserve-factors---safety-buffer)
4. [PnL Factors](#3-pnl-factors---max-trader-profits)
5. [Position Fees](#4-position-fees---revenue-for-lps)
6. [Position Impact](#5-position-impact---price-slippage-for-large-trades)
7. [Swap Fees & Impact](#6-swap-fees--impact---for-pool-deposits)
8. [Funding Rate](#7-funding-rate---balancing-longshort)
9. [Borrowing Rate](#8-borrowing-rate---cost-to-hold-positions)
10. [Collateral Requirements](#9-collateral-requirements)
11. [Recommended Full Config](#recommended-full-config-for-brlusd)
12. [Revenue Flow Summary](#summary-how-revenue-flows)

---

## The Game Theory / Economics

GMX operates on a simple principle: **Liquidity Providers (LPs) take the opposite side of traders**.

```
┌─────────────────────────────────────────────────────────────────┐
│                    GMX ECONOMICS                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   TRADER WINS  →  LP LOSES (profits paid from pool)            │
│   TRADER LOSES →  LP WINS (losses add to pool)                 │
│                                                                 │
│   LPs are compensated with FEES for taking this risk:          │
│   ├── Position fees (opening/closing trades)                   │
│   ├── Borrowing fees (holding positions over time)             │
│   ├── Funding fees (when market is imbalanced)                 │
│   └── Swap fees (token exchanges)                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### For Forex Insurance Products (Nivo)

| User Action | What It Means | Use Case |
|-------------|---------------|----------|
| SHORT BRL | Protection against BRL depreciation | **Insurance** - hedge against currency devaluation |
| LONG BRL | Speculation that BRL will appreciate | Betting on currency strength |
| LP provides USDC | Takes opposite side of all trades | Earns fees from both sides |

---

## 1. Pool Limits - How Big Can This Market Get?

These parameters control the maximum size of the liquidity pool and trading activity.

| Parameter | Plain English | Example for Forex |
|-----------|---------------|-------------------|
| `maxLongTokenPoolAmount` | Max USDC that can be deposited as long token | 5,000,000 USDC (start small) |
| `maxShortTokenPoolAmount` | Max USDC for short token (same for single-token pool) | 5,000,000 USDC |
| `maxOpenInterestForLongs` | Max total LONG position size allowed | 2,000,000 USD |
| `maxOpenInterestForShorts` | Max total SHORT position size allowed | 2,000,000 USD |
| `maxPoolUsdForDeposit` | Cap on new deposits | 6,000,000 USD |
| `maxCollateralSum` | Max collateral for all positions combined | 10,000,000 USD |

### Recommendations for Forex Markets

```
For BRL/USD, COP/USD, ARS/USD - start conservative:

┌─────────────────────────────────────────────────────────────────┐
│ FOREX POOL SIZING                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Pool Size:           $1M - $5M USDC per market               │
│   Max Open Interest:   40-80% of pool size                     │
│                                                                 │
│   Example for $5M pool:                                         │
│   ├── maxLongTokenPoolAmount:  5,000,000 USDC                  │
│   ├── maxShortTokenPoolAmount: 5,000,000 USDC                  │
│   ├── maxOpenInterestForLongs: 2,000,000 USD (40%)             │
│   └── maxOpenInterestForShorts: 2,000,000 USD (40%)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Code example:**
```typescript
maxLongTokenPoolAmount: expandDecimals(5_000_000, 6),   // 5M USDC (6 decimals)
maxShortTokenPoolAmount: expandDecimals(5_000_000, 6),  // 5M USDC
maxOpenInterestForLongs: decimalToFloat(2_000_000),     // $2M
maxOpenInterestForShorts: decimalToFloat(2_000_000),    // $2M
maxPoolUsdForDeposit: decimalToFloat(6_000_000),        // $6M deposit cap
```

---

## 2. Reserve Factors - Safety Buffer

Reserve factors ensure LPs can always withdraw their funds, even when positions are open.

| Parameter | Plain English | Default |
|-----------|---------------|---------|
| `reserveFactor` | % of pool that CAN be used to pay profits | 90% |
| `openInterestReserveFactor` | Similar limit based on open interest | 90% |

### How It Works

```
RESERVE FACTOR EXAMPLE
══════════════════════

Pool Size: $1,000,000 USDC
reserveFactor: 95%

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Total Pool:        $1,000,000                                │
│                                                                 │
│   CAN be reserved    ┌─────────────────────────────┐           │
│   for positions:     │     $900,000 (90%)          │           │
│                      └─────────────────────────────┘           │
│                                                                 │
│   Always available   ┌───────┐                                 │
│   for LP withdrawal: │ 100K  │ (10% buffer)                     │
│                      └───────┘                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

This ensures LPs can always withdraw even if all positions
go maximum profitable.
```

**Code example (forex - use synthetic market defaults):**
```typescript
reserveFactor: percentageToFloat("95%"),
openInterestReserveFactor: percentageToFloat("90%"),
```

---

## 3. PnL Factors - Max Trader Profits

These parameters cap how much of the pool can be paid out as trader profits, protecting LPs from catastrophic losses.

| Parameter | Plain English | Forex Value |
|-----------|---------------|-------------|
| `maxPnlFactorForTraders` | Max % of pool that can be paid out as profits | 60% |
| `maxPnlFactorForAdl` | When to start auto-deleveraging | 55% |
| `minPnlFactorAfterAdl` | Target PnL ratio after ADL executes | 50% |

### How It Works

```
PNL FACTOR EXAMPLE
══════════════════

Pool: $1,000,000
maxPnlFactorForTraders: 60%

Maximum possible payout to winning traders: $600,000

┌─────────────────────────────────────────────────────────────────┐
│ IF TRADERS ARE WINNING BIG:                                     │
│                                                                 │
│   Trader profits reach 55% of pool ($550K)                     │
│   ├── ADL threshold reached (maxPnlFactorForAdl)               │
│   ├── Keeper starts auto-deleveraging                          │
│   └── Reduces winning positions until profits ≤ 50%            │
│                                                                 │
│   Trader profits reach 60% of pool ($600K)                     │
│   ├── maxPnlFactorForTraders hit                               │
│   └── No more profit can be paid - positions capped            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Code example (forex - conservative values):**
```typescript
maxPnlFactorForTraders: percentageToFloat("60%"),
maxPnlFactorForAdl: percentageToFloat("55%"),
minPnlFactorAfterAdl: percentageToFloat("50%"),
```

---

## 4. Position Fees - Revenue for LPs

Position fees are charged when traders open or close positions. These are the primary revenue source for LPs.

| Parameter | Plain English | Typical Value |
|-----------|---------------|---------------|
| `positionFeeFactorForPositiveImpact` | Fee when trade IMPROVES pool balance | 0.04% - 0.05% |
| `positionFeeFactorForNegativeImpact` | Fee when trade WORSENS pool balance | 0.06% - 0.08% |
| `liquidationFeeFactor` | Fee on liquidations | 0.20% - 0.30% |

### Game Theory

```
POSITION FEE INCENTIVES
═══════════════════════

Current State: 70% LONG, 30% SHORT (imbalanced)

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   NEW LONG TRADE (worsens imbalance):                          │
│   └── Pays HIGHER fee (0.08%)                                  │
│                                                                 │
│   NEW SHORT TRADE (improves balance):                          │
│   └── Pays LOWER fee (0.05%)                                   │
│                                                                 │
│   RESULT: Traders are incentivized to balance the market       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Code example (forex - slightly higher due to lower liquidity):**
```typescript
positionFeeFactorForPositiveImpact: percentageToFloat("0.05%"),
positionFeeFactorForNegativeImpact: percentageToFloat("0.08%"),
liquidationFeeFactor: percentageToFloat("0.30%"),
```

---

## 5. Position Impact - Price Slippage for Large Trades

Position impact creates virtual slippage based on how a trade affects market balance. Large trades that unbalance the market get worse prices.

| Parameter | Plain English |
|-----------|---------------|
| `positivePositionImpactFactor` | Bonus for trades that BALANCE the market |
| `negativePositionImpactFactor` | Penalty for trades that UNBALANCE the market |
| `positivePositionImpactExponentFactor` | How quickly positive impact grows (usually 1 = linear) |
| `negativePositionImpactExponentFactor` | How quickly negative impact grows (usually 2 = quadratic) |
| `positiveMaxPositionImpactFactor` | Cap on positive impact (max bonus) |
| `negativeMaxPositionImpactFactor` | Cap on negative impact (max penalty) |

### How It Works

```
POSITION IMPACT EXAMPLE
═══════════════════════

Market is 80% LONG, 20% SHORT

┌─────────────────────────────────────────────────────────────────┐
│ NEW $100K LONG (worsens imbalance):                            │
│ ├── Negative impact applies                                    │
│ ├── Execution price: $5.00 → $5.02 (worse by 0.4%)            │
│ └── Trader pays effective premium                              │
├─────────────────────────────────────────────────────────────────┤
│ NEW $100K SHORT (improves balance):                            │
│ ├── Positive impact applies                                    │
│ ├── Execution price: $5.00 → $4.99 (better by 0.2%)           │
│ └── Trader gets effective discount                             │
└─────────────────────────────────────────────────────────────────┘

Impact Formula: impact = (imbalance)^exponent × factor
```

**Code example (forex - higher impact for illiquid markets):**
```typescript
// Impact factors (higher = more slippage per dollar of imbalance)
negativePositionImpactFactor: exponentToFloat("1e-9"),
positivePositionImpactFactor: exponentToFloat("5e-10"),

// Exponents (2 = quadratic, large trades hit harder)
negativePositionImpactExponentFactor: exponentToFloat("2e0"),
positivePositionImpactExponentFactor: exponentToFloat("1e0"),

// Caps
negativeMaxPositionImpactFactor: percentageToFloat("1%"),   // Max 1% negative impact
positiveMaxPositionImpactFactor: percentageToFloat("0.5%"), // Max 0.5% positive impact
```

---

## 6. Swap Fees & Impact - For Pool Deposits

Swap fees apply when users exchange tokens within the pool. For **single-token pools** (like USDC-only forex markets), swaps are disabled.

### For Single-Token Pools (Forex)

Since BRL/USD, COP/USD, ARS/USD use USDC for both long and short tokens, there's no swapping:

```typescript
// Disable all swap functionality
swapFeeFactorForPositiveImpact: bigNumberify(0),
swapFeeFactorForNegativeImpact: bigNumberify(0),
negativeSwapImpactFactor: bigNumberify(0),
positiveSwapImpactFactor: bigNumberify(0),
```

### For Dual-Token Pools (ETH/USD, BTC/USD)

| Parameter | Plain English | Typical Value |
|-----------|---------------|---------------|
| `swapFeeFactorForPositiveImpact` | Fee for swaps that balance the pool | 0.02% - 0.05% |
| `swapFeeFactorForNegativeImpact` | Fee for swaps that unbalance the pool | 0.05% - 0.07% |
| `negativeSwapImpactFactor` | Slippage for unbalancing swaps | varies |
| `positiveSwapImpactFactor` | Bonus for balancing swaps | varies |

---

## 7. Funding Rate - Balancing Long/Short

Funding rates transfer value between longs and shorts to incentivize market balance. The **larger side pays the smaller side**.

| Parameter | Plain English |
|-----------|---------------|
| `fundingFactor` | Base funding rate calculation |
| `fundingIncreaseFactorPerSecond` | How fast funding rate grows when imbalanced |
| `fundingDecreaseFactorPerSecond` | How fast it decreases when balanced |
| `maxFundingFactorPerSecond` | Cap on funding rate (typical: ~90%/year) |
| `thresholdForStableFunding` | Imbalance % where rate stays flat |
| `thresholdForDecreaseFunding` | Imbalance % where rate starts decreasing |

### How It Works

```
FUNDING RATE EXAMPLE
════════════════════

Market: 70% LONG, 30% SHORT (imbalanced toward longs)

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   LONGS (70%) PAY ──────────────────────► SHORTS (30%)         │
│                                                                 │
│   If imbalance > thresholdForStableFunding (4%):               │
│   └── Funding rate INCREASES over time                         │
│                                                                 │
│   If imbalance ≤ threshold:                                    │
│   └── Funding rate DECREASES toward zero                       │
│                                                                 │
│   Max rate capped at ~90%/year                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Game theory: Traders are incentivized to take the minority
side (shorts) to RECEIVE funding instead of paying it.
```

**Code example (forex - use fundingRateConfig_Default):**
```typescript
// Funding rate increases by ~90%/year over 3 hours when imbalanced
fundingIncreaseFactorPerSecond: percentageToFloat("90%")
  .div(SECONDS_PER_YEAR)
  .div(SECONDS_PER_HOUR * 3),

// Funding rate decreases over 48 hours when balanced
fundingDecreaseFactorPerSecond: percentageToFloat("90%")
  .div(SECONDS_PER_YEAR)
  .div(SECONDS_PER_HOUR * 48),

// Max ~90% APR
maxFundingFactorPerSecond: percentageToFloat("90%").div(SECONDS_PER_YEAR),

// Thresholds
thresholdForStableFunding: percentageToFloat("4%"),
thresholdForDecreaseFunding: percentageToFloat("2%"),
```

---

## 8. Borrowing Rate - Cost to Hold Positions

Borrowing rates charge traders for using pool liquidity over time. This compensates LPs for having their capital "locked" by open positions.

| Parameter | Plain English |
|-----------|---------------|
| `optimalUsageFactor` | Target pool utilization (typically 75%) |
| `baseBorrowingFactor` | Base rate at optimal usage (~50-55%/year) |
| `aboveOptimalUsageBorrowingFactor` | Penalty rate above optimal (~100-130%/year) |

### How It Works

```
BORROWING RATE CURVE
════════════════════

                    Borrowing Rate
                         │
         130%/yr ────────┼─────────────────────■
                         │                   ╱
                         │                 ╱
          55%/yr ────────┼───────────────■
                         │              ╱│
                         │            ╱  │
                         │          ╱    │
           0% ───────────┼────────╱──────┼──────── Pool Utilization
                         │       │       │
                        0%      75%    100%
                             (optimal)

Below 75% utilization: Linear increase to 55%/year
Above 75% utilization: Steep increase to 130%/year

Game theory: When pool is heavily used, borrowing gets expensive
→ Encourages traders to close positions → Frees up liquidity
```

**Code example (forex - borrowingRateConfig_HighMax_WithHigherBase):**
```typescript
optimalUsageFactor: percentageToFloat("75%"),
baseBorrowingFactor: percentageToFloat("55%").div(SECONDS_PER_YEAR),
aboveOptimalUsageBorrowingFactor: percentageToFloat("130%").div(SECONDS_PER_YEAR),
```

---

## 9. Collateral Requirements

Collateral parameters determine leverage limits and liquidation thresholds.

| Parameter | Plain English |
|-----------|---------------|
| `minCollateralFactor` | Min margin requirement (1% = 100x max leverage) |
| `minCollateralFactorForLiquidation` | When liquidation triggers |
| `minCollateralUsd` | Minimum $1 collateral for any position |
| `minPositionSizeUsd` | Minimum position size |

### Leverage Calculation

```
LEVERAGE AND COLLATERAL
═══════════════════════

minCollateralFactor = 1%

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Maximum Leverage = 1 / minCollateralFactor                   │
│                    = 1 / 0.01                                   │
│                    = 100x                                       │
│                                                                 │
│   Example:                                                      │
│   ├── $100 collateral                                          │
│   ├── Max position: $100 × 100 = $10,000                       │
│   └── If position loses > $99, liquidation triggers            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Code example (forex - standard values):**
```typescript
minCollateralFactor: percentageToFloat("1%"),              // 100x max leverage
minCollateralFactorForLiquidation: percentageToFloat("1%"),
minCollateralUsd: decimalToFloat(1, 0),                    // $1 minimum
minPositionSizeUsd: decimalToFloat(1, 0),                  // $1 minimum position
```

---

## Recommended Full Config for BRL/USD

Here's a complete configuration for a BRL/USD forex market on Arbitrum:

```typescript
{
  tokens: {
    indexToken: "BRL",     // Synthetic BRL (price-only, no on-chain token)
    longToken: "USDC",
    shortToken: "USDC"     // Single-token pool
  },

  // Use synthetic market defaults (more conservative than ETH/BTC)
  ...syntheticMarketConfig,
  ...fundingRateConfig_Default,
  ...borrowingRateConfig_HighMax_WithHigherBase,

  // ═══════════════════════════════════════════════════════════════
  // POOL LIMITS (start conservative, can increase later)
  // ═══════════════════════════════════════════════════════════════
  maxLongTokenPoolAmount: expandDecimals(5_000_000, 6),   // 5M USDC
  maxShortTokenPoolAmount: expandDecimals(5_000_000, 6),  // 5M USDC
  maxOpenInterestForLongs: decimalToFloat(2_000_000),     // $2M max long positions
  maxOpenInterestForShorts: decimalToFloat(2_000_000),    // $2M max short positions
  maxPoolUsdForDeposit: decimalToFloat(6_000_000),        // $6M deposit cap

  // ═══════════════════════════════════════════════════════════════
  // POSITION IMPACT (higher for illiquid forex markets)
  // ═══════════════════════════════════════════════════════════════
  negativePositionImpactFactor: exponentToFloat("1e-9"),
  positivePositionImpactFactor: exponentToFloat("5e-10"),
  negativePositionImpactExponentFactor: exponentToFloat("2e0"),
  positivePositionImpactExponentFactor: exponentToFloat("1e0"),
  negativeMaxPositionImpactFactor: percentageToFloat("1%"),
  positiveMaxPositionImpactFactor: percentageToFloat("0.5%"),

  // ═══════════════════════════════════════════════════════════════
  // POSITION FEES (slightly higher for low-liquidity market)
  // ═══════════════════════════════════════════════════════════════
  positionFeeFactorForPositiveImpact: percentageToFloat("0.05%"),
  positionFeeFactorForNegativeImpact: percentageToFloat("0.08%"),
  liquidationFeeFactor: percentageToFloat("0.30%"),

  // ═══════════════════════════════════════════════════════════════
  // SWAP FEES (disabled for single-token pool)
  // ═══════════════════════════════════════════════════════════════
  swapFeeFactorForPositiveImpact: bigNumberify(0),
  swapFeeFactorForNegativeImpact: bigNumberify(0),
  negativeSwapImpactFactor: bigNumberify(0),
  positiveSwapImpactFactor: bigNumberify(0),

  // ═══════════════════════════════════════════════════════════════
  // RESERVE FACTORS (standard for synthetics)
  // ═══════════════════════════════════════════════════════════════
  reserveFactor: percentageToFloat("95%"),
  openInterestReserveFactor: percentageToFloat("90%"),

  // ═══════════════════════════════════════════════════════════════
  // PNL FACTORS (conservative for forex volatility)
  // ═══════════════════════════════════════════════════════════════
  maxPnlFactorForTraders: percentageToFloat("60%"),
  maxPnlFactorForAdl: percentageToFloat("55%"),
  minPnlFactorAfterAdl: percentageToFloat("50%"),

  // ═══════════════════════════════════════════════════════════════
  // COLLATERAL (standard)
  // ═══════════════════════════════════════════════════════════════
  minCollateralFactor: percentageToFloat("1%"),
  minCollateralFactorForLiquidation: percentageToFloat("1%"),
  minCollateralUsd: decimalToFloat(1, 0),
}
```

---

## Summary: How Revenue Flows

```
REVENUE FLOW DIAGRAM
════════════════════

TRADER OPENS POSITION
    │
    ├── Position Fee (0.05-0.08%) ──────────────────► LP POOL
    │
    └── (Position stays open)
            │
            ├── Borrowing Fee (~55-130%/yr) ────────► LP POOL
            │
            ├── Funding Fee (if imbalanced) ────────► Other side / LP POOL
            │
            └── TRADER CLOSES
                    │
                    ├── Position Fee ───────────────► LP POOL
                    │
                    └── PnL settled from pool
                            │
                            ├── Trader WINS: Paid from LP Pool
                            └── Trader LOSES: Added to LP Pool


┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   LP EARNINGS = Position Fees                                   │
│               + Borrowing Fees                                  │
│               + Funding Fees (from imbalanced side)             │
│               + Trader Losses                                   │
│               - Trader Profits                                  │
│                                                                 │
│   Over time, fees should exceed trader edge, making LPs        │
│   profitable on average.                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference: Config Presets

GMX provides preset configurations in `config/markets.ts`:

| Preset | Use Case | Key Characteristics |
|--------|----------|---------------------|
| `syntheticMarketConfig` | Synthetic assets (forex, commodities) | Conservative limits, higher impact |
| `syntheticMarketConfig_IncreasedCapacity` | High-volume synthetics | Larger pool limits |
| `fundingRateConfig_Default` | Standard funding | 90%/yr max, 3hr increase, 48hr decrease |
| `fundingRateConfig_LongsPayShorts` | Perpetual premium | Longs always pay shorts |
| `borrowingRateConfig_HighMax_WithHigherBase` | Active markets | 55% base, 130% above optimal |
| `borrowingRateConfig_HighMax` | Standard | 50% base, 100% above optimal |

