
# Repository Purpose

Fork of GMX V2 Synthetics, used as the on-chain layer for the Nivo forex insurance protocol on Base (Base Sepolia Testnet). This repo contains the Solidity contracts, Hardhat deploy scripts, and the local/testnet/mainnet deployment workflow. The runtime services that drive these contracts (API, keeper, dashboard, web app) live in sibling repos under `nivo/`.

Use `pnpm` (not npm/yarn) inside this repo.

## Commands

```bash
pnpm install
pnpm hardhat compile
pnpm test                                  # full hardhat test suite (ramps node memory to 8GB)
pnpm hardhat test test/path/to/File.ts      # single test file
pnpm hardhat test --grep "pattern"          # filter by describe/it name

# Local node + deploy (two terminals)
pnpm hardhat node                     # forks state and runs full deploy on startup (~3 min)
SKIP_AUTO_HANDLER_REDEPLOYMENT=true pnpm hardhat deploy --network localhost

# Forks
pnpm fork:base                             # hardhat fork of Base mainnet
pnpm hardhat:fork                          # anvil fork of Base, chain-id 8453

# Mainnet deploy
pnpm deploy:base:fork                      # validates configs then deploys to a Base fork
pnpm deploy:base:mainnet                   # validates configs then deploys to Base mainnet

# Lint (only runs on staged TS files via husky pre-commit)
pnpm lint
```

`SKIP_AUTO_HANDLER_REDEPLOYMENT=true` is the standard flag for non-handler-changing deploys — it short-circuits the handler redeploy chain and is safe whenever you haven't modified `*Handler.sol`.

## Doppler

Doppler replaces `.env` files. It injects secrets as process environment variables at runtime, so they never touch disk. `doppler run -- <cmd>` uses the config pinned in `.doppler.yaml` (default: `loc`). Pass `-c stg` or `-c prd` to target a different environment. See [DOPPLER.md](../DOPPLER.md) for the full variable reference.

`gmx-synthetics` uses [Doppler](https://doppler.com) for mainnet deploy secrets and Supabase credentials. Project: `nivo`.

`.doppler.yaml` is checked in (config: `loc`). Run `doppler login` once per machine — no `doppler setup` needed.

```bash
doppler run -- pnpm hardhat node   # localhost with env injection
doppler run -p nivo -c stg -- pnpm upsert-deployments --chain baseSepolia --chain-label base-sepolia
                                        # upsert to staging Supabase. Bare pnpm script + external doppler wrapper.
                                        # CI handles prod via .github/workflows/deploy-sync.yml — do NOT bake doppler into this script.
```

Fork scripts use hardcoded Hardhat dev keys — those do not need Doppler.

The `app`, `vite`, and React deps in `package.json` are a vestigial in-repo UI (`app.tsx`, `index.html`) — the production UI lives in `nivo-web-app/`. Don't extend the in-repo app.

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

## Velocity / Nivo-specific docs

The `VELOCITY_DOCS/` directory contains the Nivo team's protocol notes — read these instead of upstream GMX docs when working on Nivo concerns:

- `SETUP_GUIDE.md` — gmx-synthetics dev setup
- `KEEPER_AND_ORACLE.md` — off-chain keeper roles and oracle price flow
- `MARKET_CONFIGURATION.md` — domain config

## Conventions

- Solidity formatted via Prettier; TS via ESLint + Prettier. Husky runs lint on staged TS only.
- Contracts target the Solidity version pinned in `hardhat.config.ts`; do not bump.
- Tests are Hardhat + Chai; helpers live in `utils/test/` and are auto-registered via `import "./utils/test"` in `hardhat.config.ts`.
- Typechain output (`typechain-types/`) and `artifacts/` are generated — never edit by hand.

## OpenWolf

This repo has its **own** `.wolf/` directory (`gmx-synthetics/.wolf/`) — separate from the parent `nivo/.wolf/`. The `OPENWOLF.md` and `.claude/rules/openwolf.md` rules apply: check `gmx-synthetics/.wolf/anatomy.md` before reading project files, `gmx-synthetics/.wolf/cerebrum.md` before generating code, and log bugs to `gmx-synthetics/.wolf/buglog.json`. When working on gmx-synthetics-specific behavior, prefer this submodule's `.wolf/` over the parent's.
