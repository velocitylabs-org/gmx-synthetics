# SCRUM227 Baseline Evidence

## Metadata
- Timestamp: `20260430-112743`
- Branch: `SCRUM226`
- Git SHA: `cc10325cbe72c16f4adff1b7b487f3413b2a262e`
- Remote: `git@github.com:velocitylabs-org/gmx-synthetics.git`
- Network target: `base` (mainnet read + fork validation)
- Fork ID: _not set in environment at capture time_
- Operator list source: `config/roles.ts` plus approved governance/operator list document (to be attached during Workstream 2)

## Baseline Working Tree Snapshot
```text
## SCRUM226...origin/SCRUM226
 M .wolf/anatomy.md
 M .wolf/hooks/_session.json
 M .wolf/memory.md
 M .wolf/token-ledger.json
?? cache_forge/
?? docs/mainnet-configurations/scrum-225-226/20260428-114212/
?? scrum227.md
?? scrums225-227.md
```

## Planned Command Log (Pre-Run)
- Role export:
  - `npx hardhat run scripts/printRoles.ts --network base`
  - `FORK_ID=8453 npx hardhat run scripts/printRoles.ts --network anvil`
- SCRUM225/226 state verification:
  - `pnpm verify:scrum225-226:mainnet`
- Same-token invariant check (script to add in this ticket):
  - `FORK_ID=8453 npx hardhat run scripts/configs/<same-token-checker>.ts --network anvil`
- Virtual ID linkage allowlist check (script to add in this ticket):
  - `FORK_ID=8453 npx hardhat run scripts/configs/<virtual-id-checker>.ts --network anvil`
- Call-path coverage matrix build:
  - `pnpm test ...` (targeted + full suite commands to be finalized in Workstream 4/5)

## Artifact Plan
- `01-roles-mainnet.log`
- `02-roles-fork.log`
- `03-role-diff.md`
- `04-same-token-invariants.log`
- `05-virtual-id-linkage.log`
- `06-call-path-coverage-matrix.md`
- `07-fork-test-summary.md`
- `08-skip-accounting.json`
- `09-final-validation-note.md`
