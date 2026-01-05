# Building a Pyth Oracle Provider (Sanity Check)

This document explains how to build a Pyth Oracle Provider for on-chain sanity checks. This is **optional** for MVP but recommended for production.

---

## Table of Contents

1. [Overview](#overview)
2. [Why Build This](#why-build-this)
3. [Difficulty Assessment](#difficulty-assessment)
4. [GMX Oracle Provider Architecture](#gmx-oracle-provider-architecture)
5. [The IOracleProvider Interface](#the-ioracleprovider-interface)
6. [Pyth Network Basics](#pyth-network-basics)
7. [Full Contract Implementation](#full-contract-implementation)
8. [Price Conversion Explained](#price-conversion-explained)
9. [Deployment Steps](#deployment-steps)
10. [Configuration & Registration](#configuration--registration)
11. [Testing the Provider](#testing-the-provider)
12. [Troubleshooting](#troubleshooting)

---

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   WHAT IS THIS?                                             │
│                                                             │
│   A smart contract that:                                    │
│   • Reads BRL/USD price from Pyth (on-chain)               │
│   • Provides it to GMX for sanity checking                 │
│   • Prevents keeper from submitting wrong prices           │
│                                                             │
│   NOT the primary price source - just validation!          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Where It Fits

```
KEEPER                           GMX ORACLE                    PYTH PROVIDER
(primary price)                  (validation)                  (sanity check)
     │                                │                              │
     │ Signs BRL = $0.16             │                              │
     │──────────────────────────────▶│                              │
     │                                │                              │
     │                                │ "Is $0.16 reasonable?"       │
     │                                │─────────────────────────────▶│
     │                                │                              │
     │                                │      Pyth says: $0.159       │
     │                                │◀─────────────────────────────│
     │                                │                              │
     │                                │ Deviation: 0.6% < 5% ✓       │
     │                                │ ACCEPT PRICE                 │
     │                                │                              │
```

---

## Why Build This

### MVP (Without Pyth Provider)

```
Keeper submits price → GMX accepts (no sanity check)
```

- Simpler setup
- Relies entirely on keeper integrity
- OK for testing and early MVP

### Production (With Pyth Provider)

```
Keeper submits price → GMX checks against Pyth → Accept/Reject
```

- Defense in depth
- Catches keeper bugs
- Prevents manipulation
- More secure for real money

### When to Add This

| Phase | Recommendation |
|-------|----------------|
| Local testing | Skip |
| Testnet MVP | Skip |
| Mainnet MVP (small TVL) | Optional |
| Production (real TVL) | Recommended |

---

## Difficulty Assessment

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   DIFFICULTY: ⭐⭐☆☆☆ (2 out of 5)                         │
│                                                             │
│   Time estimate: 2-4 hours                                  │
│                                                             │
│   Breakdown:                                                │
│   ├── Understanding interface: 30 min                      │
│   ├── Writing contract: 1-2 hours                          │
│   ├── Testing: 1 hour                                       │
│   └── Deployment & config: 30 min                          │
│                                                             │
│   Prerequisites:                                            │
│   ├── Basic Solidity knowledge                             │
│   ├── Understanding of GMX oracle flow (see docs)          │
│   └── Pyth price feed IDs for your tokens                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Why It's Easy

1. **Clean interface** - Only 3 functions to implement
2. **Example exists** - ChainlinkPriceFeedProvider to copy from
3. **Pyth is simple** - One function call to get price
4. **Small contract** - ~60-80 lines of code

---

## GMX Oracle Provider Architecture

### How GMX Supports Multiple Providers

GMX is designed to work with ANY price source through the provider pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                      GMX ORACLE                              │
│                                                              │
│   Registered Providers:                                      │
│   ├── ChainlinkPriceFeedProvider (ETH, BTC, etc.)          │
│   ├── ChainlinkDataStreamProvider (low latency)            │
│   ├── GmOracleProvider (GM token prices)                   │
│   └── PythOracleProvider (BRL, COP, ARS) ← YOU ADD THIS    │
│                                                              │
│   Token → Provider Mapping:                                  │
│   ├── ETH  → ChainlinkPriceFeedProvider                    │
│   ├── BTC  → ChainlinkPriceFeedProvider                    │
│   ├── BRL  → PythOracleProvider                            │
│   └── COP  → PythOracleProvider                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Existing Provider Examples

| Provider | File | Purpose |
|----------|------|---------|
| ChainlinkPriceFeedProvider | `contracts/oracle/ChainlinkPriceFeedProvider.sol` | Standard Chainlink feeds |
| ChainlinkDataStreamProvider | `contracts/oracle/ChainlinkDataStreamProvider.sol` | Chainlink Data Streams |
| GmOracleProvider | `contracts/oracle/GmOracleProvider.sol` | GM token pricing |
| EdgeDataStreamProvider | `contracts/oracle/EdgeDataStreamProvider.sol` | Edge oracle |

You're adding: **PythOracleProvider** - same pattern, different price source.

---

## The IOracleProvider Interface

### Location

`contracts/oracle/IOracleProvider.sol`

### Interface Definition

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./OracleUtils.sol";

interface IOracleProvider {
    /// @notice Get the oracle price for a token
    /// @param token The token address
    /// @param data Additional data (optional, can be empty)
    /// @return ValidatedPrice struct with price data
    function getOraclePrice(
        address token,
        bytes memory data
    ) external returns (OracleUtils.ValidatedPrice memory);

    /// @notice Should the timestamp be adjusted?
    /// @return true for most providers, false for Chainlink on-chain
    function shouldAdjustTimestamp() external pure returns (bool);

    /// @notice Is this the Chainlink on-chain provider?
    /// @return true only for ChainlinkPriceFeedProvider
    function isChainlinkOnChainProvider() external pure returns (bool);
}
```

### ValidatedPrice Struct

```solidity
struct ValidatedPrice {
    address token;      // Token this price is for
    uint256 min;        // Minimum price (can equal max for single price)
    uint256 max;        // Maximum price (can equal min for single price)
    uint256 timestamp;  // When this price was recorded
    address provider;   // Address of the provider (your contract)
}
```

### What Each Function Does

| Function | Purpose | Your Implementation |
|----------|---------|---------------------|
| `getOraclePrice` | Return current price from Pyth | Call Pyth, convert format, return |
| `shouldAdjustTimestamp` | Allow timestamp adjustment | Return `true` |
| `isChainlinkOnChainProvider` | Special Chainlink handling | Return `false` |

---

## Pyth Network Basics

### What is Pyth?

Pyth Network is a decentralized oracle providing price feeds for crypto, forex, equities, and commodities.

### Key Concepts

```
┌─────────────────────────────────────────────────────────────┐
│                     PYTH CONCEPTS                            │
│                                                              │
│   Price Feed ID                                              │
│   ─────────────                                              │
│   Each asset has a unique bytes32 identifier:                │
│   BRL/USD: 0x859e27cbcf6c14e29ccdfd76c6f839f6e4b0cf5f...    │
│                                                              │
│   Price Format                                               │
│   ────────────                                               │
│   struct Price {                                             │
│       int64 price;      // e.g., 16000000                   │
│       uint64 conf;      // confidence interval               │
│       int32 expo;       // e.g., -8                         │
│       uint256 publishTime;                                   │
│   }                                                          │
│                                                              │
│   Actual price = price × 10^expo                            │
│   Example: 16000000 × 10^(-8) = $0.16                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Pyth Contract Addresses

| Network | Address |
|---------|---------|
| Arbitrum One | `0xff1a0f4744e8582DF1aE09D5611b887B6a12925C` |
| Arbitrum Sepolia | `0x4374e5a8b9C22271E9EB878A2AA31DE97DF15DAF` |
| Avalanche | `0x4305FB66699C3B2702D4d05CF36551390A4c69C6` |
| Ethereum | `0x4305FB66699C3B2702D4d05CF36551390A4c69C6` |

Full list: https://docs.pyth.network/price-feeds/contract-addresses

### Price Feed IDs for Forex

| Pair | Price Feed ID |
|------|---------------|
| BRL/USD | `0x859e27cbcf6c14e29ccdfd76c6f839f6e4b0cf5f038f5b2a1adce465138e982f` |
| ARS/USD | Check Pyth website |
| COP/USD | Check Pyth website |
| EUR/USD | `0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b` |
| GBP/USD | `0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1` |

Full list: https://pyth.network/price-feeds

### Pyth Contract Interface

```solidity
interface IPyth {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }

    /// @notice Get price (reverts if too stale)
    function getPrice(bytes32 id) external view returns (Price memory);

    /// @notice Get price without staleness check
    function getPriceUnsafe(bytes32 id) external view returns (Price memory);

    /// @notice Get price no older than `age` seconds
    function getPriceNoOlderThan(bytes32 id, uint256 age) external view returns (Price memory);
}
```

---

## Full Contract Implementation

### File: `contracts/oracle/PythOracleProvider.sol`

```solidity
// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import "../data/DataStore.sol";
import "../data/Keys.sol";
import "./IOracleProvider.sol";
import "./OracleUtils.sol";

/**
 * @title PythOracleProvider
 * @notice Oracle provider that reads prices from Pyth Network
 * @dev Used for sanity checking keeper-submitted prices for forex tokens
 */

// Pyth interface (minimal)
interface IPyth {
    struct Price {
        int64 price;
        uint64 conf;
        int32 expo;
        uint256 publishTime;
    }

    function getPrice(bytes32 id) external view returns (Price memory);
    function getPriceUnsafe(bytes32 id) external view returns (Price memory);
    function getPriceNoOlderThan(bytes32 id, uint256 age) external view returns (Price memory);
}

contract PythOracleProvider is IOracleProvider {

    // ============ Immutables ============

    /// @notice The Pyth contract
    IPyth public immutable pyth;

    /// @notice The DataStore contract
    DataStore public immutable dataStore;

    // ============ Storage ============

    /// @notice Mapping from token address to Pyth price feed ID
    mapping(address => bytes32) public priceFeedIds;

    /// @notice Mapping from token address to token decimals
    mapping(address => uint8) public tokenDecimals;

    // ============ Errors ============

    error PriceFeedNotSet(address token);
    error InvalidPythPrice(address token, int64 price);
    error Unauthorized();

    // ============ Events ============

    event PriceFeedSet(address indexed token, bytes32 priceId, uint8 decimals);

    // ============ Constructor ============

    /**
     * @notice Initialize the Pyth Oracle Provider
     * @param _pyth Address of the Pyth contract
     * @param _dataStore Address of the GMX DataStore
     */
    constructor(address _pyth, DataStore _dataStore) {
        pyth = IPyth(_pyth);
        dataStore = _dataStore;
    }

    // ============ Admin Functions ============

    /**
     * @notice Set the Pyth price feed ID for a token
     * @param token The token address
     * @param priceId The Pyth price feed ID
     * @param decimals The token decimals (for price conversion)
     */
    function setPriceFeed(
        address token,
        bytes32 priceId,
        uint8 decimals
    ) external {
        // Check caller has CONFIG_KEEPER role
        if (!dataStore.getBool(Keys.isConfigKeeperKey(msg.sender))) {
            revert Unauthorized();
        }

        priceFeedIds[token] = priceId;
        tokenDecimals[token] = decimals;

        emit PriceFeedSet(token, priceId, decimals);
    }

    // ============ IOracleProvider Implementation ============

    /**
     * @notice Get the oracle price for a token from Pyth
     * @param token The token address
     * @param data Additional data (unused)
     * @return ValidatedPrice struct with price data
     */
    function getOraclePrice(
        address token,
        bytes memory /* data */
    ) external view override returns (OracleUtils.ValidatedPrice memory) {
        bytes32 priceId = priceFeedIds[token];

        if (priceId == bytes32(0)) {
            revert PriceFeedNotSet(token);
        }

        // Get price from Pyth (reverts if stale)
        IPyth.Price memory pythPrice = pyth.getPrice(priceId);

        // Validate price is positive
        if (pythPrice.price <= 0) {
            revert InvalidPythPrice(token, pythPrice.price);
        }

        // Convert to GMX price format
        uint256 gmxPrice = _convertToGmxPrice(
            pythPrice.price,
            pythPrice.expo,
            tokenDecimals[token]
        );

        return OracleUtils.ValidatedPrice({
            token: token,
            min: gmxPrice,
            max: gmxPrice,
            timestamp: pythPrice.publishTime,
            provider: address(this)
        });
    }

    /**
     * @notice Should timestamp be adjusted?
     * @return true - Pyth timestamps should be adjusted
     */
    function shouldAdjustTimestamp() external pure override returns (bool) {
        return true;
    }

    /**
     * @notice Is this a Chainlink on-chain provider?
     * @return false - This is Pyth, not Chainlink
     */
    function isChainlinkOnChainProvider() external pure override returns (bool) {
        return false;
    }

    // ============ Internal Functions ============

    /**
     * @notice Convert Pyth price format to GMX price format
     * @param pythPrice The price from Pyth (e.g., 16000000)
     * @param pythExpo The exponent from Pyth (e.g., -8)
     * @param decimals The token decimals (e.g., 8 for BRL)
     * @return The price in GMX format (30 decimal precision)
     *
     * @dev Pyth format: price × 10^expo = actual USD price
     *      GMX format: price × 10^(decimals-30) = actual USD price
     *
     *      Example for BRL at $0.16:
     *      - Pyth: 16000000 × 10^(-8) = 0.16
     *      - GMX (8 decimals): X × 10^(8-30) = 0.16
     *        Solving: X = 0.16 × 10^22 = 1.6 × 10^21
     */
    function _convertToGmxPrice(
        int64 pythPrice,
        int32 pythExpo,
        uint8 decimals
    ) internal pure returns (uint256) {
        // Convert to uint (we already validated price > 0)
        uint256 price = uint256(uint64(pythPrice));

        // GMX stores prices with (30 - tokenDecimals) extra decimals
        // So target exponent is -(30 - decimals) = decimals - 30
        //
        // We have: price × 10^pythExpo
        // We want: result × 10^(decimals - 30)
        //
        // So: result = price × 10^(pythExpo - (decimals - 30))
        //            = price × 10^(pythExpo - decimals + 30)

        int256 exponentAdjustment = int256(pythExpo) - int256(uint256(decimals)) + 30;

        if (exponentAdjustment >= 0) {
            // Multiply by 10^adjustment
            return price * (10 ** uint256(exponentAdjustment));
        } else {
            // Divide by 10^|adjustment|
            return price / (10 ** uint256(-exponentAdjustment));
        }
    }

    // ============ View Functions ============

    /**
     * @notice Check if a token has a price feed configured
     * @param token The token address
     * @return True if price feed is set
     */
    function hasPriceFeed(address token) external view returns (bool) {
        return priceFeedIds[token] != bytes32(0);
    }

    /**
     * @notice Get the current Pyth price for a token (for debugging)
     * @param token The token address
     * @return The raw Pyth price struct
     */
    function getRawPythPrice(address token) external view returns (IPyth.Price memory) {
        bytes32 priceId = priceFeedIds[token];
        require(priceId != bytes32(0), "price feed not set");
        return pyth.getPriceUnsafe(priceId);
    }
}
```

---

## Price Conversion Explained

This is the trickiest part, so let's break it down:

### The Two Formats

```
PYTH FORMAT
───────────
price × 10^expo = actual USD value

Example: BRL = $0.16
Pyth returns: { price: 16000000, expo: -8 }
Calculation: 16000000 × 10^(-8) = 0.16 ✓


GMX FORMAT
──────────
storedPrice × 10^(tokenDecimals - 30) = actual USD value

Example: BRL = $0.16 (8 decimals)
GMX needs: X × 10^(8-30) = 0.16
Solving: X = 0.16 × 10^22 = 1.6 × 10^21
```

### The Conversion Math

```
Given:
- pythPrice = 16000000
- pythExpo = -8
- tokenDecimals = 8

Step 1: We have price × 10^(-8) in Pyth
Step 2: We need result × 10^(8-30) = result × 10^(-22) in GMX

Step 3: Set them equal
  pythPrice × 10^pythExpo = result × 10^(decimals-30)

Step 4: Solve for result
  result = pythPrice × 10^(pythExpo - decimals + 30)
  result = 16000000 × 10^(-8 - 8 + 30)
  result = 16000000 × 10^14
  result = 1.6 × 10^21 ✓
```

### Visual Conversion

```
┌─────────────────────────────────────────────────────────────┐
│                   PRICE CONVERSION                           │
│                                                              │
│   Pyth: 16000000 × 10^(-8)                                  │
│                     │                                        │
│                     │  × 10^(pythExpo - decimals + 30)       │
│                     │  = × 10^(-8 - 8 + 30)                  │
│                     │  = × 10^14                             │
│                     │                                        │
│                     ▼                                        │
│   GMX:  1,600,000,000,000,000,000,000                       │
│         (1.6 × 10^21)                                        │
│                                                              │
│   Both represent: $0.16 per BRL                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Deployment Steps

### Step 1: Deploy the Contract

```typescript
// scripts/deployPythProvider.ts
import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with:", deployer.address);

    // Get existing contracts
    const dataStore = await ethers.getContract("DataStore");

    // Pyth address for your network
    const PYTH_ADDRESS = "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C"; // Arbitrum

    // Deploy PythOracleProvider
    const PythOracleProvider = await ethers.getContractFactory("PythOracleProvider");
    const pythProvider = await PythOracleProvider.deploy(
        PYTH_ADDRESS,
        dataStore.address
    );
    await pythProvider.deployed();

    console.log("PythOracleProvider deployed to:", pythProvider.address);
}

main().catch(console.error);
```

### Step 2: Configure Price Feeds

```typescript
// scripts/configurePythFeeds.ts
import { ethers } from "hardhat";

async function main() {
    const pythProvider = await ethers.getContract("PythOracleProvider");

    // BRL token address (your synthetic token)
    const BRL_TOKEN = "0x..."; // Your BRL synthetic address

    // Pyth BRL/USD price feed ID
    const BRL_PRICE_ID = "0x859e27cbcf6c14e29ccdfd76c6f839f6e4b0cf5f038f5b2a1adce465138e982f";

    // BRL has 8 decimals
    const BRL_DECIMALS = 8;

    // Set the price feed
    await pythProvider.setPriceFeed(BRL_TOKEN, BRL_PRICE_ID, BRL_DECIMALS);

    console.log("BRL price feed configured");
}

main().catch(console.error);
```

### Step 3: Register Provider in GMX

```typescript
// scripts/registerPythProvider.ts
import { ethers } from "hardhat";
import { Keys } from "../utils/keys";

async function main() {
    const dataStore = await ethers.getContract("DataStore");
    const oracle = await ethers.getContract("Oracle");
    const pythProvider = await ethers.getContract("PythOracleProvider");

    const BRL_TOKEN = "0x..."; // Your BRL synthetic address

    // 1. Enable the provider
    await dataStore.setBool(
        Keys.isOracleProviderEnabledKey(pythProvider.address),
        true
    );
    console.log("Provider enabled");

    // 2. Set as provider for BRL token
    await dataStore.setAddress(
        Keys.oracleProviderForTokenKey(oracle.address, BRL_TOKEN),
        pythProvider.address
    );
    console.log("Provider set for BRL");

    // 3. (Optional) Set timestamp adjustment if needed
    // await dataStore.setUint(
    //     Keys.oracleTimestampAdjustmentKey(pythProvider.address, BRL_TOKEN),
    //     0 // adjustment in seconds
    // );
}

main().catch(console.error);
```

---

## Configuring Pyth via `config/tokens.ts`

If you want to enable sanity checks using Pyth, you can configure it in `config/tokens.ts`. This is an alternative to using `ChainlinkPriceFeedProvider` for tokens where Chainlink doesn't have a price feed.

### Token Configuration with Pyth Price Feed

```typescript
// config/tokens.ts

// Option 1: Synthetic token WITHOUT sanity check (keeper-only)
BRL: {
  synthetic: true,
  decimals: 8,
  // No priceFeed = no sanity check, relies entirely on keeper
},

// Option 2: Synthetic token WITH Pyth sanity check
BRL: {
  synthetic: true,
  decimals: 8,
  // Pyth price feed configuration
  pythPriceFeed: {
    priceId: "0x859e27cbcf6c14e29ccdfd76c6f839f6e4b0cf5f038f5b2a1adce465138e982f",  // BRL/USD
    // Note: You need PythOracleProvider deployed and registered
  },
},

// Option 3: Real token with Chainlink (standard GMX pattern)
WETH: {
  address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  decimals: 18,
  priceFeed: {
    address: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",  // Chainlink ETH/USD
    decimals: 8,
    heartbeatDuration: (24 + 1) * 60 * 60,
  },
},
```

### How `priceFeed` Controls Sanity Check

The presence or absence of `priceFeed` in `config/tokens.ts` determines whether sanity checks are enabled:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   TOKEN CONFIG → DEPLOYMENT → SANITY CHECK BEHAVIOR         │
│                                                             │
│   config/tokens.ts          deploy/              Oracle.sol │
│   ─────────────────         ──────────          ─────────── │
│                                                             │
│   No priceFeed property                                     │
│        │                                                    │
│        ▼                                                    │
│   Deploy scripts skip       →  No priceFeedKey  →  SKIPPED  │
│   setAddress() call            in DataStore                 │
│                                                             │
│   Has priceFeed property                                    │
│        │                                                    │
│        ▼                                                    │
│   Deploy calls              →  priceFeedKey     →  ENABLED  │
│   setAddress(priceFeedKey)     stored                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Finding Pyth Price Feed IDs

To get the correct Pyth price feed ID for your token:

1. Visit https://pyth.network/price-feeds
2. Search for your token pair (e.g., "BRL/USD")
3. Copy the Price Feed ID

| Currency | Pair | Pyth Price Feed ID |
|----------|------|-------------------|
| BRL | BRL/USD | `0x859e27cbcf6c14e29ccdfd76c6f839f6e4b0cf5f038f5b2a1adce465138e982f` |
| EUR | EUR/USD | `0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b` |
| GBP | GBP/USD | `0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1` |
| ARS | ARS/USD | Check Pyth website (may not be available) |
| COP | COP/USD | Check Pyth website (may not be available) |

### MVP Recommendation

For MVP, we recommend **NOT** configuring a `priceFeed`:

```typescript
// config/tokens.ts - MVP approach

BRL: {
  synthetic: true,
  decimals: 8,
  // No priceFeed = keeper-only validation
  // This is simpler and sufficient for MVP
},
```

**Why?**
- Simpler setup (no PythOracleProvider deployment needed)
- Faster time to market
- Your keeper can still fetch from Pyth API off-chain
- Add on-chain sanity check later when scaling

### When to Add Pyth Sanity Check

| Phase | Recommendation |
|-------|----------------|
| Local testing | No priceFeed (sanity check skipped) |
| Testnet MVP | No priceFeed (sanity check skipped) |
| Mainnet MVP (< $100K TVL) | Optional |
| Production (> $100K TVL) | Recommended - add PythOracleProvider |

---

## Configuration & Registration

### DataStore Keys Used

| Key | Purpose | Value |
|-----|---------|-------|
| `isOracleProviderEnabledKey(provider)` | Enable provider | `true` |
| `oracleProviderForTokenKey(oracle, token)` | Set provider for token | Provider address |
| `oracleTimestampAdjustmentKey(provider, token)` | Timestamp offset | Seconds (usually 0) |

### Key Generation (from Keys.sol)

```solidity
function isOracleProviderEnabledKey(address provider) internal pure returns (bytes32) {
    return keccak256(abi.encode(IS_ORACLE_PROVIDER_ENABLED, provider));
}

function oracleProviderForTokenKey(address oracle, address token) internal pure returns (bytes32) {
    return keccak256(abi.encode(ORACLE_PROVIDER_FOR_TOKEN, oracle, token));
}
```

### Full Registration Flow

```
┌─────────────────────────────────────────────────────────────┐
│               REGISTRATION CHECKLIST                         │
│                                                              │
│   □ Deploy PythOracleProvider                               │
│     └── Constructor: (pythAddress, dataStoreAddress)        │
│                                                              │
│   □ Set price feed for BRL                                  │
│     └── pythProvider.setPriceFeed(brlToken, priceId, 8)     │
│                                                              │
│   □ Enable provider in DataStore                            │
│     └── dataStore.setBool(isOracleProviderEnabledKey, true) │
│                                                              │
│   □ Set as provider for BRL token                           │
│     └── dataStore.setAddress(oracleProviderForTokenKey, ..) │
│                                                              │
│   □ (Optional) Add more tokens                              │
│     └── Repeat setPriceFeed for COP, ARS, etc.             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Testing the Provider

### Unit Test

```typescript
// test/oracle/PythOracleProvider.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";

describe("PythOracleProvider", () => {
    let pythProvider;
    let mockPyth;
    let dataStore;

    const BRL_PRICE_ID = "0x859e27cbcf6c14e29ccdfd76c6f839f6e4b0cf5f038f5b2a1adce465138e982f";
    const BRL_TOKEN = "0x1234567890123456789012345678901234567890";

    beforeEach(async () => {
        // Deploy mock Pyth
        const MockPyth = await ethers.getContractFactory("MockPyth");
        mockPyth = await MockPyth.deploy();

        // Get DataStore
        dataStore = await ethers.getContract("DataStore");

        // Deploy provider
        const PythOracleProvider = await ethers.getContractFactory("PythOracleProvider");
        pythProvider = await PythOracleProvider.deploy(mockPyth.address, dataStore.address);

        // Configure price feed
        await pythProvider.setPriceFeed(BRL_TOKEN, BRL_PRICE_ID, 8);
    });

    it("should return correct price for BRL", async () => {
        // Set mock price: $0.16
        await mockPyth.setPrice(BRL_PRICE_ID, {
            price: 16000000,
            conf: 10000,
            expo: -8,
            publishTime: Math.floor(Date.now() / 1000)
        });

        // Get price
        const result = await pythProvider.getOraclePrice(BRL_TOKEN, "0x");

        // Expected: 0.16 * 10^22 = 1.6 * 10^21
        const expectedPrice = ethers.BigNumber.from("1600000000000000000000");

        expect(result.min).to.equal(expectedPrice);
        expect(result.max).to.equal(expectedPrice);
    });

    it("should revert for token without price feed", async () => {
        const randomToken = "0x0000000000000000000000000000000000000001";

        await expect(
            pythProvider.getOraclePrice(randomToken, "0x")
        ).to.be.revertedWithCustomError(pythProvider, "PriceFeedNotSet");
    });
});
```

### Integration Test

```typescript
// Test with actual GMX oracle flow
it("should work in GMX sanity check flow", async () => {
    // 1. Set up provider
    await dataStore.setBool(Keys.isOracleProviderEnabledKey(pythProvider.address), true);
    await dataStore.setAddress(
        Keys.oracleProviderForTokenKey(oracle.address, BRL_TOKEN),
        pythProvider.address
    );

    // 2. Mock Pyth price
    await mockPyth.setPrice(BRL_PRICE_ID, {
        price: 16000000,  // $0.16
        conf: 10000,
        expo: -8,
        publishTime: Math.floor(Date.now() / 1000)
    });

    // 3. Execute order with keeper price close to Pyth
    // If keeper price is within deviation, should succeed
    // If keeper price is way off, should fail
});
```

---

## Troubleshooting

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `PriceFeedNotSet` | Token not configured | Call `setPriceFeed()` |
| `InvalidPythPrice` | Pyth returned 0 or negative | Check Pyth feed ID |
| `Unauthorized` | Caller not CONFIG_KEEPER | Use authorized account |
| `stale price` (from Pyth) | Price too old | Pyth needs price updates |

### Price Mismatch Issues

```
Symptom: Sanity check always fails

Debug steps:
1. Get raw Pyth price:
   const raw = await pythProvider.getRawPythPrice(brlToken);
   console.log("Pyth price:", raw.price, "expo:", raw.expo);

2. Get converted GMX price:
   const gmx = await pythProvider.getOraclePrice(brlToken, "0x");
   console.log("GMX price:", gmx.min.toString());

3. Compare with keeper price:
   console.log("Keeper price:", keeperPrice.toString());

4. Check deviation:
   const deviation = |keeper - gmx| / gmx * 100;
   console.log("Deviation:", deviation, "%");
```

### Pyth Price Not Updating

On testnets/mainnets, Pyth prices need to be "pushed" by updating the contract:

```typescript
// If using Pyth with price updates
const priceUpdateData = await getPythPriceUpdateData(); // From Pyth API
await pyth.updatePriceFeeds(priceUpdateData, { value: updateFee });
```

For sanity checks, you typically use `getPriceUnsafe()` which doesn't require updates but may be stale.

---

## Deploying on New/Unsupported Chains

### The Problem

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   SCENARIO: You want to deploy on "NewChain"                │
│                                                             │
│   Question: Is Pyth deployed on NewChain?                   │
│                                                             │
│   If NO → PythOracleProvider won't work                     │
│   Same applies to Chainlink                                 │
│                                                             │
│   GOOD NEWS: You don't NEED them!                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Why It Doesn't Block You

Remember the GMX architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   PRIMARY PRICE SOURCE: Your Keeper                         │
│   ─────────────────────────────────                         │
│   Keeper fetches prices from ANY off-chain source:          │
│   • Pyth API (works even if Pyth not on-chain)             │
│   • Chainlink Data Streams                                  │
│   • Binance/Coinbase/Kraken APIs                           │
│   • Your own price aggregator                               │
│                                                             │
│   SANITY CHECK: Optional On-Chain Validation                │
│   ────────────────────────────────────────                  │
│   Only needed if you want to verify keeper prices           │
│   If not configured → check is skipped                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Your Options on Unsupported Chains

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   OPTION 1: No Sanity Check (Simplest)                     │
│   ─────────────────────────────────────                     │
│   • Don't configure any oracle provider for your tokens     │
│   • GMX skips sanity check when no provider set             │
│   • You trust your keeper 100%                              │
│   • RECOMMENDED FOR: MVP, testnets, low TVL                 │
│                                                             │
│   OPTION 2: Request Pyth/Chainlink Deployment              │
│   ───────────────────────────────────────────               │
│   • Pyth: Apply at https://pyth.network/contact            │
│   • Chainlink: https://chain.link/contact                  │
│   • Usually requires chain to have significant activity     │
│   • Can take weeks/months                                   │
│   • RECOMMENDED FOR: Established chains, high TVL           │
│                                                             │
│   OPTION 3: Build Your Own Oracle Provider                 │
│   ─────────────────────────────────────────                 │
│   • Implement IOracleProvider interface                     │
│   • Use ANY price source available on your chain            │
│   • Examples: DEX TWAP, other oracles, custom solution     │
│   • RECOMMENDED FOR: Chains with alternative oracles        │
│                                                             │
│   OPTION 4: Run Your Own Oracle Infrastructure             │
│   ─────────────────────────────────────────────             │
│   • Deploy your own price feed contracts                    │
│   • Run off-chain price updaters                            │
│   • More complex but full control                           │
│   • RECOMMENDED FOR: Serious production deployments        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Option 1 Details: Skip Sanity Check

This is what we documented for MVP. Simply don't configure a provider:

```solidity
// In Oracle.sol validation flow:
address provider = dataStore.getAddress(oracleProviderForTokenKey(oracle, token));

if (provider == address(0)) {
    // No provider configured → skip sanity check
    // Keeper price accepted as-is
    return;
}

// Only reaches here if provider is configured
// Then it checks keeper price against provider price
```

**How to implement:**
```typescript
// Just don't do this:
// dataStore.setAddress(oracleProviderForTokenKey(oracle, brlToken), providerAddress);

// If you never set a provider for BRL, sanity check is skipped
```

### Option 3 Details: Custom Oracle Provider

If your target chain has ANY price source, you can build a provider for it:

**Example: DEX TWAP Oracle Provider**

```solidity
// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "./IOracleProvider.sol";

interface IUniswapV3Pool {
    function observe(uint32[] calldata secondsAgos)
        external view returns (int56[] memory tickCumulatives, uint160[] memory);
}

/**
 * @title TwapOracleProvider
 * @notice Uses Uniswap V3 TWAP as sanity check
 * @dev Works on ANY chain with Uniswap V3 or compatible DEX
 */
contract TwapOracleProvider is IOracleProvider {

    struct PoolConfig {
        address pool;           // Uniswap V3 pool address
        uint32 twapPeriod;      // TWAP period in seconds (e.g., 1800 = 30 min)
        uint8 tokenDecimals;    // Token decimals for price conversion
        bool isToken0;          // Is our token token0 in the pool?
    }

    mapping(address => PoolConfig) public poolConfigs;

    function getOraclePrice(
        address token,
        bytes memory
    ) external view override returns (OracleUtils.ValidatedPrice memory) {
        PoolConfig memory config = poolConfigs[token];
        require(config.pool != address(0), "Pool not configured");

        // Get TWAP price from Uniswap V3
        uint256 price = _getTwapPrice(config);

        // Convert to GMX format
        uint256 gmxPrice = _convertToGmxPrice(price, config.tokenDecimals);

        return OracleUtils.ValidatedPrice({
            token: token,
            min: gmxPrice,
            max: gmxPrice,
            timestamp: block.timestamp,
            provider: address(this)
        });
    }

    function _getTwapPrice(PoolConfig memory config) internal view returns (uint256) {
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = config.twapPeriod;
        secondsAgos[1] = 0;

        (int56[] memory tickCumulatives,) = IUniswapV3Pool(config.pool).observe(secondsAgos);

        int56 tickDelta = tickCumulatives[1] - tickCumulatives[0];
        int24 avgTick = int24(tickDelta / int56(uint56(config.twapPeriod)));

        // Convert tick to price (simplified)
        uint256 price = _tickToPrice(avgTick, config.isToken0);
        return price;
    }

    // ... price conversion helpers

    function shouldAdjustTimestamp() external pure override returns (bool) { return true; }
    function isChainlinkOnChainProvider() external pure override returns (bool) { return false; }
}
```

**Other Alternative Price Sources:**

| Source | Availability | Example |
|--------|--------------|---------|
| Uniswap V3 TWAP | Any chain with Uni V3 | See above |
| SushiSwap TWAP | Many chains | Similar to Uniswap |
| Band Protocol | 20+ chains | `IStdReference.getReferenceData()` |
| DIA Oracle | 30+ chains | `IDIAOracleV2.getValue()` |
| Redstone | 50+ chains | Pull-based like Pyth |
| API3 | Growing | QRNG + price feeds |
| Umbrella Network | Multiple | Decentralized oracle |

### Option 4 Details: Your Own Infrastructure

For maximum control, deploy your own oracle system:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   YOUR OWN ORACLE INFRASTRUCTURE                            │
│                                                             │
│   On-Chain:                                                 │
│   ├── PriceFeedContract.sol                                │
│   │   └── Stores latest prices per token                   │
│   └── YourOracleProvider.sol                               │
│       └── Implements IOracleProvider, reads from above     │
│                                                             │
│   Off-Chain:                                                │
│   └── Price Updater Service                                │
│       ├── Fetches prices from multiple sources             │
│       │   ├── Pyth API (off-chain, works everywhere)       │
│       │   ├── Chainlink Data Streams                       │
│       │   ├── CEX APIs (Binance, Coinbase)                 │
│       │   └── DEX prices (Uniswap, etc.)                   │
│       ├── Aggregates/validates prices                       │
│       └── Posts to PriceFeedContract on-chain              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Simple Price Feed Contract:**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimplePriceFeed {
    struct PriceData {
        uint256 price;
        uint256 timestamp;
    }

    mapping(address => PriceData) public prices;
    mapping(address => bool) public updaters;

    address public owner;

    modifier onlyUpdater() {
        require(updaters[msg.sender], "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
        updaters[msg.sender] = true;
    }

    function setPrice(address token, uint256 price) external onlyUpdater {
        prices[token] = PriceData({
            price: price,
            timestamp: block.timestamp
        });
    }

    function setBatchPrices(
        address[] calldata tokens,
        uint256[] calldata _prices
    ) external onlyUpdater {
        require(tokens.length == _prices.length, "Length mismatch");
        for (uint i = 0; i < tokens.length; i++) {
            prices[tokens[i]] = PriceData({
                price: _prices[i],
                timestamp: block.timestamp
            });
        }
    }

    function getPrice(address token) external view returns (uint256, uint256) {
        PriceData memory data = prices[token];
        return (data.price, data.timestamp);
    }

    function addUpdater(address updater) external {
        require(msg.sender == owner, "Not owner");
        updaters[updater] = true;
    }
}
```

**Off-Chain Updater (Node.js):**

```typescript
// price-updater.ts
import { ethers } from "ethers";

const PRICE_SOURCES = {
    BRL: [
        { name: "pyth", url: "https://hermes.pyth.network/api/latest_price_feeds?ids[]=0x859e..." },
        { name: "binance", url: "https://api.binance.com/api/v3/ticker/price?symbol=BRLUSDT" },
    ]
};

async function fetchPrice(token: string): Promise<number> {
    const sources = PRICE_SOURCES[token];
    const prices: number[] = [];

    for (const source of sources) {
        try {
            const response = await fetch(source.url);
            const data = await response.json();
            prices.push(parsePrice(source.name, data));
        } catch (e) {
            console.error(`${source.name} failed:`, e);
        }
    }

    // Return median price
    prices.sort((a, b) => a - b);
    return prices[Math.floor(prices.length / 2)];
}

async function updatePrices() {
    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const priceFeed = new ethers.Contract(PRICE_FEED_ADDRESS, ABI, wallet);

    const tokens = ["BRL", "COP", "ARS"];
    const addresses = [BRL_ADDRESS, COP_ADDRESS, ARS_ADDRESS];
    const prices = await Promise.all(tokens.map(fetchPrice));

    // Convert to GMX format
    const gmxPrices = prices.map((p, i) => convertToGmxFormat(p, TOKEN_DECIMALS[i]));

    await priceFeed.setBatchPrices(addresses, gmxPrices);
    console.log("Prices updated:", tokens.map((t, i) => `${t}: $${prices[i]}`));
}

// Run every minute
setInterval(updatePrices, 60000);
updatePrices();
```

### Decision Matrix

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   WHICH OPTION SHOULD YOU CHOOSE?                           │
│                                                             │
│   ┌─────────────┬────────────┬────────────┬─────────────┐  │
│   │ Scenario    │ Complexity │ Security   │ Recommend   │  │
│   ├─────────────┼────────────┼────────────┼─────────────┤  │
│   │ MVP/Testnet │ None       │ Low        │ Option 1    │  │
│   │ Low TVL     │ None       │ Medium     │ Option 1    │  │
│   │ Medium TVL  │ Low        │ Medium     │ Option 3    │  │
│   │ High TVL    │ Medium     │ High       │ Option 2/4  │  │
│   │ Critical    │ High       │ Very High  │ Option 4    │  │
│   └─────────────┴────────────┴────────────┴─────────────┘  │
│                                                             │
│   TVL Guidelines:                                           │
│   • Low: < $100K                                           │
│   • Medium: $100K - $1M                                    │
│   • High: $1M - $10M                                       │
│   • Critical: > $10M                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### How Localhost Testing Works (No Chainlink Deployed)

This is important to understand. In your `test-brl-short-position.ts` script:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   QUESTION: How does localhost work without Chainlink?      │
│                                                             │
│   ANSWER: The sanity check is AUTOMATICALLY SKIPPED         │
│                                                             │
└─────────────────────────────────────────────────────────────┘

THE FLOW IN TESTS:

1. Test calls executeOrder() with signed prices
                │
                ▼
2. Oracle.sol receives prices from GmOracleProvider
   (GmOracleProvider validates signatures from test signers)
                │
                ▼
3. Oracle checks: isChainlinkOnChainProvider()?
   GmOracleProvider returns: FALSE
                │
                ▼
4. Oracle calls: ChainlinkPriceFeedUtils.getPriceFeedPrice(token)
                │
                ▼
5. ChainlinkPriceFeedUtils looks up:
   priceFeedAddress = dataStore.getAddress(priceFeedKey(token))
                │
                ▼
6. In localhost: priceFeedAddress = address(0)
   (no Chainlink feed was ever configured!)
                │
                ▼
7. Returns: (hasRefPrice: FALSE, refPrice: 0)
                │
                ▼
8. Oracle.sol line 307: if (hasRefPrice) { ... }
   hasRefPrice is FALSE → SKIP SANITY CHECK
                │
                ▼
9. Price accepted without validation! ✓
```

**The key code in ChainlinkPriceFeedUtils.sol:**

```solidity
function getPriceFeedPrice(DataStore dataStore, address token)
    internal view returns (bool, uint256)
{
    address priceFeedAddress = dataStore.getAddress(Keys.priceFeedKey(token));

    if (priceFeedAddress == address(0)) {
        return (false, 0);  // ← NO REFERENCE PRICE, SKIP CHECK
    }

    // Only reaches here if price feed is configured
    // Read from Chainlink, validate staleness, etc.
}
```

**So in localhost:**
- No Chainlink contracts exist
- No price feed addresses are configured in DataStore
- `hasRefPrice` is always `false` for all tokens
- Sanity check is skipped for ALL tokens
- Your signed test prices are accepted directly

**This is the SAME behavior as "Option 1: Skip Sanity Check"** - it happens automatically when no price feed is configured!

---

### Key Insight: Keeper is Everything

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   REMEMBER: The sanity check is DEFENSE IN DEPTH            │
│                                                             │
│   Your KEEPER is the primary security:                      │
│   • It fetches prices from reliable sources                 │
│   • It signs prices cryptographically                       │
│   • GMX trusts keeper-signed prices                         │
│                                                             │
│   The on-chain oracle provider (Pyth/Chainlink/custom):     │
│   • Only validates the keeper isn't lying                   │
│   • Is a BACKUP safety check                                │
│   • Can be added later when available                       │
│                                                             │
│   For a new chain without Pyth/Chainlink:                   │
│   1. Start without sanity check (Option 1)                  │
│   2. Build a good keeper with multi-source prices           │
│   3. Add sanity check later when oracle support comes       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   BUILDING PYTH ORACLE PROVIDER                             │
│                                                             │
│   Difficulty: Easy (2/5)                                    │
│   Time: 2-4 hours                                           │
│   Lines of code: ~80                                        │
│                                                             │
│   What you implement:                                       │
│   ├── getOraclePrice() - Fetch from Pyth, convert format   │
│   ├── shouldAdjustTimestamp() - return true                │
│   └── isChainlinkOnChainProvider() - return false          │
│                                                             │
│   Key challenge:                                            │
│   └── Price format conversion (documented above)            │
│                                                             │
│   Steps:                                                    │
│   1. Deploy contract                                        │
│   2. Configure price feeds (token → Pyth ID)               │
│   3. Register in GMX DataStore                             │
│   4. Test!                                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

*Last updated: December 2024*
