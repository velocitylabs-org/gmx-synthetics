# Protocol validation evidence (`20260430-112743`)

## Metadata

- Timestamp: `20260430-112743`
- Git SHA (capture): `cc10325cbe72c16f4adff1b7b487f3413b2a262e`
- Remote: `git@github.com:velocitylabs-org/gmx-synthetics.git`
- Networks: Base mainnet (read-only role export) + Base fork (`FORK_ID=8453` where noted)
- Operator policy source: `config/roles.ts` plus the approved governance operator list used for role hygiene review

## Commands (representative)

Role exports:

- `npx hardhat run scripts/printRoles.ts --network base`
- `FORK_ID=8453 npx hardhat run scripts/printRoles.ts --network anvil`

Invariant and virtual-ID checks (paths live under `scripts/configs/validations/` on the post-refactor mainline):

- `FORK_ID=8453 npx hardhat run scripts/configs/validations/verifySameTokenInvariants.ts --network anvil`
- `FORK_ID=8453 npx hardhat run scripts/configs/validations/verifyVirtualIdAllowlist.ts --network anvil`
- Aggregate wrapper: `FORK_ID=8453 npx hardhat run scripts/configs/validations/runInvariantChecks.ts --network anvil`

Feature / pool configuration was replayed on fork where needed using the combined `scripts/configs/index.ts` orchestrator (order redaction + pool risk guards); see `04b-workstream3-correction-note.md` for the correction pass.

## Archived artifacts (this folder)

| File | Description |
|------|-------------|
| `01-roles-mainnet.log` | Sorted role export against Base mainnet |
| `02-roles-fork.log` | Sorted role export against the Base fork |
| `03-role-diff.md` | Mainnet vs fork role comparison |
| `04-same-token-invariants.log` | Same-token market invariant run |
| `04a-fork-correction-feature-redaction.log` | Log from fork correction replay |
| `04b-workstream3-correction-note.md` | Why correction was needed and outcome |
| `05-virtual-id-linkage.log` | Virtual ID allowlist check |
| `06-call-path-coverage-matrix.md` | Call-path A–E vs tests/scripts |
| `07-fork-test-summary.log` | Fork test pass/skip summary |
| `07a-disabled-order-reverts.log` | Disabled order-type revert harness |
| `08-skip-accounting.md` | Skipped suites + rationale |
| `09-final-validation-note.md` | Consolidated validation note |
| `10-global-test-suite-anomalies.md` | Non-policy test anomalies |

**Note:** Evidence logs use the `.log` extension and are force-tracked in git because `*.log` is gitignored by default.
