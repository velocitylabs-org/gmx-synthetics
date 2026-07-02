
## What this repo is

Fork of GMX v2. On-chain layer for Nivo — a synthetic single-collateral perpetuals protocol for emerging market FX pairs (EMFX) on Base. Collateral: USDC only. Use `pnpm` (not npm/yarn).

## Active markets

- Active (Base mainnet + Base Sepolia): BRL, MXN, COP
- Legacy/reference only: GBP — kept as an example of a non-inverted Chainlink Data Stream feed, not a core Nivo target market
- Inactive (no Chainlink Data Stream available yet): IDR, PHP, PEN, NGN, KES, ZAR, THB — deployed on-chain but disabled

## Disabled features

These are disabled via feature flags in `scripts/configs/` — do not assume they work without checking feature state first:

- Swap orders (MarketSwap, LimitSwap)
- Limit orders (LimitIncrease, LimitDecrease)
- Stop-loss orders (StopLossDecrease)
- Gasless relay (Gelato)
- Subaccounts
- Shift operations
- JIT orders (just-in-time liquidity)

Not implemented / not used by Nivo:

- GLV: in active development, not yet live
- FeeDistributor: not yet designed — all fee factors are 0, fees go entirely to LPs
- Referral system, incentives, GMX token, esGmx
- Multichain / LayerZero

## Oracle

- Active provider: `ChainlinkDataStreamProvider.sol` only
- BRL, MXN, COP: feeds arrive in USD/FX convention — inverted automatically via `DATA_STREAM_INVERSION_SCALE` (`10^24`) in `ChainlinkDataStreamProvider._processV8Report()`
- GBP: non-inverted (legacy, reference only)
- Out of scope — do not use:
  - `ChainlinkPriceFeedProvider.sol` (legacy)
  - `EdgeDataStreamProvider.sol` (Chaos Labs, not deployed)
  - `GmOracleProvider.sol` (Hardhat local only)
- IDR, PHP, PEN, NGN, KES, ZAR, THB: `HashZero` feedId, awaiting Chainlink Data Stream availability

## Networks

Base mainnet (`base`) and Base Sepolia (`baseSepolia`) only. Arbitrum and Avalanche configs exist in the codebase (GMX upstream) but are not used by Nivo. No multichain.

## Docs

`VELOCITY_DOCS/` contains the Nivo team's protocol notes — read these instead of upstream GMX docs:

- `SETUP_GUIDE.md` — dev setup
- `KEEPER_AND_ORACLE.md` — keeper roles and oracle price flow
- `MARKET_CONFIGURATION.md` — market and pool config
- `CONTRACT_ARCHITECTURE.md` — contract structure
- `deployments/DEPLOYING_NIVO_IN_BASE_SEPOLIA.md` — full deploy guide
- `deployments/DEPLOYMENT_SYNC.md` — deployment sync to Supabase
- `deployments/REDEPLOYING_CHAINLINK_ORACLE_PROVIDER.md`
- `deployments/TEST_NIVO_ON_BASE_SEPOLIA.md`
- `deployments/DEPOSIT_LIQUIDITY.md` — how to add liquidity to a pool
- `deployments/base-mainnet-notes.md` — current mainnet operational state

## Architecture (GMX V2)

Two-step request/execute model: users create a request via a Router, keepers execute it later with oracle prices.

```
User → ExchangeRouter / GlvRouter
        ↓ (createDeposit / createOrder / createWithdrawal)
        Vault holds funds + DataStore stores the request
        ↓
Keeper → *Handler (DepositHandler, OrderHandler, …)
        ↓
        *Utils (DepositUtils, ExecuteOrderUtils, …) — business logic
        ↓
        MarketUtils / PositionUtils / etc. — pricing, fees, PnL
        ↓
        DataStore (single source of truth) + EventEmitter
```

Contract layering, by directory:

- `contracts/router/` — user entry points (`ExchangeRouter`, `GlvRouter`, `SubaccountRouter`)
- `contracts/exchange/` — `*Handler` contracts (entry for routers and keepers)
- `contracts/{deposit,withdrawal,order,shift,glv,position,market,…}/` — each domain has both `*Utils` (logic) and `*StoreUtils` (serialization to DataStore)
- `contracts/data/` — `DataStore` (generic key/value storage; all state lives here)
- `contracts/event/` — `EventEmitter` + `*eventUtils` (generalized events; ABIs don't need to update when fields are added)
- `contracts/bank/` + per-domain `*Vault` — fund custody only; no logic
- `contracts/oracle/` — oracle price ingestion (Chainlink Data Streams in production)
- `contracts/role/`, `gov/`, `config/` — access control + protocol config keys
- `contracts/glv/` — GLV (multi-market liquidity vaults) wrapper layer
- `contracts/v1/` — legacy V1 surface kept for migration; don't extend
- `contracts/mock/`, `contracts/test/` — only for tests, never deployed to prod

Key invariants when modifying contracts:

- Logic contracts (`*Utils`, handlers) hold no funds and no state — state goes through `DataStore` via `*StoreUtils`. Adding a field to a struct means updating its `*StoreUtils` keys, not the struct serialization.
- Use `EventEmitter` + `*eventUtils` for events, not raw `emit` — keeps event ABIs upgrade-stable.
- `EnumerableSet`-backed lists (orders, positions) are intentional: they're queried directly by keepers/UI to avoid indexer lag.
- The Router/Handler/Util split exists for gradual upgradeability — preserve it. Don't move state into handlers or logic into vaults.

## Deployments and Config

- `deploy/` — `hardhat-deploy` scripts; numerous (`160+`) and order-sensitive. Handler redeploys cascade — hence `SKIP_AUTO_HANDLER_REDEPLOYMENT`.
- `deployments/<network>/` — checked-in deployment artifacts (addresses + ABIs). Treat these as the source of truth for downstream services; the API, keeper, and dashboard sync from here.
- `config/` — protocol parameters (`markets.ts`, `tokens.ts`, `oracle.ts`, `roles.ts`, …). `scripts/validateMarketConfigs.ts` runs before mainnet deploys and must pass.
- `ci/scripts/upsert-deployments.ts` pushes deployment metadata to Supabase (used by the API/dashboard) — only run intentionally.

## Doppler

Replaces `.env` files. See [VELOCITY_DOCS/SETUP_GUIDE.md](VELOCITY_DOCS/SETUP_GUIDE.md) 
for setup and usage. Fork scripts use hardcoded Hardhat dev keys — no Doppler needed.

For the upsert-deployments workflow, see 
[VELOCITY_DOCS/deployments/DEPLOYMENT_SYNC.md](VELOCITY_DOCS/deployments/DEPLOYMENT_SYNC.md).

The `app`, `vite`, and React deps in `package.json` are a vestigial in-repo UI (`app.tsx`, `index.html`) used for local Timelock signing. Do not extend it — the production UI lives in a separate repo.

## Conventions

- Solidity formatted via Prettier; TS via ESLint + Prettier. Husky runs lint on staged TS only.
- Contracts target the Solidity version pinned in `hardhat.config.ts`; do not bump.
- Tests are Hardhat + Chai; helpers live in `utils/test/` and are auto-registered via `import "./utils/test"` in `hardhat.config.ts`.
- Typechain output (`typechain-types/`) and `artifacts/` are generated — never edit by hand.

## OpenWolf

This repo has its **own** `.wolf/` directory (`gmx-synthetics/.wolf/`) — separate from the parent `nivo/.wolf/`. The `OPENWOLF.md` and `.claude/rules/openwolf.md` rules apply: check `gmx-synthetics/.wolf/anatomy.md` before reading project files, `gmx-synthetics/.wolf/cerebrum.md` before generating code, and log bugs to `gmx-synthetics/.wolf/buglog.json`. When working on gmx-synthetics-specific behavior, prefer this submodule's `.wolf/` over the parent's.
