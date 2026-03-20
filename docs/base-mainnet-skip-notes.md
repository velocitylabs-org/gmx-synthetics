# Base Mainnet Deploy Skip Notes

## TL;DR (Impacted Files)

- `package.json`
- `config/vaultV1.ts`
- `config/feeDistributor.ts`
- `deploy/deployEdgeDataStreamVerifier.ts`
- `deploy/deployEdgeDataStreamProvider.ts`
- `scripts/validateMarketConfigsUtils.ts`
- `deploy/configureRoles.ts`

## Why this doc exists

This records **remaining** Base mainnet vs Sepolia adaptation differences (placeholders, opt-in deploys, validation helpers). Items that were temporarily fork-skipped and later unskipped are intentionally omitted.

## Conditional behavior (Base mainnet vs Sepolia adaptation)

Only items that still differ intentionally or need production follow-up are listed below. Scripts that were previously fork-skipped and are now unskipped are **not** documented here.

### `config/vaultV1.ts`

- `base` now has a bring-up placeholder config so `FeeHandler` constructor args resolve during fork deployment.
- Caveat: this does **not** imply confirmed production GMX V1 mapping on Base; replace placeholder values before any production rollout that relies on v1 fee paths.

### `config/feeDistributor.ts`

- `base` now has explicit `gmx`, `esGmx`, `wnt` mapping for fork bring-up.
- Caveat: `esGmx` is currently placeholder wiring and must be replaced with the confirmed escrowed GMX token address for production correctness.

### `deploy/deployEdgeDataStreamVerifier.ts`

- `baseSepolia` is always skipped.
- `base` is **opt-in**:
  - skipped by default
  - deploy only if `ENABLE_EDGE_DATA_STREAMS=true`
  - note: if enabled, you must configure `edgeOracleSigner` in the oracle config for `base`
- Reason: `base` edge data stream deployment depends on `edgeOracleSigner`. If that signer is unset, fork runs can fail or write incorrect oracle wiring.

### `deploy/deployEdgeDataStreamProvider.ts`

- `baseSepolia` is always skipped.
- `base` is **opt-in**:
  - skipped by default
  - deploy only if `ENABLE_EDGE_DATA_STREAMS=true`
- Reason: same dependency on `edgeOracleSigner` as the verifier deployment.

### `package.json`

- Fork helper scripts set `DEPLOY_ON_FORK=true` (and Anvil dev key) so local fork runs are explicit; this does **not** gate deployment scripts anymore beyond your own conventions.

## Non-skip but critical fork fix

### `scripts/validateMarketConfigsUtils.ts`

- Added `recommendedMarketConfig.base` (mirroring the Nivo `baseSepolia` set).
- This is not a skip; it prevents validation crashes during `deployAndConfigureMarkets.ts` on `base`.
- Effect: resolves errors like missing `JPY:USDC:USDC` recommendation lookup.

## Other relevant behavior to review before real mainnet deploy

### `deploy/configureRoles.ts`

- `rolesToRemove` now has `base: []` and fallback `rolesToRemove[network.name] || []`.
- This prevents iterator crashes, but role grants still require deployer permissions (`ROLE_ADMIN` path).
- On mainnet, ensure deployer and role-admin strategy are explicitly validated before running deploy.

## Mainnet preflight checklist

- Run mainnet deploy commands **without** `DEPLOY_ON_FORK=true`.
- Confirm your deployment environment does not export `DEPLOY_ON_FORK`.
- Re-check whether `EdgeDataStream*` should be deployed on `base` for production, or intentionally disabled.
- Validate role-admin ownership and grant authority ahead of `configureRoles`.
- Run a final dry run against a fresh Base mainnet fork before going live.
