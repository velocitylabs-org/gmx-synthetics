# Post-mainnet closeout note (SCRUM275 Step 8)

- **Date:** 2026-05-11
- **Base mainnet (8453):** Feature orchestrator write executed; tx hashes indexed in `README.md` and excerpt in `02-mainnet-write.log`. Readback profile: `03-mainnet-validate.log` ends with `Verification passed: all feature flags matched expected state.`
- **Base Sepolia (84532):** Full write transcript `05-basesepolia-write.log` (`WRITE=true`, `--network baseSepolia`) with on-chain tx hashes in `README.md`. Separate validation-only transcript: `06-basesepolia-validate.log`.
- **Deferred to follow-up ticket:** explicit archived readback for order create/execute redaction and pool risk guard keys (out of `verifyFeaturesState.ts` scope).
