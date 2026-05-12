# Workstream 4 - Call Path Coverage Matrix (A-E)

## Scope Basis
- Research basis: Gating MarketSwap call-path analysis (A–E) used in the governance rationale for MarketSwap gating.
- Objective here: map each path to concrete code and test evidence, then classify coverage.

## Matrix
| Path | Description | Primary Code Path | Test Evidence | Status | Notes |
|---|---|---|---|---|---|
| A | Feature-gated create/execute order entry for swap-related order types | `contracts/exchange/OrderHandler.sol` (`validateFeature` on create + execute) | `test/config/VerifySwapReconfiguration.ts` (asserts `CREATE_ORDER_FEATURE_DISABLED` + `EXECUTE_ORDER_FEATURE_DISABLED` for MarketSwap, LimitSwap, StopLossDecrease, LimitIncrease, LimitDecrease) | Covered | Directly validates governance gating surface. |
| B | Swap execution mutates shared pool accounting | `contracts/swap/SwapUtils.sol` (`applyDeltaToPoolAmount`, pool updates + validations) | `test/exchange/SwapOrder.ts` (pool amount and swap impact pool assertions), `test/exchange/Deposit.ts` (`executeDeposit with swap`) | Covered | Confirms swaps are not isolated from market pool accounting. |
| C | Swap pricing/impact depends on pool state and virtual inventory | `contracts/pricing/SwapPricingUtils.sol` (`getPriceImpactUsd`, `getNextPoolAmountsUsd`) | `test/exchange/SwapOrder.ts` (price impact), `test/exchange/VirtualSwapPriceImpact.ts` (virtual inventory-driven impact) | Covered | Covers both local pool-state and virtual-inventory-coupled pricing behavior. |
| D | LP deposit flows can route through swap path prior to mint | `contracts/deposit/ExecuteDepositUtils.sol` (`swap`, `longTokenSwapPath`, `shortTokenSwapPath`, `_executeDeposit`) | `test/exchange/Deposit.ts` (`executeDeposit with swap`, swap-path validation behavior) | Covered | Demonstrates coupling between deposit path and swap mechanics. |
| E | Single-token caveat and governance disable posture | `contracts/swap/SwapUtils.sol` comment/validation path for single-token context + same-token market policy checks | `scripts/configs/validations/verifySameTokenInvariants.ts` (same-token market invariants), `test/config/VerifySwapReconfiguration.ts` (swap-type gating) | Partial | Explicit negative-path test for "attempt swap on single-token market and assert expected revert/disable reason" is not yet present; accepted as residual test gap to be covered in a follow-on test-hardening increment. |

## Missing / Partial Coverage Handling
- Path E is marked `Partial`.
- Explicit risk acceptance for this validation pass:
  - Current controls provide policy-level protection through feature-flag gating plus same-token invariant checks.
  - A direct negative-path single-token swap test is deferred to a follow-on test-hardening increment.

## Conclusion
- Paths A–D: adequately covered by existing tests and validation scripts.
- Path E: operationally controlled, but test completeness gap remains and is tracked as accepted residual risk pending that follow-on work.
