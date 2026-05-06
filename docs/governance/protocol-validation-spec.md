# SCRUM227 Validation Specification

## Purpose
Define the validation basis and evidence set for post-reconfiguration assurance after SCRUM225 and SCRUM226, and record SCRUM227 validation outcomes and residual risk.

## Scope
- Role hygiene audit against approved operator policy.
- Same-token and virtual-ID invariant checks on fork.
- Call-path coverage mapping for MarketSwap gating rationale (A-E).
- Disabled-order test hygiene evidence (skip accounting + revert-test status).

## Keys Changed Across Workstreams

### SCRUM225 (feature gating)
- `CREATE_ORDER_FEATURE_DISABLED`
- `EXECUTE_ORDER_FEATURE_DISABLED`

Applied for order types:
- `MarketSwap`
- `LimitSwap`
- `StopLossDecrease`
- `LimitIncrease`
- `LimitDecrease`

### SCRUM226 (market risk caps + bootstrap + disable inactive markets)
- `MAX_POOL_AMOUNT`
- `MAX_POOL_USD_FOR_DEPOSIT`
- `MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT`
- `IS_MARKET_DISABLED` (inactive markets)

### SCRUM227
- No new on-chain parameter writes required by this ticket scope.
- Validation, evidence, and policy specification only.

## Scripts and Outputs

### Role Export and Diff
- Script: `scripts/configs/printRolesResolved.ts`
- Evidence:
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/01-roles-mainnet.log`
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/02-roles-fork.log`
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/03-role-diff.md`
  - `artifacts/protocol-validation/role-diff.json`

### Invariant Checks
- Script: `scripts/configs/verifySameTokenInvariants.ts`
- Script: `scripts/configs/verifyVirtualIdAllowlist.ts`
- Wrapper: `scripts/configs/227-invariants.ts` via `pnpm scrum227-invariants`
- Evidence:
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/04-same-token-invariants.log`
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/05-virtual-id-linkage.log`
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/04a-fork-correction-feature-redaction.log`
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/04b-workstream3-correction-note.md`

### Call-Path Coverage
- Evidence:
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/06-call-path-coverage-matrix.md`
  - `artifacts/protocol-validation/call-path-coverage-matrix.md`

### Test Hygiene + Skip Accounting
- Evidence:
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/07-fork-test-summary.log`
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/08-skip-accounting.md`
  - `artifacts/protocol-validation/skip-accounting.json`
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/09-final-validation-note.md`
  - `docs/mainnet-configurations/protocol-validation/20260430-112743/10-global-test-suite-anomalies.md`

## Validation Outcomes
- Role audit: pass (documented accepted exceptions; no required correction).
- Same-token + virtual-ID checks: pass on fork after deterministic correction replay.
- Call-path coverage:
  - Paths A-D: covered.
  - Path E: partial, with explicit risk acceptance and deferred test hardening.
- Disabled-order test hygiene:
  - Relevant suites are explicitly skipped with rationale.
  - Disabled-order revert tests execute and pass in local harness (`test/config/DisabledOrderTypesReverts.ts`).

## Residual Risk
- Contract surfaces for disabled order paths still exist on deployed bytecode.
- Risk is operationally bounded by feature flags, role controls, and configuration discipline.
- Remaining global test failures are concentrated in execution-fee capping assertions and one subaccount balance assertion drift (documented in `10-global-test-suite-anomalies.md`).

## Rollback Procedure

### SCRUM225 rollback (feature re-enable)
- Set `CREATE_ORDER_FEATURE_DISABLED=false` for targeted order types.
- Set `EXECUTE_ORDER_FEATURE_DISABLED=false` for targeted order types.
- Verify with:
  - `pnpm verify:scrum225-226:mainnet`
  - target order-type readbacks from DataStore.

### SCRUM226 rollback (caps/bootstrap/market-disable)
- Restore prior values for:
  - `MAX_POOL_AMOUNT`
  - `MAX_POOL_USD_FOR_DEPOSIT`
  - `MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT`
  - `IS_MARKET_DISABLED`
- Use archived before/after evidence and transaction logs from SCRUM225/226 execution bundle to restore exact values.
- Re-run verification scripts and archive a rollback evidence note.

### SCRUM227 rollback
- Not applicable as this ticket does not introduce on-chain config writes.
