# Proposal: Migrate from Hardhat to Foundry

## 1. Current state

| Aspect | Current (Hardhat) |
|--------|-------------------|
| **Build** | `npx hardhat compile` (Solidity in `contracts/`) |
| **Tests** | 136 TypeScript files under `test/` — Mocha/Chai, `deployFixture()` |
| **Fixture** | Single `deployFixture()`: runs `hre.deployments.fixture()`, loads 50+ contracts, builds market structs via `Reader.getMarket()` |
| **Helpers** | ~40 TS modules in `utils/`: `deposit.ts`, `order.ts`, `exchange.ts`, `keys.ts`, `market.ts`, `prices.ts`, `oracle.ts`, etc. |
| **Deploy** | Hardhat deploy scripts in `deploy/` (fixture runs them) |
| **Foundry** | `foundry.toml` exists (`src=contracts`, `test=test`); root `test/` is all `.ts`. ~20 Solidity helpers in `contracts/test/` (e.g. `DepositStoreUtilsTest.sol` — wrappers for libraries, not full tests). `forked-env-example/test/GmxOrderFlow.t.sol` is a real Foundry test (fork + create/execute order). |

**Main challenge:** The TS tests are integration-heavy: they rely on one big deployment, then call `handleDeposit`, `handleOrder`, `executeDeposit`, etc., and assert on state (Reader, DataStore, balances). Rewriting them to Solidity means reimplementing both **deployment** and **flow helpers** in Solidity.

---

## 2. Options

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A. Full Foundry** | Move build + all tests to Foundry; remove Hardhat. | Single stack, fast tests, fuzz/invariant possible. | Large one-off rewrite (136 files + helpers + fixture). |
| **B. Hybrid** | Foundry for build and new/unit tests; keep Hardhat only for existing TS integration tests. | Lower risk, iterate over time. | Two toolchains, two commands (`forge test` + `npx hardhat test`). |
| **C. Gradual** | Migrate in phases: build on Foundry first, then migrate tests by domain (e.g. router → deposit → order → guardian), retiring TS as Solidity coverage replaces it. | Spreads effort; can stop after any phase. | Need to keep both runnable during migration and maintain a clear “done” criterion per phase. |

---

## 3. Recommended approach: **Gradual migration (C)**

- **Phase 0:** Make Foundry the primary build (fix any `forge build` issues, e.g. “stack too deep”) and standardize on `forge test` for Solidity tests. Keep Hardhat for deployment scripts and for running TS tests until they are replaced.
- **Phase 1:** Introduce a **Foundry test fixture** (see below) and **Solidity helper contracts** that mirror the TS helpers (deposit flow, order flow, keys, oracle params). Add a small set of “pilot” Solidity integration tests (e.g. one deposit flow, one order flow) to validate the approach.
- **Phase 2:** Migrate tests **by domain** in this order (each domain can be signed off before moving to the next):
  1. **Router / multicall** (e.g. `ExchangeRouter` createDeposit, createOrder, multicall) — already have `GmxOrderFlow.t.sol`-style flows.
  2. **Deposit** — createDeposit, executeDeposit, cancelDeposit (and StoreUtils-style unit tests if any).
  3. **Withdrawal** — createWithdrawal, executeWithdrawal, cancelWithdrawal.
  4. **Order** — createOrder, executeOrder, updateOrder, cancelOrder (market increase/decrease, limit, swap, JIT).
  5. **Keeper** — executeDeposit, executeWithdrawal, executeOrder, executeAdl, executeLiquidation (and executeCloseExpired).
  6. **GLV** — glvDeposit, glvWithdrawal, glvShift.
  7. **Remaining** — fees, funding, price impact, edge cases, guardian suites, etc.
- **Phase 3:** Once Solidity coverage is sufficient, remove or archive TS tests and Hardhat (or keep Hardhat only for deploy scripts if you still use them in CI/production).

This gives a clear path, allows iteration and sign-off per domain, and avoids a single “big bang” rewrite.

---

## 4. Fixture and deployment strategy in Foundry

**Problem:** In Hardhat, `deployFixture()` runs the full deploy graph and returns 50+ contract instances + market structs. In Foundry we need an equivalent that runs once per test file (or shared via a base contract).

**Proposed approaches (pick one or combine):**

- **Option F1 — Forge script + JSON:**  
  - Add a Forge script that deploys the full system (or a “test” subset) and writes addresses (and any needed constants) to a JSON file (e.g. `broadcast/TestDeploy.s.sol/31337/run-latest.json` or a custom path).  
  - Solidity tests in `setUp()` read that JSON via `vm.parseJson()` (or a minimal loader) and bind interfaces to addresses.  
  - **Pros:** Single deployment, fast test startup. **Cons:** Script must stay in sync with Hardhat deploy; JSON parsing in Solidity is a bit awkward; re-running deploy when contracts change.

- **Option F2 — Solidity “test base” contract that deploys:**  
  - One (or a few) base test contracts that perform the full deployment in `setUp()` (deploy DataStore, RoleStore, markets, handlers, router, Reader, etc.).  
  - All integration tests inherit this base and use `address(router)`, `address(dataStore)`, etc.  
  - **Pros:** No external deploy step; everything in Solidity. **Cons:** `setUp()` can become large and slow; duplication if we have multiple bases (e.g. “minimal” vs “full” fixture).

- **Option F3 — Minimal per-test deployment:**  
  - Each test contract deploys only what it needs (e.g. DataStore + DepositHandler + DepositVault + one market).  
  - **Pros:** Fast, explicit dependencies. **Cons:** Many tests need a lot of wiring (markets, oracle, roles); risk of inconsistency with production deploy.

**Recommendation:** Start with **F2** for the “pilot” and Phase 2: one `TestFixtureFull.sol` (or `IntegrationTestBase.sol`) that deploys the full stack in `setUp()` and exposes getters. If `setUp()` becomes too heavy, we can later split into “light” (router + one market + one handler) and “full” (all handlers + Reader + multiple markets) and/or move to F1.

---

## 5. Mapping TS helpers to Solidity

| TS helper area | Solidity counterpart |
|----------------|----------------------|
| **Fixture / contracts** | Base test contract with deployed addresses (see §4). |
| **Reader.getMarket / getPosition / getPositionInfo** | Call `Reader` and `Reader.getPosition` etc. in tests; keep Reader in fixture. Same for `GlvReader` where needed. |
| **Keys** | Port `utils/keys.ts` to a Solidity library or constants contract (e.g. `Keys.sol` or `TestKeys.sol`) so tests can call `Keys.depositListKey()`, etc. |
| **createDeposit / executeDeposit / handleDeposit** | Solidity helper contract or internal functions in base: e.g. `DepositHelper.createDeposit(params)`, `DepositHelper.executeDeposit(key, oracleParams)`, `DepositHelper.handleDeposit(...)` that wrap router/handler and vault minting. |
| **createOrder / executeOrder / handleOrder** | Same idea: `OrderHelper` (or `OrderFlowHelper`) with `createOrder`, `executeOrder`, and helpers to build `CreateOrderParams` and oracle params. |
| **executeWithOracleParams / getExecuteParams** | Helper that builds `OracleUtils.SetPricesParams` and calls handler `execute*`; can live in same base or in an `OracleHelper`. |
| **prices.ts / market utils** | Port minimal logic needed for test prices (e.g. fixed prices for one market) into a Solidity helper or base; use `Reader.getMarket` for market structs. |
| **errorsContract (expect revert)** | Use `vm.expectRevert(bytes4(selector))` or `vm.expectRevert("Error(string)")`; optionally a small `ErrorSelector.sol` that mirrors error signatures. |
| **expandDecimals / decimalToFloat / math** | Solidity library or inline; e.g. `1e18`, `1e6`, or a `TestMath` library. |

We do **not** need to port every TS helper in one go: start with the ones used by the first two domains (router + deposit), then add order, keeper, GLV helpers as we migrate those domains.

---

## 6. Test layout

- **Location:** Put Foundry integration tests in a dedicated directory so they don’t mix with Hardhat’s TS tests. Two options:
  - **Option T1:** `test/forge/` (or `test/foundry/`) — e.g. `test/forge/exchange/Deposit.t.sol`, `test/forge/exchange/Order.t.sol`. Configure Foundry so `test` = `test/forge` (or keep `test` at repo root and put only `.sol` in `test/forge` and point `test` there in `foundry.toml`).
  - **Option T2:** Keep root `test/` for TS; add `test/forge/` for Solidity and set in `foundry.toml`: `test = "test/forge"`. So `forge test` only runs Solidity; `npx hardhat test` runs TS.

**Recommendation:** **T2** — `foundry.toml`: `test = "test/forge"`. Structure under `test/forge/` mirrors current domains, e.g.:

- `test/forge/ExchangeRouter.t.sol`
- `test/forge/deposit/Deposit.t.sol`
- `test/forge/withdrawal/Withdrawal.t.sol`
- `test/forge/order/Order.t.sol`
- `test/forge/keeper/ExecuteDeposit.t.sol`, `ExecuteOrder.t.sol`, `Adl.t.sol`, `Liquidation.t.sol`
- `test/forge/glv/GlvDeposit.t.sol`, …

One test contract per file (or per “describe” equivalent) is enough; use `function test_Description()` naming for clarity.

---

## 7. Order of migration (summary)

1. **Phase 0:** Fix `forge build`; set `test = "test/forge"`; no TS removal yet.
2. **Phase 1:** Implement fixture base + Solidity helpers (keys, deposit flow, order flow, oracle params); add 1–2 pilot Solidity integration tests; document pattern for the team.
3. **Phase 2:** Migrate by domain (router → deposit → withdrawal → order → keeper → GLV → rest); per domain: add Solidity tests, run both `forge test` and `npx hardhat test`, then remove or skip TS tests for that domain once signed off.
4. **Phase 3:** When all critical paths are covered in Solidity, remove Hardhat test run (and optionally keep Hardhat only for deploy scripts).

---

## 8. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Fixture deployment in Solidity is huge or slow | Start with a “minimal” fixture (one market, essential handlers); expand as needed; consider F1 (script + JSON) if necessary. |
| Behavior drift between TS and Solidity tests | Run both for the same domain until Solidity tests are trusted; keep same test names/descriptions where possible. |
| Keys/constants drift | Single source of truth: port `keys.ts` once to a Solidity `Keys` (or `TestKeys`) and reuse everywhere. |
| Oracle/signing complexity | Reuse existing mocks (e.g. mock provider + setPrices); in Solidity use `vm` to set prices or mock provider bytecode like `GmxOrderFlow.t.sol`. |

---

## 9. Definition of done (per domain)

- All tests for that domain that are in scope for Foundry have a Solidity equivalent under `test/forge/`.
- `forge test --match-path "test/forge/<domain>/**"` passes.
- TS tests for that domain are removed or permanently skipped (e.g. `describe.skip` or delete).
- CALL_ROUTES (or equivalent) still accurately describe the flows under test.

---

## 10. What we need from you to proceed

1. **Confirm approach:** Gradual (C) + F2 fixture + T2 layout — or prefer F1/F3, or a different test directory?
2. **Scope:** Migrate all 136 TS test files eventually, or only “critical path” (e.g. router, deposit, withdrawal, order, keeper) and leave the rest in Hardhat?
3. **Sign-off:** After you’re happy with this proposal, next step is Phase 0 + Phase 1 (foundry.toml, `test/forge/`, fixture base, keys + deposit/order helpers, 1–2 pilot tests). We can then iterate on the exact structure of the base and helpers before scaling to Phase 2.

Once you sign off, we can continue with Phase 0 and Phase 1 implementation details (e.g. exact `foundry.toml` changes, skeleton `IntegrationTestBase.sol`, and one pilot test).
