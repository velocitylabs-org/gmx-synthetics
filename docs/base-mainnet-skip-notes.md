# Base Mainnet Deploy Skip Notes

## TL;DR (Impacted Files)

- `package.json`
- `deploy/deployFeeHandler.ts`
- `deploy/deployFeeDistributor.ts`
- `deploy/deployChainlinkPriceFeedProvider.ts`
- `deploy/deployEdgeDataStreamVerifier.ts`
- `deploy/deployEdgeDataStreamProvider.ts`
- `scripts/validateMarketConfigsUtils.ts`
- `deploy/configureRoles.ts`
- `deploy/deployTestTokens.ts`
- `deploy/configureDataStreamFeeds.ts`
- `deploy/configureGeneralSettings.ts`
- `deploy/deployMockTimelockV1.ts`
- `deploy/deployReferralStorage.ts`
- `deploy/deployOracle.ts`
- `deploy/deployChainlinkDataStreamProvider.ts`
- `deploy/deployGmOracleProvider.ts`

## Why this doc exists

This records the skip and conditional behavior introduced during local fork bring-up, so the real Base mainnet deployment can be reviewed with confidence.

## Fork-only skip behavior (safe for mainnet)

These skips/guards only trigger for local fork workflows (either `DEPLOY_ON_FORK=true` and/or when the configured RPC URL points to `127.0.0.1` / `localhost`).

### `deploy/deployFeeHandler.ts`

- `deploy/deployFeeHandler.ts` is **not skipped** on `base` forks anymore.
- Caveat: this repo currently provides a `base` entry in `config/vaultV1.ts` using placeholders for `vaultV1`/`gmx` until the correct GMX V1 wiring for Base is confirmed. This is sufficient for the fork bring-up deploy to succeed, but you must replace these placeholders before any logic that actually uses `vaultV1` (`version == 1`) is exercised.

### `deploy/deployFeeDistributor.ts`

- `deploy/deployFeeDistributor.ts` is **not skipped** on `base` forks anymore.
- Caveat: `config/feeDistributor.ts` now includes a `base` mapping for fork bring-up, with `gmx` verified on Base and `esGmx` set to a placeholder address pending confirmation of the real escrowed GMX token on Base. Replace placeholders for production correctness.

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

### `deploy/deployChainlinkPriceFeedProvider.ts`

- On `base`, this provider deployment is skipped when:
  - `DEPLOY_ON_FORK=true`, or
  - RPC URL resolves to local (`127.0.0.1` or `localhost`)
- Reason: prevents fork-only controller-gated `DataStore` wiring from reverting during initial bootstrap ordering.

### `package.json`

- Fork helper script sets fork mode explicitly:
  - `deploy:base:fork` includes `DEPLOY_ON_FORK=true`
- This keeps fork-only skips isolated to that workflow.

### `deploy/configureRoles.ts`

- `deploy/configureRoles.ts` is now intended to run normally on `base` (including fork/local runs).
- Ensure `BASE_ACCOUNT_KEY` is set consistently so the deployer that calls `RoleStore.grantRole(...)` also owns `RoleStore.ROLE_ADMIN`.

### `deploy/deployTestTokens.ts`

- On `base`, token deployment / token gas-limit / WNT DataStore writes are skipped when:
  - `DEPLOY_ON_FORK=true`, or
  - RPC URL resolves to local (`127.0.0.1` or `localhost`)
- This avoids fork-only permission ordering issues when `DataStore` writes are attempted before full role/controller wiring.
- Real mainnet deploy remains unaffected when using non-local RPC and no fork flags.

### `deploy/configureDataStreamFeeds.ts`

- On `base`, data stream feed writes are skipped when:
  - `DEPLOY_ON_FORK=true`, or
  - RPC URL resolves to local (`127.0.0.1` or `localhost`)
- This avoids fork-only `DataStore` permission gating before full controller wiring.
- Real mainnet deploy remains unaffected when using non-local RPC and no fork flags.

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

### `deploy/configureGeneralSettings.ts`

- On `base`, general settings writes are skipped when:
  - `DEPLOY_ON_FORK=true`, or
  - RPC URL resolves to local (`127.0.0.1` or `localhost`)
- Reason: these are controller-gated `DataStore` writes that can revert during fork bootstrap.
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
