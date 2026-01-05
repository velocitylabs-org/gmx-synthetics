# Local Testing vs Production Deployment

This document explains the **critical differences** between running tests locally with Hardhat and deploying to a real blockchain (testnet or mainnet).

---

## Table of Contents

1. [TL;DR - The Reality Check](#tldr---the-reality-check)
2. [What Local Tests Do Automatically](#what-local-tests-do-automatically)
3. [What You Must Do for Real Deployment](#what-you-must-do-for-real-deployment)
4. [The Critical Missing Piece: Keeper Service](#the-critical-missing-piece-keeper-service)
5. [Deployment Checklist](#deployment-checklist)
6. [Step-by-Step: Local to Testnet](#step-by-step-local-to-testnet)
7. [Common Pitfalls](#common-pitfalls)

---

## TL;DR - The Reality Check

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   LOCAL TEST (Hardhat)          vs    REAL CHAIN (Testnet/Mainnet) │
│   ═══════════════════                 ═══════════════════════════  │
│                                                                     │
│   deployFixture() does                You must do EVERYTHING:       │
│   EVERYTHING for you:                                               │
│                                                                     │
│   ✅ Deploy 100+ contracts            ❌ Deploy contracts manually  │
│   ✅ Create markets                   ❌ Create markets manually    │
│   ✅ Configure roles                  ❌ Configure all roles        │
│   ✅ Fund test accounts               ❌ Get real testnet tokens    │
│   ✅ Mock oracle prices               ❌ BUILD A KEEPER SERVICE     │
│   ✅ Execute orders instantly         ❌ Run keeper 24/7            │
│                                                                     │
│   Time to run: ~5 seconds             Time to set up: Days/Weeks   │
│                                                                     │
│   ⚠️  LOCAL TEST PASSING ≠ PRODUCTION READY                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## What Local Tests Do Automatically

When you run a script like `test-brl-short-position.ts` locally, the magic happens in `deployFixture()`:

### What deployFixture() Creates

```typescript
// From utils/fixture.ts - this single line does EVERYTHING:
const fixture = await deployFixture();
```

**Behind the scenes, deployFixture() automatically:**

| Component | What It Does | Lines of Code |
|-----------|--------------|---------------|
| **100+ Contracts** | Deploys DataStore, RoleStore, Oracle, ExchangeRouter, Handlers, Vaults, etc. | ~2000 lines |
| **Mock Tokens** | Creates WETH, USDC, WBTC, BRL with mint functions | ~100 lines |
| **Markets** | Creates ETH/USD, BTC/USD, BRL/USD markets | ~200 lines |
| **Roles** | Assigns CONTROLLER, ORDER_KEEPER, etc. to test accounts | ~50 lines |
| **Oracle Signers** | Registers test signers that can sign any price | ~30 lines |
| **Liquidity** | Seeds pools with test liquidity | ~100 lines |
| **Test Accounts** | Funds accounts with unlimited test tokens | ~20 lines |

### Why Local Tests "Just Work"

```
LOCAL TEST FLOW
═══════════════

     Test Script                    deployFixture()
         │                               │
         │  const fixture = ...          │
         ▼                               ▼
    ┌─────────┐                   ┌──────────────┐
    │  START  │ ──────────────▶   │ Deploy ALL   │
    └─────────┘                   │ 100+ contracts│
                                  └──────┬───────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │ Create markets│
                                  │ (ETH, BTC,   │
                                  │  BRL, etc.)  │
                                  └──────┬───────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │ Set up roles │
                                  │ & permissions│
                                  └──────┬───────┘
                                         │
                                         ▼
                                  ┌──────────────┐
                                  │ Fund accounts│
                                  │ with tokens  │
                                  └──────┬───────┘
                                         │
         ┌───────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────────────┐
    │  NOW your test script runs:                 │
    │                                             │
    │  1. Create order (ExchangeRouter)           │
    │  2. Execute order directly (you ARE keeper) │
    │  3. Check position (Reader)                 │
    │                                             │
    │  Everything works because fixture set it up │
    └─────────────────────────────────────────────┘
```

### Key Point: You ARE the Keeper in Tests

In local tests, your script directly calls `executeOrder()`:

```typescript
// In test - YOU execute the order instantly
await orderHandler.executeOrder(orderKey, oracleParams);
```

This works because:
1. `deployFixture()` gave your account the `ORDER_KEEPER` role
2. You provide mock oracle prices inline
3. No waiting, no external service needed

---

## What You Must Do for Real Deployment

### The Brutal Truth

```
PRODUCTION DEPLOYMENT
═════════════════════

There is NO deployFixture(). You must:

┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  1. DEPLOY CONTRACTS                                               │
│     ├── Run 160+ deployment scripts in correct order               │
│     ├── Verify each contract on block explorer                     │
│     ├── Handle deployment failures and retries                     │
│     └── Estimated: 2-4 hours per deployment                        │
│                                                                    │
│  2. CREATE MARKETS                                                 │
│     ├── Call MarketFactory.createMarket() for each market          │
│     ├── Configure market parameters (fees, limits, etc.)           │
│     ├── Set up price feeds for each token                          │
│     └── Estimated: 1-2 hours per market                            │
│                                                                    │
│  3. CONFIGURE ROLES                                                │
│     ├── Grant CONTROLLER role to admin                             │
│     ├── Grant ORDER_KEEPER to keeper service                       │
│     ├── Register oracle signers in OracleStore                     │
│     └── Estimated: 30 minutes                                      │
│                                                                    │
│  4. BUILD KEEPER SERVICE  ⚠️ CRITICAL                              │
│     ├── Watch blockchain for pending orders                        │
│     ├── Fetch prices from Pyth/Chainlink                           │
│     ├── Sign prices with registered signer key                     │
│     ├── Submit execute transactions                                │
│     ├── Handle errors, retries, gas estimation                     │
│     ├── Run 24/7 with monitoring                                   │
│     └── Estimated: 1-2 weeks development                           │
│                                                                    │
│  5. SEED LIQUIDITY                                                 │
│     ├── Get real tokens (USDC, etc.)                               │
│     ├── Create deposit, execute deposit                            │
│     └── Estimated: 1 hour (but need real $$)                       │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Why Orders Won't Execute Without a Keeper

```
PRODUCTION FLOW (WITHOUT KEEPER = BROKEN)
═════════════════════════════════════════

User creates order:

    User                          Blockchain
      │                               │
      │  createOrder(SHORT BRL)       │
      ▼                               ▼
  ┌────────┐                   ┌──────────────┐
  │ Submit │ ─────────────────▶│ Order stored │
  │   TX   │                   │ in DataStore │
  └────────┘                   └──────┬───────┘
                                      │
                                      ▼
                               ┌──────────────┐
                               │   WAITING    │
                               │   WAITING    │
                               │   WAITING    │◀──── No one is watching!
                               │   WAITING    │
                               │   ...        │
                               │   EXPIRED    │
                               └──────────────┘

Without a keeper service running, orders just sit there forever
until they expire and the user's collateral is returned (minus gas).
```

---

## The Critical Missing Piece: Keeper Service

### What the Keeper Must Do

```
KEEPER SERVICE ARCHITECTURE
═══════════════════════════

┌─────────────────────────────────────────────────────────────────────┐
│                         KEEPER SERVICE                              │
│                        (You must build this)                        │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐ │
│  │  WATCHER    │    │   PRICE     │    │      EXECUTOR           │ │
│  │             │    │   FETCHER   │    │                         │ │
│  │ • Poll      │    │             │    │ • Build oracle params   │ │
│  │   DataStore │    │ • Call Pyth │    │ • Estimate gas          │ │
│  │ • Listen    │    │   API       │    │ • Submit executeOrder() │ │
│  │   for events│    │ • Parse     │    │ • Handle failures       │ │
│  │ • Queue     │    │   response  │    │ • Retry logic           │ │
│  │   pending   │    │ • Sign      │    │ • Confirm execution     │ │
│  │   orders    │    │   prices    │    │                         │ │
│  └──────┬──────┘    └──────┬──────┘    └───────────┬─────────────┘ │
│         │                  │                       │                │
│         └──────────────────┼───────────────────────┘                │
│                            │                                        │
│                    ┌───────▼───────┐                                │
│                    │   MAIN LOOP   │                                │
│                    │               │                                │
│                    │ while (true): │                                │
│                    │   1. Check    │                                │
│                    │   2. Fetch    │                                │
│                    │   3. Execute  │                                │
│                    │   4. Sleep    │                                │
│                    └───────────────┘                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Simplified Keeper Code (Pseudocode)

```typescript
// keeper-service.ts (YOU NEED TO BUILD THIS)

async function runKeeper() {
  const signer = new ethers.Wallet(KEEPER_PRIVATE_KEY, provider);

  while (true) {
    try {
      // 1. Check for pending orders
      const pendingOrders = await getPendingOrders();

      for (const order of pendingOrders) {
        // 2. Fetch current prices from Pyth
        const prices = await fetchPythPrices(order.tokens);

        // 3. Sign the prices with our registered signer
        const oracleParams = await buildOracleParams(prices, signer);

        // 4. Execute the order
        await orderHandler.connect(signer).executeOrder(
          order.key,
          oracleParams
        );

        console.log(`Executed order: ${order.key}`);
      }

      // 5. Also check for pending deposits and withdrawals
      await processPendingDeposits();
      await processPendingWithdrawals();

    } catch (error) {
      console.error('Keeper error:', error);
    }

    // Wait before next iteration
    await sleep(1000); // 1 second
  }
}
```

### Estimated Development Effort

| Component | Complexity | Time Estimate |
|-----------|------------|---------------|
| Order watcher | Medium | 2-3 days |
| Pyth price fetching | Medium | 2-3 days |
| Price signing | Medium | 1-2 days |
| Order execution | Medium | 2-3 days |
| Error handling & retries | High | 2-3 days |
| Deposit/Withdrawal handling | Medium | 1-2 days |
| Testing & debugging | High | 3-5 days |
| **TOTAL** | - | **2-3 weeks** |

---

## Deployment Checklist

### Phase 1: Contract Deployment

```
□ Deploy to testnet (Arbitrum Sepolia recommended)
  □ Run: npx hardhat deploy --network arbitrumSepolia
  □ Verify all contracts on Arbiscan
  □ Save deployment addresses

□ Configure DataStore
  □ Set protocol parameters (fees, limits)
  □ Set gas limits for operations
```

### Phase 2: Token & Market Setup

```
□ Token setup
  □ Deploy mock BRL token (or use existing testnet token)
  □ Configure token in config/tokens.ts with Pyth price feed
  □ Register token oracle configuration

□ Market creation
  □ Call MarketFactory.createMarket(BRL, USDC, USDC)
  □ Configure market parameters
  □ Set max pool amounts
  □ Set position/swap fees
```

### Phase 3: Roles & Permissions

```
□ Role configuration
  □ Grant CONTROLLER to admin wallet
  □ Grant ORDER_KEEPER to keeper service wallet
  □ Grant LIQUIDATION_KEEPER to keeper (if liquidations enabled)

□ Oracle configuration
  □ Register signer address in OracleStore
  □ Configure oracle providers for each token
```

### Phase 4: Keeper Service

```
□ Build keeper service
  □ Implement order watching
  □ Implement Pyth price fetching
  □ Implement price signing
  □ Implement order execution
  □ Add deposit execution
  □ Add withdrawal execution
  □ Add error handling & retries
  □ Add monitoring & alerting

□ Deploy keeper
  □ Set up server (AWS, GCP, etc.)
  □ Configure environment variables
  □ Fund keeper wallet with ETH for gas
  □ Start keeper service
  □ Verify orders are being executed
```

### Phase 5: Liquidity & Testing

```
□ Seed initial liquidity
  □ Get testnet USDC (faucet or bridge)
  □ Create deposit
  □ Execute deposit (via keeper)
  □ Verify LP tokens received

□ End-to-end testing
  □ Create a SHORT position on BRL
  □ Verify keeper executes it
  □ Close position
  □ Verify PnL calculation
```

---

## Step-by-Step: Local to Testnet

### Step 1: Understand the Gap

| Feature | Local Test | Testnet |
|---------|------------|---------|
| Contract deployment | `deployFixture()` | `npx hardhat deploy` |
| Market creation | Automatic | Manual script |
| Oracle prices | Mock (any value) | Real Pyth prices |
| Order execution | Instant (you call it) | Keeper service |
| Tokens | Unlimited minting | Faucet/bridge |
| Gas | Free | Real testnet ETH |

### Step 2: Deployment Order

```bash
# 1. Configure network in hardhat.config.ts
# Add your RPC URL and deployer private key

# 2. Deploy contracts
npx hardhat deploy --network arbitrumSepolia

# 3. This runs 160+ deployment scripts in order:
#    - DataStore
#    - RoleStore
#    - Oracle
#    - Routers
#    - Handlers
#    - Vaults
#    - etc.
```

### Step 3: Create Markets (After Deployment)

```typescript
// scripts/create-brl-market.ts
import { ethers } from "hardhat";

async function main() {
  const marketFactory = await ethers.getContract("MarketFactory");
  const usdc = "0x..."; // Testnet USDC address
  const brl = "0x...";  // Your BRL token address

  // Create BRL/USD market (single-token: USDC for both long and short)
  const tx = await marketFactory.createMarket(
    brl,   // indexToken (BRL price)
    usdc,  // longToken
    usdc,  // shortToken
    "0x..." // marketType hash
  );

  console.log("Market created:", tx.hash);
}
```

### Step 4: Configure Roles

```typescript
// scripts/configure-roles.ts
async function main() {
  const roleStore = await ethers.getContract("RoleStore");
  const keeperAddress = "0x..."; // Your keeper wallet

  // Grant ORDER_KEEPER role
  await roleStore.grantRole(keeperAddress, ethers.utils.id("ORDER_KEEPER"));

  // Register oracle signer
  const oracleStore = await ethers.getContract("OracleStore");
  await oracleStore.addSigner(keeperAddress);
}
```

### Step 5: Build and Run Keeper

See [ORACLE_AND_KEEPERS.md](./ORACLE_AND_KEEPERS.md) for detailed keeper implementation guide.

---

## Common Pitfalls

### Pitfall 1: "My test works locally!"

```
❌ WRONG ASSUMPTION:
   "The test-brl-short-position.ts script works, so we're ready!"

✅ REALITY:
   The script works because deployFixture() set everything up.
   On testnet, you have NOTHING until you deploy and configure it.
```

### Pitfall 2: Orders not executing

```
❌ SYMPTOM:
   Orders created but never executed

✅ CAUSE:
   No keeper service running

✅ FIX:
   Build and deploy keeper service
```

### Pitfall 3: "Unauthorized" errors

```
❌ SYMPTOM:
   executeOrder() reverts with "Unauthorized"

✅ CAUSE:
   Keeper wallet doesn't have ORDER_KEEPER role

✅ FIX:
   roleStore.grantRole(keeperWallet, "ORDER_KEEPER")
```

### Pitfall 4: Oracle price errors

```
❌ SYMPTOM:
   "Invalid oracle price" or "Signer not authorized"

✅ CAUSE:
   - Signer not registered in OracleStore
   - Wrong price format
   - Stale prices (timestamp too old)

✅ FIX:
   - Register signer: oracleStore.addSigner(signerAddress)
   - Check price format matches Oracle.sol expectations
   - Ensure prices are fresh (< 60 seconds old)
```

### Pitfall 5: Forgetting deposits/withdrawals

```
❌ SYMPTOM:
   Liquidity deposits stuck as "pending"

✅ CAUSE:
   Keeper only handles orders, forgot deposits

✅ FIX:
   Keeper must also call:
   - depositHandler.executeDeposit()
   - withdrawalHandler.executeWithdrawal()
```

---

## Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   LOCAL TESTS ARE A STARTING POINT, NOT THE FINISH LINE            │
│                                                                     │
│   ✅ Local test passing = Logic works                               │
│   ❌ Local test passing ≠ Ready for production                      │
│                                                                     │
│   THE GAP:                                                          │
│   ┌───────────────────────────────────────────────────────────┐    │
│   │                                                           │    │
│   │  deployFixture()    ──▶    Deployment scripts            │    │
│   │  Mock oracle        ──▶    Real Pyth/Chainlink           │    │
│   │  Instant execution  ──▶    Keeper service (24/7)         │    │
│   │  Free gas           ──▶    Real ETH for gas              │    │
│   │  Unlimited tokens   ──▶    Faucet/bridge tokens          │    │
│   │                                                           │    │
│   └───────────────────────────────────────────────────────────┘    │
│                                                                     │
│   MOST CRITICAL: Build the keeper service!                         │
│   Without it, orders will NEVER execute on a real chain.           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Read** [ORACLE_AND_KEEPERS.md](./ORACLE_AND_KEEPERS.md) for keeper architecture
2. **Read** [PYTH_ORACLE_PROVIDER.md](./PYTH_ORACLE_PROVIDER.md) for price feed setup
3. **Plan** your testnet deployment (which network, what tokens)
4. **Build** a minimal keeper service
5. **Test** end-to-end on testnet before mainnet
