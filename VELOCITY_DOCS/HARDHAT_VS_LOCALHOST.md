# Hardhat Network vs Localhost: Why We Use `--network localhost`

This document explains a fundamental aspect of Hardhat's architecture that directly impacts how we develop Nivo Finance locally. Understanding this is essential because it explains:

- Why every config file has both `hardhat` and `localhost` entries
- Why every deploy script checks for both `network.name === "hardhat"` and `network.name === "localhost"`
- Why you can't just use `--network hardhat` for everything

---

## The Two Local Networks

Hardhat provides **two completely separate** local blockchain environments. Despite both running on your machine, they behave very differently:

### 1. The `hardhat` Network (In-Process)

When you run a script with `--network hardhat` (or omit the `--network` flag entirely, since `hardhat` is the default), Hardhat does not connect to any external server. Instead, it:

1. Creates a fresh blockchain **inside the Node.js process** running your script
2. Executes your script against that in-process chain
3. **Destroys the entire chain** when the script exits

There is no JSON-RPC server. There is no port 8545. There is nothing external processes can connect to. The blockchain lives and dies with the script's process.

```
┌─────────────────────────────────────┐
│  npx hardhat run deploy.ts          │
│  --network hardhat                  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  In-Process Blockchain        │  │
│  │  (exists only during script)  │  │
│  │                               │  │
│  │  Block 0 ... Block N          │  │
│  └───────────────────────────────┘  │
│                                     │
│  Script finishes → chain destroyed  │
└─────────────────────────────────────┘
```

This is what GMX uses for their **automated test suite**. Each test file gets a pristine chain, runs its assertions, and everything is cleaned up. Perfect for CI, terrible for interactive development.

### 2. The `localhost` Network (Persistent Server)

When you run `npx hardhat node`, Hardhat starts a **long-running JSON-RPC server** on `http://localhost:8545`. This is a real server process that:

1. Stays alive until you manually stop it (Ctrl+C)
2. Persists all state (deployed contracts, transactions, balances) across multiple script invocations
3. Exposes an RPC endpoint that **anything** can connect to: scripts, wallets, frontends

When you then run a script with `--network localhost`, Hardhat doesn't create an in-process chain. Instead, it connects to the running server via HTTP and sends transactions there.

```
Terminal 1:                          Terminal 2:
┌────────────────────────┐           ┌────────────────────────┐
│  npx hardhat node      │           │  npx hardhat run       │
│                        │◄──HTTP───►│  deploy.ts             │
│  Persistent chain at   │           │  --network localhost   │
│  http://localhost:8545  │           └────────────────────────┘
│                        │
│  Block 0 ... Block N   │           Terminal 3:
│  (keeps growing)       │           ┌────────────────────────┐
│                        │◄──HTTP───►│  MetaMask / Rabby      │
│                        │           │  RPC: localhost:8545    │
│                        │           └────────────────────────┘
│                        │
│                        │           Terminal 4:
│                        │◄──HTTP───►│  Frontend (Wagmi/Viem) │
│                        │           │  http://localhost:5173  │
└────────────────────────┘           └────────────────────────┘
```

---

## Why This Matters: A Concrete Example

Our local development session requires running **10+ sequential scripts** that build on each other's state, plus a frontend and wallet that read from the same chain.

### What happens with `--network hardhat`:

```bash
# Step 1: Deploy contracts
npx hardhat run deploy.ts --network hardhat
# → Creates in-process chain
# → Deploys 100+ contracts
# → Script ends → CHAIN DESTROYED. All contracts gone.

# Step 2: Configure markets
npx hardhat run configureMarkets.ts --network hardhat
# → Creates a BRAND NEW in-process chain (empty, no contracts)
# → Script tries to read DataStore → FAILS: contract doesn't exist
# → Error: "call revert exception"
```

Each script starts from block 0 with a completely empty state. There is no way to carry state from one script invocation to the next because each invocation creates and destroys its own private chain.

Even if the scripts could somehow run, MetaMask couldn't connect (no RPC server), and the frontend couldn't read contract data (no endpoint to query).

### What happens with `--network localhost`:

```bash
# Terminal 1: Start persistent node (stays running)
npx hardhat node

# Terminal 2: Deploy contracts → state saved on the running node
npx hardhat run deploy.ts --network localhost
# → Connects to localhost:8545
# → Deploys 100+ contracts
# → Script ends, but the node keeps the contracts

# Terminal 2: Configure markets → reads the contracts we just deployed
npx hardhat run configureMarkets.ts --network localhost
# → Connects to the SAME node at localhost:8545
# → Finds all deployed contracts ✓
# → Configures them successfully

# Terminal 2: Add liquidity → reads markets we just configured
npx hardhat run addLiquidity.ts --network localhost
# → Same node, same state ✓

# Meanwhile: MetaMask connects to localhost:8545 → sees all contracts ✓
# Meanwhile: Frontend queries localhost:8545 → reads positions ✓
```

All scripts, the wallet, and the frontend share the **same blockchain state** because they're all talking to the same persistent server.

---

## The Config Duplication Problem

Every config file in `gmx-synthetics/config/` is structured as a dictionary keyed by network name:

```typescript
// config/tokens.ts
const tokenConfigs = {
  hardhat: {
    BRL: { synthetic: true, decimals: 18, priceFeed: { ... } },
    USDT: { decimals: 6, ... },
    // ...
  },
  arbitrum: {
    WETH: { address: "0x82aF49...", ... },
    USDC: { address: "0xaf88d0...", ... },
    // ...
  },
  avalanche: { ... },
};
```

At runtime, the system does `tokenConfigs[hre.network.name]` to get the right configuration. When `network.name` is `"localhost"`, this lookup returns `undefined` unless there's a `localhost` key.

GMX's original codebase only had `hardhat` entries (for their test suite) and real network entries. They never needed `localhost` because they never developed interactively against a persistent node -- their tests run entirely within the `hardhat` in-process chain.

**We had to add `localhost` entries to every config file:**

| Config File | What it defines |
|---|---|
| `config/tokens.ts` | Token addresses, decimals, price feeds |
| `config/markets.ts` | Market definitions (which forex pairs to create) |
| `config/roles.ts` | Which addresses get which roles (CONTROLLER, ORDER_KEEPER, etc.) |
| `config/oracle.ts` | Oracle signers, confirmation requirements |
| `config/general.ts` | General protocol parameters |
| `config/riskOracle.ts` | Risk oracle configuration |
| `config/vaultV1.ts` | Legacy vault addresses |
| `config/layerZero.ts` | Cross-chain messaging config |
| `config/feeDistributor.ts` | Fee distribution settings |
| `config/buyback.ts` | Token buyback configuration |

For most of these, the `localhost` config is identical to `hardhat` (both use mock contracts, test signers, etc.). The key difference is in `tokens.ts` and `markets.ts`, where we define Nivo's forex-specific tokens and markets.

---

## The Deploy Script Patches

Similarly, deploy scripts had conditionals like:

```typescript
// Original GMX code
if (network.name === "hardhat") {
  // Use mock contracts (MockVaultV1, MockRiskOracle, etc.)
  const mockVault = await get("MockVaultV1");
  vaultAddress = mockVault.address;
} else {
  // Use real addresses from config
  vaultAddress = config.vaultV1;  // Would be undefined on localhost → crash
}
```

We patched these to:

```typescript
if (network.name === "hardhat" || network.name === "localhost") {
  const mockVault = await get("MockVaultV1");
  vaultAddress = mockVault.address;
}
```

Files that needed this patch:

| Deploy Script | What it guards |
|---|---|
| `deployFeeHandler.ts` | Uses MockVaultV1 instead of real vault |
| `deployFeeDistributor.ts` | Uses mock token addresses |
| `deployConfigSyncer.ts` | Uses MockRiskOracle |
| `deployChainlinkDataStreamProvider.ts` | Uses MockDataStreamVerifier |
| `deployMultichainReader.ts` | Uses MockEndpointV2 |
| `deployAndConfigureMarkets.ts` | Skips heavy config tx (done separately) |
| `deployAutoCancelSyncer.ts` | Only runs on local networks |
| `deployTimestampInitializer.ts` | Only runs on local networks |
| `configureOracleTokens.ts` | Selects mock oracle provider |

We also added one `localhost`-specific optimization in `updateMarketConfigUtils.ts`: a smaller batch size of 20 (instead of 100) because the full batches exceed the Hardhat node's 16M block gas limit.

---

## The `hardhat` Network Still Has a Role

The `hardhat` in-process network is not useless -- it's the right tool for **automated testing**:

```typescript
// In a test file (runs with --network hardhat by default):
describe("OrderHandler", () => {
  it("should execute a market order", async () => {
    // deployFixture creates a fresh chain with everything configured
    const { orderHandler, dataStore, ... } = await deployFixture();

    // Test runs against this pristine state
    await orderHandler.executeOrder(...);

    // Test ends → chain is destroyed → next test gets a clean slate
  });
});
```

This isolation is exactly what you want for tests -- no test can pollute another's state. GMX has hundreds of tests that rely on this behavior.

**Our use case is different.** We're not running isolated tests; we're doing interactive development where a human (and their wallet and browser) need to interact with a persistent chain over the course of minutes or hours. That requires `localhost`.

---

## Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    Hardhat Architecture                      │
├──────────────────────────┬──────────────────────────────────┤
│   --network hardhat      │   --network localhost            │
├──────────────────────────┼──────────────────────────────────┤
│ In-process chain         │ Connects to npx hardhat node     │
│ No RPC server            │ RPC at localhost:8545            │
│ Dies when script ends    │ Persists until node stopped      │
│ No wallet connection     │ Wallet connects via RPC          │
│ No frontend connection   │ Frontend connects via RPC        │
│ State lost between cmds  │ State shared across cmds         │
│ network.name = "hardhat" │ network.name = "localhost"       │
├──────────────────────────┼──────────────────────────────────┤
│ USE CASE:                │ USE CASE:                        │
│ Automated test suites    │ Interactive development          │
│ CI/CD pipelines          │ Frontend + wallet + scripts      │
│ Unit/integration tests   │ Multi-step deploy & configure    │
└──────────────────────────┴──────────────────────────────────┘
```

**Bottom line:** Hardhat chose to give these two modes different network names. We need the persistent one (`localhost`) for interactive development, so we had to add `localhost` support throughout the GMX codebase -- configs, deploy scripts, and utility functions.
