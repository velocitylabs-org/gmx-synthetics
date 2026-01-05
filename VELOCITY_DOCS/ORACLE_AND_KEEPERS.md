# Oracle System & Keepers Explained

This document explains how prices flow through GMX, the role of keepers, and how oracle providers are used for sanity checks.

---

## Table of Contents

1. [The Big Picture](#the-big-picture)
2. [Why This Architecture?](#why-this-architecture)
3. [Keepers Explained](#keepers-explained)
4. [Oracle Providers (Sanity Checks)](#oracle-providers-sanity-checks)
5. [The Complete Price Flow](#the-complete-price-flow)
6. [For Synthetic Tokens (BRL, COP, ARS)](#for-synthetic-tokens-brl-cop-ars)
7. [MVP Approach: Disabling Sanity Checks](#mvp-approach-disabling-sanity-checks)
8. [How Localhost Testing Works](#how-localhost-testing-works-no-chainlinkpyth-deployed)
9. [What You Need to Build](#what-you-need-to-build)
10. [FAQ](#faq)

---

## The Big Picture

```
WHO PROVIDES PRICES?
====================

    ┌─────────────────┐
    │     KEEPER      │  ◄── This is YOUR server (off-chain)
    │   (off-chain)   │      Fetches prices from Pyth API
    └────────┬────────┘      Signs them with private key
             │
             │ Submits signed price
             ▼
    ┌─────────────────┐
    │  GMX CONTRACTS  │  ◄── Validates signature
    │   (on-chain)    │      Checks timestamp is fresh
    └────────┬────────┘      Does sanity check against reference
             │
             │ Optional: Compare against reference
             ▼
    ┌─────────────────┐
    │ ORACLE PROVIDER │  ◄── Chainlink, Pyth, etc. (on-chain)
    │ (sanity check)  │      ONLY used to validate keeper's price
    └─────────────────┘      is not wildly wrong
```

**Key Insight**: The keeper provides the actual price. The oracle provider is just a safety net.

---

## Why This Architecture?

### Problem 1: Front-Running

If prices were fetched on-chain at execution time:
```
1. User submits order to buy ETH
2. Miner sees the order in mempool
3. Miner buys ETH first (front-run)
4. User's order executes at worse price
5. Miner sells for profit
```

### Problem 2: Expensive On-Chain Calls

Reading from Chainlink/Pyth on-chain for every trade = expensive gas costs.

### Solution: Keeper-Based Execution

```
1. User submits order (no price yet)
2. Order sits in DataStore
3. Keeper fetches price OFF-CHAIN (cheap/free)
4. Keeper signs price and submits
5. Order executes with that price
```

- No front-running: Price isn't known until keeper submits
- Cheap: Off-chain API calls are free
- Fast: No waiting for on-chain oracle updates

---

## Keepers Explained

### What is a Keeper?

A keeper is simply a **backend server** that you run. It:

1. **Watches** for pending orders in GMX
2. **Fetches** current prices from price APIs (Pyth, forex APIs, etc.)
3. **Signs** the prices with a private key
4. **Submits** the signed prices to GMX to execute orders

### What Does "Sign" Mean?

The keeper creates a data package and signs it with its private key:

```javascript
// Simplified example of what keeper does
const priceData = {
    token: "0xBRL...",      // BRL token address
    price: 160000000,        // $0.16 in GMX format
    timestamp: 1703955600,   // When price was fetched
};

const signature = wallet.signMessage(priceData);

// Submit to GMX
await orderHandler.executeOrder(orderKey, priceData, signature);
```

### Who Can Be a Keeper?

Only **authorized signers** can submit prices. You register your keeper's wallet address in GMX's OracleStore:

```
Authorized Signers List:
------------------------
0xABC123...  ← Your keeper's wallet
0xDEF456...  ← Backup keeper
```

If a random person tries to submit prices, GMX rejects them.

---

## Oracle Providers (Sanity Checks)

### What Are They?

Oracle providers are on-chain contracts that read prices from Chainlink, Pyth, or other sources. Examples in GMX:

| Provider | File | Purpose |
|----------|------|---------|
| ChainlinkPriceFeedProvider | `contracts/oracle/ChainlinkPriceFeedProvider.sol` | Reads Chainlink price feeds |
| ChainlinkDataStreamProvider | `contracts/oracle/ChainlinkDataStreamProvider.sol` | Reads Chainlink Data Streams |
| PythOracleProvider | (we will create) | Reads Pyth prices |

### What Do They Do?

They provide a **reference price** for sanity checking:

```
Keeper submits:     BRL = $0.16
Reference (Pyth):   BRL = $0.159

Deviation = |0.16 - 0.159| / 0.159 = 0.6%

Is 0.6% < maxAllowedDeviation (5%)?  ✅ YES → Accept price
Is 0.6% < maxAllowedDeviation (5%)?  ❌ NO  → Reject price
```

### Why Sanity Checks?

They protect against:

| Threat | How Sanity Check Helps |
|--------|------------------------|
| Keeper bug | Keeper accidentally submits $16 instead of $0.16 → Caught |
| Malicious keeper | Keeper tries to manipulate price → Caught |
| Stale prices | Keeper submits old cached price → Timestamp check catches it |

### Are They Required?

**No.** Sanity checks are optional per-token. You can:

- **Enable**: For high-security (recommended for production)
- **Disable**: For testing or when no reference exists

---

## The Complete Price Flow

### Step-by-Step Execution

```
STEP 1: USER CREATES ORDER
==========================
User: "I want to SHORT 10,000 USD of BRL"

    ┌─────────────────────────────────────────┐
    │  ExchangeRouter.createOrder({           │
    │    market: BRL/USD,                     │
    │    sizeDeltaUsd: 10000,                 │
    │    isLong: false,  // SHORT             │
    │  })                                     │
    └─────────────────────────────────────────┘
                      │
                      ▼
    Order saved in DataStore (NO PRICE YET)
    Order status: PENDING


STEP 2: KEEPER DETECTS ORDER
============================
Your keeper server (running 24/7):

    ┌─────────────────────────────────────────┐
    │  // Keeper code (Node.js/Python/etc)    │
    │                                         │
    │  while (true) {                         │
    │    orders = getPendingOrders();         │
    │    for (order of orders) {              │
    │      price = fetchFromPythAPI();        │
    │      signedPrice = sign(price);         │
    │      submitToGMX(order, signedPrice);   │
    │    }                                    │
    │    sleep(1000);                         │
    │  }                                      │
    └─────────────────────────────────────────┘


STEP 3: KEEPER FETCHES PRICE (OFF-CHAIN)
========================================
Keeper calls Pyth HTTP API:

    GET https://hermes.pyth.network/api/latest_price_feeds?ids[]=0xBRL_PRICE_ID

    Response: {
      "price": "0.16",
      "publishTime": 1703955600
    }

This is FREE and FAST (no blockchain involved).


STEP 4: KEEPER SIGNS PRICE
==========================
Keeper creates a signed package:

    ┌─────────────────────────────────────────┐
    │  SignedPrice = {                        │
    │    token: "0xBRL_ADDRESS",              │
    │    minPrice: 1600000000000000000000,    │
    │    maxPrice: 1600000000000000000000,    │
    │    timestamp: 1703955600,               │
    │    signature: "0xABC123..."             │
    │  }                                      │
    └─────────────────────────────────────────┘

The signature proves this came from an authorized keeper.


STEP 5: KEEPER SUBMITS TO GMX
=============================
Keeper calls the OrderHandler contract:

    ┌─────────────────────────────────────────┐
    │  OrderHandler.executeOrder(             │
    │    orderKey,                            │
    │    oracleParams: {                      │
    │      tokens: [BRL, USDC],               │
    │      signers: [keeperAddress],          │
    │      signatures: [signature],           │
    │      prices: [signedPrice]              │
    │    }                                    │
    │  )                                      │
    └─────────────────────────────────────────┘


STEP 6: GMX VALIDATES (ON-CHAIN)
================================
The Oracle contract checks:

    ┌─────────────────────────────────────────┐
    │  CHECK 1: Is signer authorized?         │
    │  ─────────────────────────────────────  │
    │  OracleStore.isAuthorizedSigner(        │
    │    keeperAddress                        │
    │  ) → true ✅                            │
    │                                         │
    │  CHECK 2: Is timestamp fresh?           │
    │  ─────────────────────────────────────  │
    │  block.timestamp - priceTimestamp       │
    │  = 1703955610 - 1703955600              │
    │  = 10 seconds < 300 max ✅              │
    │                                         │
    │  CHECK 3: Sanity check (optional)       │
    │  ─────────────────────────────────────  │
    │  referencePrice = PythProvider.get()    │
    │  deviation = |keeper - reference|       │
    │  deviation < maxDeviation ✅            │
    └─────────────────────────────────────────┘


STEP 7: ORDER EXECUTES
======================
With validated price, the order executes:

    - Position created: SHORT 10,000 USD of BRL
    - Entry price: $0.16 per BRL
    - Collateral locked
    - Events emitted
```

---

## For Synthetic Tokens (BRL, COP, ARS)

Synthetic tokens like BRL don't have an actual on-chain token. They're just a **price reference**.

### What You Need

| Component | Location | Purpose |
|-----------|----------|---------|
| Token config | `config/tokens.ts` | Define BRL as synthetic with 8 decimals |
| Market config | `config/markets.ts` | Define BRL/USD market |
| Keeper | Your server | Fetch BRL prices, sign, submit |
| PythOracleProvider | `contracts/oracle/` | Sanity check (optional but recommended) |

### Price Sources for Forex

| Source | Type | Best For |
|--------|------|----------|
| Pyth Network | API + On-chain | Both keeper and sanity check |
| Forex APIs | API only | Keeper price source |
| Your own aggregator | API | Keeper price source |

---

## MVP Approach: Disabling Sanity Checks

For an MVP or when you have reliable price aggregation in your keeper, you can **skip the on-chain sanity check entirely**.

### Why You Might Skip Sanity Checks

| Scenario | Recommendation |
|----------|----------------|
| MVP / Testing | Skip sanity check, validate in keeper |
| Keeper fetches from multiple sources | Skip on-chain, aggregate off-chain |
| No on-chain oracle available | Skip (you have no choice) |
| Production with high security needs | Enable sanity check |

### How Sanity Check Works (Code)

From `Oracle.sol`:

```solidity
if (!provider.isChainlinkOnChainProvider()) {
    // Try to get reference price from Chainlink
    (bool hasRefPrice, uint256 refPrice) = ChainlinkPriceFeedUtils.getPriceFeedPrice(dataStore, token);

    if (hasRefPrice) {
        // Only do deviation check if reference exists
        // Compare keeper price vs reference price
        // Revert if deviation > MAX_ORACLE_REF_PRICE_DEVIATION_FACTOR
    }
}
```

**Key insight**: If `hasRefPrice` is `false`, the sanity check is **automatically skipped**.

### How to Disable Sanity Check

#### Option 1: Don't Configure a Reference Price Feed (Simplest)

For BRL token, simply don't set up a Chainlink price feed in the DataStore:

```typescript
// In deployment/config - DON'T add this for BRL:
// dataStore.setAddress(Keys.priceFeedKey(brlToken), chainlinkFeedAddress);

// If no price feed is configured, hasRefPrice = false, sanity check skipped
```

This is the **default behavior** for synthetic tokens without Chainlink feeds.

#### Key Finding: `config/tokens.ts` Controls Sanity Check Behavior

**Important**: When no `priceFeed` is configured in `config/tokens.ts`, the validation is automatically skipped without error. The protocol relies entirely on keeper-provided prices.

```typescript
// config/tokens.ts

// BRL with NO priceFeed - sanity check DISABLED
BRL: {
  synthetic: true,
  decimals: 8,
  // No priceFeed property = no sanity check
},

// WETH with priceFeed - sanity check ENABLED
WETH: {
  address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  decimals: 18,
  priceFeed: {
    address: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",  // Chainlink feed
    decimals: 8,
    heartbeatDuration: (24 + 1) * 60 * 60,  // 25 hours
  },
},
```

The deployment scripts in `deploy/` read `config/tokens.ts` and only call `dataStore.setAddress(Keys.priceFeedKey(token), feedAddress)` if a `priceFeed` property exists. This means:

| Token Config | Result |
|--------------|--------|
| Has `priceFeed` property | Sanity check **enabled** |
| No `priceFeed` property | Sanity check **skipped** |
| `synthetic: true` (no priceFeed) | Sanity check **skipped** |

This automatic behavior makes it easy to deploy synthetic forex tokens (BRL, COP, ARS) without needing on-chain oracle infrastructure.

#### Option 2: Set High Deviation Tolerance

If you want the check to exist but never fail:

```typescript
// Set MAX_ORACLE_REF_PRICE_DEVIATION_FACTOR to 100% (effectively disabled)
await dataStore.setUint(
    Keys.MAX_ORACLE_REF_PRICE_DEVIATION_FACTOR,
    ethers.utils.parseUnits("1", 30)  // 100% = 1 * 10^30
);
```

#### Option 3: Per-Token Configuration

You can configure different behaviors per token by setting/not setting price feeds:

```
Token       Reference Feed    Sanity Check
─────────────────────────────────────────
ETH         Chainlink         ✅ Enabled
BTC         Chainlink         ✅ Enabled
BRL         (none)            ❌ Disabled
COP         (none)            ❌ Disabled
ARS         (none)            ❌ Disabled
```

### MVP Architecture: Multi-Source Keeper

For MVP, you can build a robust keeper that aggregates prices from multiple sources:

```
┌─────────────────────────────────────────────────────────────┐
│                    KEEPER (your server)                      │
│                                                              │
│   Price Sources:                                             │
│   ├── Pyth API ──────────────────────▶ $0.160               │
│   ├── Forex API (backup) ────────────▶ $0.159               │
│   └── Another source ────────────────▶ $0.161               │
│                                                              │
│   Aggregation Logic:                                         │
│   ├── Check all sources agree within 1%                     │
│   ├── Take median price: $0.160                             │
│   ├── If sources disagree > 2%, DON'T submit (alert!)       │
│   └── Sign and submit                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    GMX CONTRACTS                             │
│                                                              │
│   • Validates signature ✅                                   │
│   • Checks timestamp fresh ✅                                │
│   • Sanity check: SKIPPED (no reference configured)         │
│   • Executes order                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Sample Keeper Multi-Source Logic

```javascript
async function getAggregatedPrice(token) {
    // Fetch from multiple sources
    const prices = await Promise.all([
        fetchFromPyth(token),
        fetchFromForexAPI(token),
        fetchFromBackupSource(token),
    ]);

    // Filter out failed fetches
    const validPrices = prices.filter(p => p !== null);

    if (validPrices.length < 2) {
        throw new Error("Not enough price sources available");
    }

    // Check prices agree within tolerance
    const median = getMedian(validPrices);
    const maxDeviation = 0.02; // 2%

    for (const price of validPrices) {
        const deviation = Math.abs(price - median) / median;
        if (deviation > maxDeviation) {
            throw new Error(`Price source deviation too high: ${deviation}`);
        }
    }

    // All sources agree, return median
    return median;
}
```

### When to Add On-Chain Sanity Check Later

Consider adding PythOracleProvider when:

| Trigger | Action |
|---------|--------|
| Moving to production | Add Pyth on-chain provider |
| Handling significant volume | Add redundancy |
| Regulatory requirements | Add verifiable on-chain checks |
| Want defense in depth | Belt and suspenders approach |

### Summary: MVP vs Production

```
MVP Setup:
──────────
✅ Keeper fetches from Pyth API (+ backup sources)
✅ Keeper does its own validation (multi-source)
❌ No on-chain sanity check (not configured)
= Simpler, faster to ship

Production Setup:
─────────────────
✅ Keeper fetches from Pyth API (+ backup sources)
✅ Keeper does its own validation
✅ On-chain sanity check via PythOracleProvider
= More secure, defense in depth
```

---

## How Localhost Testing Works (No Chainlink/Pyth Deployed)

When you run `npx hardhat run scripts/test-brl-short-position.ts`, there's no Chainlink or Pyth deployed on your local Hardhat network. So how does it work?

### The Answer: Sanity Check is Automatically Skipped

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   LOCALHOST HAS NO CHAINLINK/PYTH                           │
│                                                             │
│   But tests still work because:                             │
│                                                             │
│   1. GmOracleProvider validates SIGNED prices from test     │
│      signers (configured in fixture)                        │
│                                                             │
│   2. No priceFeed is configured for any token               │
│      → hasRefPrice = false                                  │
│      → Sanity check SKIPPED                                 │
│                                                             │
│   3. Your mocked prices are accepted directly               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### The Complete Flow in Tests

```
YOUR TEST SCRIPT
    │
    │ executeOrder(fixture, {
    │   tokens: [brl.address, usdc.address],
    │   minPrices: [prices.brl.min, prices.usdc.min],
    │   maxPrices: [prices.brl.max, prices.usdc.max],
    │ })
    │
    ▼
UTILS/ORACLE.TS
    │
    │ Signs prices with test signers
    │ (signers configured in OracleStore during deployment)
    │
    ▼
ORDERHANDLER.EXECUTEORDER()
    │
    ▼
ORACLE.SOL - SETPRICES()
    │
    │ Step 1: Validate signature ✓
    │         (test signer is authorized)
    │
    │ Step 2: Check timestamp ✓
    │         (test sets valid timestamp)
    │
    │ Step 3: Get reference price for sanity check
    │         ↓
    ▼
CHAINLINKPRICEFEEDUTILS.GETPRICEFEEDPRICE()
    │
    │ priceFeedAddress = dataStore.getAddress(priceFeedKey(BRL))
    │
    │ In localhost: returns address(0)
    │ (no Chainlink feed was ever configured!)
    │
    │ return (false, 0)  ← hasRefPrice = FALSE
    │
    ▼
ORACLE.SOL (continued)
    │
    │ if (hasRefPrice) {
    │     validateRefPrice(...);  ← SKIPPED!
    │ }
    │
    │ Price accepted without sanity check ✓
    │
    ▼
ORDER EXECUTES SUCCESSFULLY
```

### The Key Code

**ChainlinkPriceFeedUtils.sol:17-21:**
```solidity
function getPriceFeedPrice(DataStore dataStore, address token)
    internal view returns (bool, uint256)
{
    address priceFeedAddress = dataStore.getAddress(Keys.priceFeedKey(token));

    if (priceFeedAddress == address(0)) {
        return (false, 0);  // ← No reference = skip sanity check
    }

    // Only reaches here if Chainlink feed is configured
    // ...
}
```

**Oracle.sol:304-321:**
```solidity
if (!provider.isChainlinkOnChainProvider()) {
    (bool hasRefPrice, uint256 refPrice) =
        ChainlinkPriceFeedUtils.getPriceFeedPrice(dataStore, token);

    if (hasRefPrice) {  // ← In localhost: FALSE, so this block is skipped
        _validateRefPrice(token, validatedPrice.min, refPrice, maxDeviation);
        _validateRefPrice(token, validatedPrice.max, refPrice, maxDeviation);
    }
}
```

### Environment Comparison

| Environment | Chainlink Deployed? | priceFeedKey Set? | Sanity Check |
|-------------|---------------------|-------------------|--------------|
| **Localhost (Hardhat)** | No | No | **Skipped** |
| **Testnet (no config)** | Maybe | No | **Skipped** |
| **Testnet (configured)** | Yes | Yes | **Runs** |
| **Production** | Yes | Yes | **Runs** |
| **New chain (no oracles)** | No | No | **Skipped** |

### This Is The Same As "Option 1: Skip Sanity Check"

The localhost behavior is **identical** to deploying on a new chain without Chainlink/Pyth:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   LOCALHOST = NEW CHAIN = SAME BEHAVIOR                     │
│                                                             │
│   Both work because:                                        │
│   • No price feed configured → hasRefPrice = false          │
│   • Sanity check skipped                                    │
│   • Keeper/signer prices accepted directly                  │
│                                                             │
│   The system is DESIGNED to work without sanity checks.     │
│   It's a safety feature, not a requirement.                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### What About GmOracleProvider?

In tests, `GmOracleProvider` is deployed and used as the oracle provider. It:

1. **Validates signatures** from authorized signers (configured in `OracleStore`)
2. **Checks price format** (min/max, precision, etc.)
3. **Returns validated prices** to `Oracle.sol`

But it does NOT do the Chainlink sanity check - that's a separate step in `Oracle.sol` that happens AFTER `GmOracleProvider` returns.

```
Test Signers (from fixture)
        │
        │ Sign prices
        ▼
GmOracleProvider.getOraclePrice()
        │
        │ Validates signatures
        │ Returns ValidatedPrice
        ▼
Oracle.sol
        │
        │ Tries to do sanity check
        │ No Chainlink configured → SKIP
        ▼
Price Accepted ✓
```

---

## What You Need to Build

### 1. Keeper Service (Required)

A backend service that:

```
┌─────────────────────────────────────────────────────────┐
│                    KEEPER SERVICE                        │
│                                                          │
│  Components:                                             │
│  ├── Order Watcher: Monitor DataStore for pending orders │
│  ├── Price Fetcher: Call Pyth API for forex prices      │
│  ├── Signer: Sign prices with keeper private key        │
│  └── Submitter: Call GMX to execute orders              │
│                                                          │
│  Tech Stack Options:                                     │
│  ├── Node.js + ethers.js                                │
│  ├── Python + web3.py                                   │
│  └── Go + go-ethereum                                   │
└─────────────────────────────────────────────────────────┘
```

### 2. PythOracleProvider Contract (Recommended)

For sanity checks:

```solidity
contract PythOracleProvider is IOracleProvider {
    IPyth public pyth;
    mapping(address => bytes32) public tokenToPriceId;

    function getOraclePrice(address token, bytes memory data)
        external view returns (ValidatedPrice memory)
    {
        // Read from Pyth on-chain contract
        // Return formatted price for sanity check
    }
}
```

### 3. Configuration

Register your keeper and provider:

```
OracleStore:
├── Add keeper wallet as authorized signer
└── Register PythOracleProvider for BRL token

DataStore:
├── Set maxPriceDeviation for BRL (e.g., 5%)
└── Set price feed reference
```

---

## FAQ

### Q: Can anyone run a keeper?

**No.** Only wallets registered as "authorized signers" in OracleStore can submit prices. Random submissions are rejected.

### Q: What if my keeper goes down?

Orders will stay pending until a keeper executes them. Users can cancel after expiration time (default: 5 minutes). Best practice: Run multiple keeper instances.

### Q: What if keeper and reference prices differ a lot?

The order execution reverts with a price deviation error. This protects users from bad prices.

### Q: Do I need Chainlink AND Pyth?

No. For BRL/forex, you'd use **only Pyth** since Chainlink doesn't have these feeds. You can use different providers for different tokens.

### Q: Is the keeper the same as a "bot"?

Yes. It's an automated service (bot) that watches for orders and executes them. GMX's official keepers are bots run by GMX team. You'll run your own for your forex markets.

### Q: What's the difference between Pyth API and Pyth Contract?

| Pyth API | Pyth Contract |
|----------|---------------|
| Off-chain HTTP endpoint | On-chain smart contract |
| Free to call | Costs gas |
| Used by keeper | Used for sanity check |
| Returns latest price | Returns on-chain price |
| `hermes.pyth.network/api/...` | `0x4305FB66699C3B2702D4d05CF36551390A4c69C6` |

### Q: Can I skip sanity checks entirely?

Yes, but not recommended for production. For testing, you can configure tokens to skip reference validation.

---

## Summary

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   KEEPER (your server)                                      │
│   ════════════════════                                      │
│   • Fetches prices from Pyth API (off-chain)               │
│   • Signs prices with authorized private key                │
│   • Submits to GMX to execute orders                       │
│   • THIS IS THE PRIMARY PRICE SOURCE                       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ORACLE PROVIDER (on-chain contract)                      │
│   ═══════════════════════════════════                      │
│   • Reads prices from Pyth contract (on-chain)             │
│   • Used ONLY for sanity checking keeper's price           │
│   • Prevents keeper from submitting wrong prices           │
│   • THIS IS JUST A SAFETY NET                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Remember**: The keeper provides prices. The oracle provider validates them.
