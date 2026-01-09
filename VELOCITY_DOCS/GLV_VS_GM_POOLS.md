# GLV Vaults vs GM Pools

This document explains the difference between GM Pools (standard liquidity pools) and GLV Vaults (multi-market liquidity wrappers) in the GMX V2 protocol.

---

## Table of Contents

1. [Overview](#overview)
2. [GM Pools (Markets)](#gm-pools-markets)
3. [GLV Vaults](#glv-vaults)
4. [Architecture Comparison](#architecture-comparison)
5. [Liquidity Flow](#liquidity-flow)
6. [Risk Considerations](#risk-considerations)
7. [When to Use Each](#when-to-use-each)
8. [Technical Implementation](#technical-implementation)
9. [Summary](#summary)

---

## Overview

GMX V2 provides two mechanisms for liquidity provision:

| Component | Purpose | LP Receives |
|-----------|---------|-------------|
| **GM Pool** | Single market liquidity | GM Tokens (market-specific) |
| **GLV Vault** | Multi-market wrapper | GLV Tokens (diversified) |

**Key Distinction:**
- GM Pools are the **fundamental building blocks** - every market requires a GM Pool
- GLV Vaults are **optional wrappers** that aggregate multiple GM Pools

---

## GM Pools (Markets)

### Definition

A GM Pool (also called a Market) is an individual liquidity pool that enables trading for a specific asset pair. Each market has:

- **Market Token (GM Token)**: ERC20 representing LP shares in that specific market
- **Index Token**: The asset whose price movements determine position PnL
- **Long Token**: Collateral for long positions and profit payouts
- **Short Token**: Collateral for short positions and profit payouts

### Structure

```
GM POOL STRUCTURE
═════════════════

┌─────────────────────────────────────────────────────────┐
│                    BRL/USD GM Pool                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Index Token:  BRL (synthetic - price tracked)        │
│   Long Token:   USDC                                    │
│   Short Token:  USDC                                    │
│                                                         │
│   ┌─────────────────────────────────────────────────┐  │
│   │              Pool Liquidity                      │  │
│   │                                                  │  │
│   │   USDC Balance: $5,000,000                      │  │
│   │   Open Interest (Long):  $2,000,000             │  │
│   │   Open Interest (Short): $1,500,000             │  │
│   │                                                  │  │
│   └─────────────────────────────────────────────────┘  │
│                                                         │
│   LP Deposits USDC → Receives BRL/USD GM Tokens        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Characteristics

| Aspect | Description |
|--------|-------------|
| **Risk Isolation** | LPs are exposed only to this market's trading activity |
| **Direct Control** | LPs choose exactly which market(s) to provide liquidity to |
| **Fee Earning** | LPs earn fees from trades in this specific market |
| **Independence** | Each pool operates independently of other pools |

### LP Experience

```
DIRECT GM POOL DEPOSIT
══════════════════════

LP wants exposure to BRL/USD only:

1. LP deposits $10,000 USDC into BRL/USD pool
2. LP receives BRL/USD GM tokens
3. LP earns fees from BRL/USD trading
4. LP is exposed to BRL/USD trader PnL only

If BRL/USD traders profit: LP loses
If BRL/USD traders lose: LP gains
Other markets have zero effect on this LP
```

---

## GLV Vaults

### Definition

A GLV (GMX Liquidity Vault) is a wrapper contract that holds multiple GM tokens from different markets. All markets within a GLV must share the same long/short token pair (e.g., all USDC-collateralized markets).

### Structure

```
GLV VAULT STRUCTURE
═══════════════════

┌─────────────────────────────────────────────────────────────────┐
│                      GLV [USDC] Vault                            │
│              "Forex Emerging Markets Vault"                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Long Token:  USDC (common across all markets)                │
│   Short Token: USDC (common across all markets)                │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                  GLV Holdings                            │  │
│   │                                                          │  │
│   │   BRL/USD GM Tokens: $2,000,000 (40%)                   │  │
│   │   COP/USD GM Tokens: $1,750,000 (35%)                   │  │
│   │   ARS/USD GM Tokens: $1,250,000 (25%)                   │  │
│   │   ─────────────────────────────────                     │  │
│   │   Total Value:       $5,000,000                         │  │
│   │                                                          │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│   LP Deposits USDC → Receives GLV Tokens                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
          │              │              │
          ▼              ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ BRL/USD  │  │ COP/USD  │  │ ARS/USD  │
    │ GM Pool  │  │ GM Pool  │  │ GM Pool  │
    └──────────┘  └──────────┘  └──────────┘
```

### Characteristics

| Aspect | Description |
|--------|-------------|
| **Diversification** | LP exposure spread across multiple markets |
| **Single Token** | One GLV token represents shares in multiple markets |
| **Auto-Rebalancing** | GLV can shift liquidity based on market utilization |
| **Shared Risk** | Losses in any underlying market affect all GLV holders |

### LP Experience

```
GLV VAULT DEPOSIT
═════════════════

LP wants diversified forex exposure:

1. LP deposits $10,000 USDC into GLV Vault
2. GLV internally distributes to underlying markets:
   - $4,000 → BRL/USD GM Pool
   - $3,500 → COP/USD GM Pool
   - $2,500 → ARS/USD GM Pool
3. LP receives GLV tokens
4. LP earns fees from ALL underlying markets
5. LP is exposed to ALL underlying markets' trader PnL

Risk is aggregated across all markets in the vault
```

---

## Architecture Comparison

```
ARCHITECTURE COMPARISON
═══════════════════════

OPTION A: Direct GM Pools (Independent)
───────────────────────────────────────

   LP₁ ($50K)      LP₂ ($30K)      LP₃ ($20K)
       │               │               │
       ▼               ▼               ▼
  ┌─────────┐    ┌─────────┐    ┌─────────┐
  │ BRL/USD │    │ COP/USD │    │ ARS/USD │
  │ GM Pool │    │ GM Pool │    │ GM Pool │
  │  $50K   │    │  $30K   │    │  $20K   │
  └─────────┘    └─────────┘    └─────────┘
       │               │               │
  Isolated Risk   Isolated Risk   Isolated Risk



OPTION B: GLV Vault (Aggregated)
────────────────────────────────

              LP ($100K)
                  │
                  ▼
         ┌───────────────┐
         │   GLV Vault   │
         │    $100K      │
         └───────────────┘
          │      │      │
     ┌────┘      │      └────┐
     ▼           ▼           ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│ BRL/USD │ │ COP/USD │ │ ARS/USD │
│ GM Pool │ │ GM Pool │ │ GM Pool │
│  $40K   │ │  $35K   │ │  $25K   │
└─────────┘ └─────────┘ └─────────┘
     │           │           │
     └───────────┼───────────┘
                 │
           Shared Risk



OPTION C: Hybrid (Both)
───────────────────────

   LP₁ ($20K)                    LP₂ ($80K)
       │                             │
       ▼                             ▼
  ┌─────────┐                ┌───────────────┐
  │ BRL/USD │                │   GLV Vault   │
  │ GM Pool │                │    $80K       │
  │ Direct  │                └───────────────┘
  └─────────┘                 │      │      │
                         ┌────┘      │      └────┐
                         ▼           ▼           ▼
                    ┌─────────┐ ┌─────────┐ ┌─────────┐
                    │ BRL/USD │ │ COP/USD │ │ ARS/USD │
                    │ +$32K   │ │  $28K   │ │  $20K   │
                    └─────────┘ └─────────┘ └─────────┘

BRL/USD total liquidity: $20K (direct) + $32K (from GLV) = $52K
```

---

## Liquidity Flow

### GLV Deposit Flow

```
GLV DEPOSIT FLOW
════════════════

Step 1: LP Initiates Deposit
────────────────────────────
LP calls: GlvRouter.createGlvDeposit(amount: $100,000 USDC)
Result:   USDC transferred to GlvVault
          Deposit request stored in DataStore

Step 2: Keeper Executes
───────────────────────
Keeper calls: GlvHandler.executeGlvDeposit(key, oracleParams)

Step 3: GLV Distributes to Markets
──────────────────────────────────
GLV internally creates deposits for each underlying market:

┌─────────────────────────────────────────────────────────┐
│  GLV Allocation Logic                                   │
│                                                         │
│  Based on configured weights:                           │
│  • BRL/USD weight: 4000 (40%) → $40,000                │
│  • COP/USD weight: 3500 (35%) → $35,000                │
│  • ARS/USD weight: 2500 (25%) → $25,000                │
│                                                         │
│  GLV calls ExchangeRouter.createDeposit() for each     │
└─────────────────────────────────────────────────────────┘

Step 4: GM Tokens Received
──────────────────────────
GLV receives and holds:
• BRL/USD GM Tokens (worth $40,000)
• COP/USD GM Tokens (worth $35,000)
• ARS/USD GM Tokens (worth $25,000)

Step 5: GLV Tokens Minted
─────────────────────────
LP receives GLV tokens representing their share of the vault
```

### Liquidity Availability

Once deposited through GLV, the liquidity is **fully available** in each underlying GM pool:

```
LIQUIDITY AVAILABILITY
══════════════════════

After GLV deposit of $100,000:

┌─────────────┬──────────────────┬─────────────────────────┐
│   Market    │ Pool Liquidity   │ Available for Trading   │
├─────────────┼──────────────────┼─────────────────────────┤
│ BRL/USD     │ $40,000          │ Yes - full amount       │
│ COP/USD     │ $35,000          │ Yes - full amount       │
│ ARS/USD     │ $25,000          │ Yes - full amount       │
└─────────────┴──────────────────┴─────────────────────────┘

Traders can open positions in any market using GLV-provided liquidity
```

---

## Risk Considerations

### GM Pool Risk (Isolated)

```
GM POOL RISK MODEL
══════════════════

Scenario: Trader profits $50,000 on BRL/USD

┌─────────────────────────────────────────────────────────┐
│                                                         │
│   BRL/USD Pool                                          │
│   ────────────                                          │
│   Before: $500,000 liquidity                           │
│   Trader profit: -$50,000                              │
│   After: $450,000 liquidity                            │
│                                                         │
│   BRL/USD LPs lose 10% of their position               │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   COP/USD Pool: UNAFFECTED                             │
│   ARS/USD Pool: UNAFFECTED                             │
│                                                         │
│   Other market LPs have zero exposure to BRL/USD       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### GLV Vault Risk (Shared)

```
GLV VAULT RISK MODEL
════════════════════

Scenario: Trader profits $50,000 on BRL/USD

┌─────────────────────────────────────────────────────────┐
│                                                         │
│   GLV Vault Holdings                                    │
│   ──────────────────                                    │
│   BRL/USD GM Tokens: $200,000 → $150,000 (-25%)        │
│   COP/USD GM Tokens: $175,000 → $175,000 (unchanged)   │
│   ARS/USD GM Tokens: $125,000 → $125,000 (unchanged)   │
│   ─────────────────────────────────────────────        │
│   Total Value:       $500,000 → $450,000 (-10%)        │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ALL GLV holders share the loss proportionally         │
│                                                         │
│   GLV holder with $10,000:                             │
│   Before: $10,000                                       │
│   After:  $9,000 (-10%)                                │
│                                                         │
│   Loss is distributed even though COP and ARS were     │
│   unaffected by the BRL/USD trade                      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Risk Summary

| Risk Type | GM Pool | GLV Vault |
|-----------|---------|-----------|
| Market-specific loss | Affects only that market's LPs | Affects all GLV holders |
| Diversification benefit | None (single market) | Yes (spread across markets) |
| Correlated market risk | N/A | Higher (if markets correlate) |
| Maximum loss exposure | Limited to deposited market | Spread but potentially higher |

---

## When to Use Each

### Use Direct GM Pools When:

| Scenario | Rationale |
|----------|-----------|
| MVP/Initial launch | Simpler deployment and testing |
| LPs want specific exposure | Individual risk preferences |
| Markets have different risk profiles | Isolate high-risk markets |
| Few markets (1-3) | GLV overhead not justified |
| Regulatory requirements | May need separated pools |

### Use GLV Vault When:

| Scenario | Rationale |
|----------|-----------|
| 5+ markets with same collateral | Simplifies LP experience |
| LPs want diversification | Single deposit, multiple markets |
| Automatic rebalancing needed | GLV shifts based on utilization |
| Simplified UI/UX required | One token instead of many |
| Institutional LPs | Prefer managed diversification |

### Decision Matrix

```
DECISION MATRIX
═══════════════

Number of Markets:
├── 1-2 markets     → GM Pools only
├── 3-4 markets     → GM Pools (GLV optional)
└── 5+ markets      → Consider GLV

LP Sophistication:
├── Retail users    → GLV (simpler UX)
├── Institutional   → Either (depends on mandate)
└── Protocol-owned  → GM Pools (direct control)

Risk Preference:
├── Isolated risk   → GM Pools
├── Diversified     → GLV
└── Mixed           → Hybrid approach

Development Stage:
├── MVP             → GM Pools only
├── Growth          → Add GLV if needed
└── Mature          → Full optionality
```

---

## Technical Implementation

### GM Pool Deployment

```solidity
// Markets are created via MarketFactory
MarketFactory.createMarket(
    indexToken,     // Asset to track (e.g., BRL synthetic address)
    longToken,      // Collateral token (e.g., USDC)
    shortToken,     // Collateral token (e.g., USDC)
    marketType      // Market configuration type
);
```

### GLV Vault Deployment

```solidity
// GLV created via GlvFactory
GlvFactory.createGlv(
    longToken,      // Common long token (e.g., USDC)
    shortToken      // Common short token (e.g., USDC)
);

// Markets added to GLV
GlvHandler.addMarket(
    glv,            // GLV address
    market,         // GM Pool address
    weight          // Allocation weight
);
```

### Configuration Example

```typescript
// config/glvs.ts
export const glvConfigs = {
  "FOREX_GLV": {
    longToken: tokens.usdc.address,
    shortToken: tokens.usdc.address,

    markets: [
      { market: "BRL_USD", weight: 4000 },  // 40%
      { market: "COP_USD", weight: 3500 },  // 35%
      { market: "ARS_USD", weight: 2500 },  // 25%
    ],

    // GLV-specific parameters
    maxMarketTokenBalanceUsd: expandDecimals(10_000_000, 30),
    maxMarketTokenBalanceAmount: expandDecimals(10_000_000, 18),
  }
};
```

### Key Contracts

| Contract | Location | Purpose |
|----------|----------|---------|
| `GlvFactory.sol` | `contracts/glv/` | Creates new GLV vaults |
| `GlvToken.sol` | `contracts/glv/` | ERC20 GLV token |
| `GlvVault.sol` | `contracts/glv/` | Holds tokens during operations |
| `GlvHandler.sol` | `contracts/glv/` | Executes GLV operations |
| `GlvUtils.sol` | `contracts/glv/` | Core GLV calculations |
| `GlvRouter.sol` | `contracts/router/` | User entry point for GLV |
| `GlvReader.sol` | `contracts/reader/` | View functions for GLV |

---

## Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                         KEY TAKEAWAYS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GM POOLS (Required)                                            │
│  ═══════════════════                                            │
│  • Fundamental building block for each market                   │
│  • Must exist for trading to occur                              │
│  • LPs have isolated, market-specific risk                      │
│  • Direct control over exposure                                 │
│                                                                 │
│  GLV VAULTS (Optional)                                          │
│  ═════════════════════                                          │
│  • Wrapper that holds multiple GM tokens                        │
│  • Provides diversification and auto-rebalancing                │
│  • Simplifies LP experience (one deposit, one token)            │
│  • Introduces shared risk across underlying markets             │
│  • Not required for protocol functionality                      │
│                                                                 │
│  RELATIONSHIP                                                   │
│  ════════════                                                   │
│  • GLV deposits flow INTO GM Pools                              │
│  • GM Pools can receive liquidity from both direct LPs and GLV  │
│  • GLV cannot exist without underlying GM Pools                 │
│  • GM Pools function independently of GLV                       │
│                                                                 │
│  RECOMMENDATION                                                 │
│  ══════════════                                                 │
│  • Start with GM Pools only                                     │
│  • Add GLV when scaling to 5+ markets with same collateral      │
│  • Consider LP preferences and risk tolerance                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```


