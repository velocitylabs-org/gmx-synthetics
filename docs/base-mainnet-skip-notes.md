# Base Mainnet Deploy Skip Notes

## TL;DR (Impacted Files)

- `package.json`
- `config/vaultV1.ts`
- `config/feeDistributor.ts`
- `deploy/deployEdgeDataStreamVerifier.ts`
- `deploy/deployEdgeDataStreamProvider.ts`
- `scripts/validateMarketConfigsUtils.ts`
- `deploy/configureRoles.ts`
- `deploy/deployMockTimelockV1.ts`
- `deploy/deployReferralStorage.ts`
- `deploy/deployOracle.ts`
- `deploy/deployChainlinkDataStreamProvider.ts`
- `deploy/deployGmOracleProvider.ts`

## Why this doc exists

This records the skip and conditional behavior introduced during local fork bring-up, so the real Base mainnet deployment can be reviewed with confidence.

## Fork-only skip behavior (safe for mainnet)

These skips/guards only trigger for local fork workflows (either `DEPLOY_ON_FORK=true` and/or when the configured RPC URL points to `127.0.0.1` / `localhost`).

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

- Fork helper script sets fork mode explicitly:
  - `deploy:base:fork` includes `DEPLOY_ON_FORK=true`
- This keeps fork-only skips isolated to that workflow.

### `deploy/configureRoles.ts`

- `deploy/configureRoles.ts` is now intended to run normally on `base` (including fork/local runs).
- Ensure `BASE_ACCOUNT_KEY` is set consistently so the deployer that calls `RoleStore.grantRole(...)` also owns `RoleStore.ROLE_ADMIN`.

### `deploy/deployChainlinkDataStreamProvider.ts`, `deploy/deployGmOracleProvider.ts`

- On `base`, `GmOracleProvider` and `ChainlinkDataStreamProvider` are deployed even during fork runs.
- Rationale: `deploy/configureOracleTokens.ts` depends on these provider deployments. With `deploy/configureRoles.ts` un-skipped for `base`, controller wiring is in place before the oracle provider post-deploy `DataStore` writes run.
- Real mainnet deploy remains unaffected when using non-local RPC and no fork flags.

### `deploy/deployOracle.ts`

- Oracle **deployment still runs** on `base`.
- On `base` fork/local runs, only the Oracle post-deploy config writes are skipped when:
  - `DEPLOY_ON_FORK=true`, or
  - RPC URL resolves to local (`127.0.0.1` or `localhost`)
- Reason: those post-deploy writes to controller-gated `DataStore` keys can revert during fork bootstrap.
- Real mainnet deploy remains unaffected when using non-local RPC and no fork flags.

### `deploy/deployMockTimelockV1.ts`

- Fork bring-up required this dependency to exist for `base`, so the `func.skip` guard now includes `base` in `shouldDeployForNetwork`.
- Practical effect: `deployMockTimelockV1` is no longer excluded from `base` deployments (it is still excluded from non-target networks in the guard).

### `deploy/deployReferralStorage.ts`

- Same dependency-order motivation as `MockTimelockV1`: the `func.skip` guard was updated to include `base` in `shouldDeployForNetwork`.
- Practical effect: `ReferralStorage` is now deployed on `base` (when the other deployment dependencies are being satisfied in fork workflows).

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
- Run a final dry run against a fresh fork with and without `DEPLOY_ON_FORK` to verify intended behavior differences.
