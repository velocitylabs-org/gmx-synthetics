# Protocol validation specification

## Purpose

Define the validation basis and evidence set for post-reconfiguration assurance after order feature redaction and pool risk guard releases, and record validation outcomes and residual risk.

Script paths below use the `scripts/configs` layout on `main` (helpers / `configs/` / `validations/`).

## Scope

- Role hygiene audit against approved operator policy.
- Same-token and virtual-ID invariant checks on fork.
- Call-path coverage mapping for MarketSwap gating rationale (A–E).
- Disabled-order test hygiene evidence (skip accounting + revert-test status).

## Keys changed across releases

### Order feature redaction (disabled order types)

- `CREATE_ORDER_FEATURE_DISABLED`
- `EXECUTE_ORDER_FEATURE_DISABLED`

Applied for order types:

- `MarketSwap`
- `LimitSwap`
- `StopLossDecrease`
- `LimitIncrease`
- `LimitDecrease`

### Pool risk guards (caps, bootstrap, inactive markets)

- `MAX_POOL_AMOUNT`
- `MAX_POOL_USD_FOR_DEPOSIT`
- `MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT`
- `IS_MARKET_DISABLED` (inactive markets)

### This validation pass

- No new on-chain parameter writes required by the validation scope itself.
- Validation, evidence, and policy specification only.

## Scripts and outputs

### Role export and diff

- Script: `scripts/configs/validations/printRolesResolved.ts` (also reachable via the deprecated `scripts/printRoles.ts` wrapper)
- Evidence:
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/01-roles-mainnet.log`
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/02-roles-fork.log`
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/03-role-diff.md`
  - `artifacts/protocol-validation/role-diff.json` (when generated)

### Invariant checks

- Scripts: `scripts/configs/validations/verifySameTokenInvariants.ts`, `scripts/configs/validations/verifyVirtualIdAllowlist.ts`
- Aggregate entrypoint: `scripts/configs/validations/runInvariantChecks.ts` (runs role export + both invariant scripts)

Example fork command:

```bash
FORK_ID=8453 npx hardhat run scripts/configs/validations/runInvariantChecks.ts --network anvil
```

- Evidence:
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/04-same-token-invariants.log`
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/05-virtual-id-linkage.log`
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/04a-fork-correction-feature-redaction.log`
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/04b-workstream3-correction-note.md`

### Call-path coverage

- Evidence:
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/06-call-path-coverage-matrix.md`
  - `artifacts/protocol-validation/call-path-coverage-matrix.md` (when generated)

### Test hygiene + skip accounting

- Evidence:
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/07-fork-test-summary.log`
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/08-skip-accounting.md`
  - `artifacts/protocol-validation/skip-accounting.json` (when generated)
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/09-final-validation-note.md`
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/10-global-test-suite-anomalies.md`

## Validation outcomes

- Role audit: pass (documented accepted exceptions; no required correction).
- Same-token + virtual-ID checks: pass on fork after deterministic correction replay.
- Call-path coverage:
  - Paths A–D: covered.
  - Path E: partial, with explicit risk acceptance and deferred test hardening.
- Disabled-order test hygiene:
  - Relevant suites are explicitly skipped with rationale.
  - Disabled-order revert tests execute and pass in local harness (`test/config/DisabledOrderTypesReverts.ts`).

## Residual risk

- Contract surfaces for disabled order paths still exist on deployed bytecode.
- Risk is operationally bounded by feature flags, role controls, and configuration discipline.
- Remaining global test failures are concentrated in execution-fee capping assertions and one subaccount balance assertion drift (documented in `10-global-test-suite-anomalies.md`).

## Rollback procedure

### Rollback: order feature redaction (re-enable paths)

- Set `CREATE_ORDER_FEATURE_DISABLED=false` for targeted order types.
- Set `EXECUTE_ORDER_FEATURE_DISABLED=false` for targeted order types.
- Verify with readbacks from `DataStore` and `FAIL_ON_MISMATCH=true npx hardhat run scripts/configs/validations/verifyRedactionState.ts --network <env>` (or the equivalent checks in your deployment policy).

### Rollback: pool risk guards

- Restore prior values for:
  - `MAX_POOL_AMOUNT`
  - `MAX_POOL_USD_FOR_DEPOSIT`
  - `MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT`
  - `IS_MARKET_DISABLED`
- Use archived before/after evidence and transaction logs from the original configuration execution bundle to restore exact values.
- Re-run verification scripts and archive a rollback evidence note.

### Rollback: validation-only pass

- Not applicable: this pass does not introduce on-chain config writes by itself.
