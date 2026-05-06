# SCRUM227 CI Guardrail Specification

## Purpose
Specify the guardrail checks required for future CI integration to enforce SCRUM225/226 hardening policy and SCRUM227 validation expectations.

## Guardrail 1: Same-Token Market Invariants

### What it tests
- For Nivo same-token markets (`longToken == shortToken`):
  - swap impact factors are zero:
    - `SWAP_IMPACT_FACTOR[positive] == 0`
    - `SWAP_IMPACT_FACTOR[negative] == 0`
  - inactive-market disable policy matches intended index set (`IS_MARKET_DISABLED` true for inactive list).

### Expected behavior
- Check passes only when all targeted markets satisfy the invariant set.
- Fails with per-market mismatch output.

### Suggested implementation hook
- Script: `scripts/configs/verifySameTokenInvariants.ts`
- Recommended CI command:
  - `FORK_ID=<id> FAIL_ON_MISMATCH=true npx hardhat run scripts/configs/verifySameTokenInvariants.ts --network anvil`

## Guardrail 2: Swap-Disabled Policy Assertion

### What it tests
- On target deployment, all disabled order types have:
  - `CREATE_ORDER_FEATURE_DISABLED == true`
  - `EXECUTE_ORDER_FEATURE_DISABLED == true`
- Target order types:
  - `MarketSwap`
  - `LimitSwap`
  - `StopLossDecrease`
  - `LimitIncrease`
  - `LimitDecrease`

### Expected behavior
- Fails if any create/execute flag is not set to expected state.

### Suggested implementation hook
- Script: `scripts/configs/verifyScrum225226State.ts`
- Recommended CI command:
  - `FAIL_ON_MISMATCH=true npx hardhat run scripts/configs/verifyScrum225226State.ts --network <env>`

## Guardrail 3: Virtual ID Linkage Allowlist

### What it tests
- For Nivo markets, on-chain virtual IDs must match configured policy:
  - `virtualTokenIdKey(indexTokenAddress)` equals configured `virtualTokenIdForIndexToken`
  - `virtualMarketIdKey(marketToken)` equals configured `virtualMarketId` (HashZero for Nivo markets)
- Aligns to create-market virtual-id setup path in `scripts/createMarket.ts` where virtual IDs are conditionally written.

### Expected behavior
- Passes when all target markets match allowlisted expected values.
- Fails with per-market mismatch detail.

### Suggested implementation hook
- Script: `scripts/configs/verifyVirtualIdAllowlist.ts`
- Recommended CI command:
  - `FORK_ID=<id> FAIL_ON_MISMATCH=true npx hardhat run scripts/configs/verifyVirtualIdAllowlist.ts --network anvil`

## Guardrail 4: Expected-Fail Disabled-Path Tests

### What it tests
- Create + execute attempts for disabled order types revert with `DisabledFeature`.
- Covers:
  - `MarketSwap`
  - `LimitSwap`
  - `StopLossDecrease`
  - `LimitIncrease`
  - `LimitDecrease`

### Expected behavior
- Fails if any disabled path unexpectedly succeeds.

### Suggested implementation hook
- Test file: `test/config/DisabledOrderTypesReverts.ts`
- Current note:
  - Test executes in local harness and should be required in CI for disabled-path policy enforcement.

## Recommended Pipeline Trigger Points

### On PR (fast gate)
- Lint + typecheck.
- Targeted policy checks:
  - same-token invariants (fork)
  - virtual-id allowlist (fork)
  - swap-disabled state verification (fork or read-only target env)
- Call-path coverage matrix integrity check (artifact exists and references current tests).

### Pre-deploy (release gate)
- Re-run all guardrail scripts on a fresh fork pinned to deployment block baseline.
- Run disabled-path expected-fail tests.
- Produce archived evidence bundle with pass/fail summary.

### Post-deploy (verification gate)
- Read-only state verification on target network:
  - feature flags
  - market caps/bootstrap parameters
  - inactive market disable flags
- Persist output to immutable rollout evidence location.

## Orchestrator Endpoint
- Aggregate validator endpoint:
  - `scripts/configs/227-invariants.ts`
- Recommended command:
  - `pnpm scrum227-invariants`

This endpoint currently runs:
- role export
- same-token invariants
- virtual-id allowlist
