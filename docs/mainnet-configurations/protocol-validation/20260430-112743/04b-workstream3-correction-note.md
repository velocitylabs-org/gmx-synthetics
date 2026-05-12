# Workstream 3 Correction Note

## Initial Result
- `04-same-token-invariants.log` initially failed on fork for 7 inactive Nivo markets (`IDR`, `PHP`, `PEN`, `NGN`, `KES`, `ZAR`, `THB`) because `IS_MARKET_DISABLED` was `false`.

## Action Taken
- Applied fork correction by re-running the combined configuration orchestrator (`scripts/configs/index.ts`) with order redaction and pool risk guard workstreams enabled against the Base fork (`FORK_ID=8453`, write mode as appropriate for the environment).
- Archived output:
  - `04a-fork-correction-feature-redaction.log`

## Final Result
- Re-ran same-token invariants:
  - `04-same-token-invariants.log` -> pass
- Re-ran virtual ID allowlist:
  - `05-virtual-id-linkage.log` -> pass

## Conclusion
- Workstream 3 fork invariants now pass after deterministic correction and re-validation.
