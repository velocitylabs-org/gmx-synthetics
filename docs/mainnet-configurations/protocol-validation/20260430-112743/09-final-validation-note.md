# Validation note (fork + test hygiene)

## Scope Executed
- Fork post-config verification test:
  - `test/config/VerifySwapReconfiguration.ts`
- Disabled-order suites explicitly skipped with rationale:
  - `test/exchange/SwapOrder.ts`
  - `test/exchange/VirtualSwapPriceImpact.ts`
  - `test/exchange/LimitIncreaseOrder.ts`
  - `test/exchange/LimitDecreaseOrder.ts`
  - `test/exchange/StopLossDecreaseOrder.ts`

## Command + Evidence
- Command:
  - `FORK_ID=8453 RUN_FORK_CONFIG_TESTS=true npx hardhat test test/config/VerifySwapReconfiguration.ts test/config/DisabledOrderTypesReverts.ts test/exchange/SwapOrder.ts test/exchange/VirtualSwapPriceImpact.ts test/exchange/LimitIncreaseOrder.ts test/exchange/LimitDecreaseOrder.ts test/exchange/StopLossDecreaseOrder.ts --network anvil`
- Output:
  - `07-fork-test-summary.log`

## Result
- Passing: `1`
- Pending (explicit skips): `17`
- Failing: `0`

## Revert-Test Status
- Added new test scaffold:
  - `test/config/DisabledOrderTypesReverts.ts`
- Current status:
  - execution gate removed
  - revert tests now execute in local harness
  - latest run: `npx hardhat test test/config/DisabledOrderTypesReverts.ts`
  - latest result: `2 passing`, `0 pending`, `0 failing`

## Residual Risk
- Deployed swap/decrease contract surfaces still exist, but governance feature flags currently disable the targeted order types.
- Full-suite execution under `--network anvil` currently fails broadly during shared fixture `beforeEach` setup in this environment, so "full fork suite post-config" remains an open harness item.

## Global Suite Status Note
- After checksum-path patching, global suite was re-run via `pnpm test`.
- Current output: `818 passing`, `34 pending`, `5 failing`.
- Remaining failures are documented in:
  - `10-global-test-suite-anomalies.md`
