# Acceptance checklist — remaining feature redaction

Status is based on pre-mainnet execution evidence in this bundle.

## Acceptance items

- [x] All targeted remaining feature flags can be set and verified on fork.
  - Evidence: `03-fork-write-and-validate.log` ends with `Verification passed: all feature flags matched expected state.`
- [x] No deploy-skip modifications were introduced.
  - Scope remains config-state management only under `scripts/configs/`.
- [x] Orchestrator supports independent and composable execution.
  - Evidence: `scripts/configs/index.ts` supports legacy + remaining-feature toggles via `RUN_*` env flags.
- [x] CI endpoint exists for validation profile execution.
  - Evidence: `config:features:validate:mainnet` and `scripts/configs/run-feature-validation.sh`.
- [x] Pre-mainnet evidence bundle archived.
  - Evidence: `01-compile.log`, `02-fork-dryrun.log`, `03-fork-write-and-validate.log`, this checklist, and `README.md`.

## Production closeout

- [x] Mainnet dry-run execution evidence — `../20260511-production-evidence/01-mainnet-dryrun.log`
- [x] Mainnet write execution evidence (if approved) — `../20260511-production-evidence/02-mainnet-write.log` + tx index in that folder’s `README.md`
- [x] Mainnet readback validation evidence — `../20260511-production-evidence/03-mainnet-validate.log`
- [x] Post-mainnet final note — `../20260511-production-evidence/07-post-mainnet-note.md`

## Conclusion

Configuration implementation is accepted for pre-mainnet readiness.

**Production evidence (mainnet + Base Sepolia):** see `../20260511-production-evidence/` (includes Sepolia dry-run + validate transcripts). Explicit archived readback for order create/execute redaction and pool risk guard keys beyond `verifyFeaturesState.ts` remains a follow-up.
