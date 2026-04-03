# Migration status (`SCRUM126-SCRUM127` branch)

## Test commands

Run these from the repo root.

**Hardhat (TypeScript integration tests):**

```bash
npm test
```

Equivalent: `NODE_OPTIONS="--max-old-space-size=8192" npx hardhat test`

**Foundry (Solidity tests under `test-forge/`):**

```bash
npm run test:forge
```

Equivalent: `forge test --no-match-path 'contracts/test/**'`  
(Legacy Solidity helpers under `contracts/test/` are excluded so only `test-forge/` runs.)

**Rollout note:** We are prioritizing **test file updates and Foundry migration first**; **deployment script redaction** (`deploy/` trim) comes **after** tests clarify the required protocol surface.

---

## 1. Slither — dependency / call graph

**npm script (compile + generate + optional render):**

```bash
npm run slither:callgraph
```

This runs `npx hardhat compile` then `./scripts/slither-callgraph.sh --render`, which produces `.dot` files under `slither-output/` and renders `docs/diagrams/all_contracts.call-graph.{svg,png}` and `ExchangeRouter.call-graph.{svg,png}` when Graphviz is installed.

**Equivalent Slither invocation (after a Hardhat compile):**

```bash
slither . \
  --compile-force-framework hardhat \
  --ignore-compile \
  --skip-clean \
  --print call-graph
```

Then move `*.call-graph.dot` into `slither-output/` if you want to match the script layout. Requires: `pip install slither-analyzer`, Graphviz for `--render`.

---

## 2. Sources used to define “remaining protocol” vs deprecated areas

**“Endpoints” here means on-chain entry points** (where txs land): e.g. user flows via **ExchangeRouter** and keeper flows via **Handler.execute***), as traced in CALL_ROUTES — not REST HTTP APIs (except you may separately use archive/oracle HTTP URLs off-repo).

| Source | Role |
|--------|------|
| **`documentation/migration/contract-flows/CALL_ROUTES.md`** (and `documentation/migration/CALL_ROUTES.md` if duplicated) | User / keeper call routes; **conclusion counts ~86 flow artifacts: 55 implementing contracts + 31 interfaces** for documented LP, user, multicall, and keeper paths (often rounded to “~85”). |
| **`slither-output/*.call-graph.dot`** and **`docs/diagrams/*.call-graph.{svg,png}`** | Full dependency / call-graph (many more nodes than the CALL_ROUTES summary). |
| **`documentation/migration/README-TRIM.md`** | Product/doc scope: **perpetuals + liquidity only**; spot/swap narrative trimmed. |
| **`config/markets.ts`** (and related `config/`) | Which markets/tokens/feeds are configured for deploys. |
| **`documentation/migration/HARDHAT_SKIP.md`** | Test suites aligned with “not remaining protocol” (multichain, relay, guardian, etc.). |
| **`versions/<network>/vX.Y.Z.json`** | **Full deploy manifest** for a network: e.g. `versions/baseSepolia/v1.0.1.json` names **on the order of ~115** deployed contracts (includes claim, multichain, gov, relay, fee distributor, mocks, etc.) — **wider** than the CALL_ROUTES **55-contract** table. |

**Fork / RPC examples** (from `package.json`): Arbitrum, Avalanche, Fuji URLs — add Base in `hardhat.config.ts` / `.rpcs.json` as needed.

---

## 3. Allowlist (~86) vs full deploy (~115+) vs “remove ~30”

| Idea | What it means in this repo |
|------|----------------------------|
| **~85 / 86 “used in protocol”** | Documented in **CALL_ROUTES** as **55 contracts + 31 interfaces** on the **core** LP / user / keeper flows. That is an **allowlist in documentation**, not “every `.sol` file under `contracts/`” (the tree has **hundreds** of `.sol` files including libraries, mocks, interfaces, and `contracts/test/` helpers). |
| **“Remove the remaining ~30”** | **Intent:** the **extra** named deployments in a **full** manifest (claim, multichain routers, Gelato/subaccount relay, gov stack, fee distributor, some oracle/stream plumbing, etc.) are **candidates** to **stop deploying** for the trimmed Velocity protocol — on the order of **dozens** of names vs the slimmer CALL_ROUTES surface. |
| **What is done on this branch today** | That gap is **identified** (docs + manifests + skipped tests); **we have not** yet **bulk-deleted** Solidity sources nor **disabled** the matching **`deploy/*.ts`** scripts. So: **allowlist + test skips; deploy still ships the wide set until Phase 2 trim.** |
| **Hardhat tests** | **Deprecated areas skipped** (`describe.skip`); **309 pass, 545 pending**. See `documentation/migration/HARDHAT_SKIP.md`. |

When **Phase 2 (deploy trim)** lands, replace the hand-wavy “~30” with an **exact list**: deploy scripts turned off + contracts no longer in `versions/…` (and any `.sol` deletes if you choose to remove dead code).

---

## Current status on **SCRUM126-SCRUM127**

**Priority order (updated):** **Tests first** — extend and migrate test suites (Hardhat + Foundry). **Deploy redaction second** — trim `deploy/` and config only after tests define the required surface.

**Contract redaction (deploy scope):** **Allowlist vs full deploy is documented** (see §3); **trimming `deploy/`** is deferred until after test alignment. No mass deletion of Solidity or deploy scripts on this branch yet.

**Hardhat test updates (done so far):** Added `describe.skip` across deprecated/non-remaining suites (multichain, relay/subaccount, guardian, contributor, data-stream oracle, fee/gov extras, etc.). Documented in `documentation/migration/HARDHAT_SKIP.md`. Verified full run: **309 passing, 545 pending**. Committed as `2d7fdd64`.

**Foundry setup (done so far):** `test-forge/`, `foundry.toml`, `npm run test:forge`, `remappings.txt`, `.vscode/settings.json`, placeholder Foundry test. Committed as `9a78fa58`.

**Docs / planning:** `Protocol.t.sol` + versions JSON + fork pattern discussed for Foundry tests; Hardhat deploy remains the source of deployed addresses until Phase 2.

**Repo state right now:** Branch: `SCRUM126-SCRUM127`. Working tree: clean except untracked `deployments/base/` (if present).

---

## TLDR — phased rollout (tests first, deploy trim second)

| Phase | Scope | Goal | Stages (high level) |
|-------|--------|------|----------------------|
| **0** | **Tests — Hardhat + Foundry foundation** | Finish aligning tests with remaining protocol; add Foundry fixture | (1) Keep `npm test` green; adjust or add Hardhat tests where needed. (2) Implement `test-forge/Protocol.t.sol` (e.g. `versions/…` + fork + interface bindings). (3) Add pilot Foundry tests inheriting `Protocol`. (4) Document RPC / manifest env in `test-forge/` or here. |
| **1** | **Tests — Foundry migration** | Move coverage domain-by-domain from TS to Solidity | (1) Pick domain (deposit, withdrawal, order, GLV, fees…). (2) Add `test-forge/<domain>/*.t.sol`. (3) Run `npm run test:forge` + `npm test`. (4) Skip or remove Hardhat tests per domain when Foundry coverage is trusted. |
| **2** | **Deploy (Hardhat) — redaction** | Trim `deploy/` + `config/` to match what tests prove is required | (1) From Phases 0–1, list contracts/scripts that nothing exercises. (2) Gate or remove deploy scripts; update `config/markets.ts` etc. (3) Fork + `npx hardhat deploy --network localhost` until clean. (4) Regenerate `versions/<network>/vX.Y.Z.json` via `npm run extract -- …`. |
| **3** | **Deploy (Forge) — optional** | Port trimmed deploy to `forge script` | (1) `script/Deploy*.s.sol` mirroring Phase 2 graph. (2) Same manifest shape as `versions/…`. (3) Decide Hardhat vs Forge for each network. |

**Reference commits:** Foundry Phase 0 — `9a78fa58`; Hardhat skips — `2d7fdd64`. Additional commits may exist on this branch after these.
