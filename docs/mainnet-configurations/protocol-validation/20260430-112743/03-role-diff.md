# Role diff (protocol validation)

## Inputs
- `01-roles-mainnet.log`
- `02-roles-fork.log`
- policy source: `config/roles.ts` (`base` network role policy)

## Deterministic Export Status
- Mainnet export: pass
- Fork export: pass
- Export format: deterministic (sorted roles + sorted members) via `scripts/configs/validations/printRolesResolved.ts`

## Mainnet vs Fork
- Result: no differences detected for exported role memberships.

## Policy Diff Summary (Base)

### Matched (approved)
- `CONFIG_KEEPER`: `0xAed31d3C8942B38eec87Fe5830a671C1A3D0d967`
- `LIMITED_CONFIG_KEEPER`: `0xAed31d3C8942B38eec87Fe5830a671C1A3D0d967`
- `TIMELOCK_ADMIN`: `0xAed31d3C8942B38eec87Fe5830a671C1A3D0d967`
- `MARKET_KEEPER`: `0xAed31d3C8942B38eec87Fe5830a671C1A3D0d967`
- `ORDER_KEEPER`: `0xAed31d3C8942B38eec87Fe5830a671C1A3D0d967`, `0xB316E4dE2C6FC86BFFfA14A5B9Ed24B875351651`
- `ADL_KEEPER`: `0xAed31d3C8942B38eec87Fe5830a671C1A3D0d967`, `0xB316E4dE2C6FC86BFFfA14A5B9Ed24B875351651`
- `LIQUIDATION_KEEPER`: `0xAed31d3C8942B38eec87Fe5830a671C1A3D0d967`, `0xB316E4dE2C6FC86BFFfA14A5B9Ed24B875351651`
- `FROZEN_ORDER_KEEPER`: `0xAed31d3C8942B38eec87Fe5830a671C1A3D0d967`, `0xB316E4dE2C6FC86BFFfA14A5B9Ed24B875351651`

### Explicitly Accepted Exceptions
- `FEE_KEEPER` includes `FeeDistributor` contract address in addition to deployer/keeper EOA.
- `ROLE_ADMIN` includes system timelock/config contracts (`ConfigTimelockController`, `TimelockConfig`) in addition to keeper EOA.
- Additional unhashed role key `0xdb34a94d601aa170c498f99c1628bd6182669f4ea4522eb87795649193ee93f8` observed with `MultichainReader`; accepted as existing deployed-system role and not introduced by the order redaction / pool-risk configuration releases.

## Required Corrections
- None required based on current base policy + observed on-chain state.

## Decision
- Workstream 2 role hygiene check: pass (with documented accepted exceptions).
