# anatomy.md

> Auto-maintained by OpenWolf. Last scanned: 2026-06-25T14:24:13.519Z
> Files: 1016 tracked | Anatomy hits: 0 | Misses: 0

## ../../.claude/projects/-Users-n-code-gmx-synthetics/memory/

- `feedback_no_git_commits.md` (~168 tok)
- `feedback_no_wolf_paths.md` (~193 tok)
- `feedback_pr_description_format.md` (~158 tok)
- `feedback_strict_renames.md` — Declares that (~171 tok)
- `MEMORY.md` — Memory Index (~135 tok)

## ./

- `.DS_Store` (~2728 tok)
- `.editorconfig` — Editor configuration (~57 tok)
- `.eslintrc.json` (~224 tok)
- `.gitignore` — Git ignore rules (~98 tok)
- `.gitmodules` (~62 tok)
- `.nvmrc` (~1 tok)
- `.prettierrc.json` — Prettier configuration (~26 tok)
- `.solcover.js` (~100 tok)
- `app.tsx` — botanix (~584 tok)
- `CLAUDE.md` — Repository Purpose (~1861 tok)
- `CONTRIBUTOR.md` — Contributing (~178 tok)
- `deploy-avax.txt` (~1640 tok)
- `FOLLOWUPS.md` — Follow-ups (~192 tok)
- `foundry.toml` (~35 tok)
- `global.d.ts` — Declares extendEnvironment (~81 tok)
- `hardhat.config.tenderly.ts` — Hardhat config WITH Tenderly enabled (~194 tok)
- `hardhat.config.ts` — Exports getExplorerUrl, getBlockExplorerUrl (~4590 tok)
- `index.html` — GMX Synthetics (~64 tok)
- `LICENSE` — Project license (~1140 tok)
- `metrics.ts` — options: run (~859 tok)
- `package.json` — Node.js package manifest (~1932 tok)
- `pnpm-lock.yaml` — pnpm lock file (~163901 tok)
- `README.md` — Project documentation (~12369 tok)
- `tenderly.yaml` (~24 tok)
- `tsconfig.json` — TypeScript configuration (~176 tok)
- `vite.config.ts` — Vite build configuration (~71 tok)

## .claude/

- `settings.json` (~441 tok)

## .claude/rules/

- `openwolf.md` (~313 tok)

## .github/workflows/

- `deploy-sync.yml` — on push to main with `deployments/**` changes; calls the bare `upsert-deployments` npm script with `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` from GitHub Actions secrets (writes to **prod** Supabase). No Doppler CLI on the runner. See VELOCITY_DOCS/deployments/DEPLOYMENT_SYNC.md. (~294 tok)
- `main.yml` — CI: CI (~203 tok)

## .husky/

- `post-commit` (~40 tok)
- `pre-commit` (~33 tok)

## .husky/_/

- `.gitignore` — Git ignore rules (~1 tok)
- `husky.sh` (~205 tok)

## VELOCITY_DOCS/

- `CONTRACT_ARCHITECTURE.md` — GMX V2 Contract Architecture (~7235 tok)
- `KEEPER_AND_ORACLE.md` — Keeper & Oracle Reference (~1559 tok)
- `MARKET_CONFIGURATION.md` — Market Configuration Guide (~6031 tok)
- `SETUP_GUIDE.md` — gmx-synthetics Setup Guide (~845 tok)

## VELOCITY_DOCS/deployments/

- `DEPLOYING_NIVO_IN_BASE_SEPOLIA.md` — Deploying Nivo protocol on Base Sepolia (~742 tok)
- `DEPLOYMENT_SYNC.md` — Deployment Sync (~1106 tok)
- `REDEPLOYING_CHAINLINK_ORACLE_PROVIDER.md` — Re-Deploying Chainlink DataStream Provider on Base Sepolia (~404 tok)
- `TEST_NIVO_ON_BASE_SEPOLIA.md` — Testing Nivo protocol on Base Sepolia (~486 tok)

## audits/abdk/

- `README.md` — Project documentation (~28 tok)

## audits/guardian/

- `README.md` — Project documentation (~125 tok)

## changelogs/

- `v2.2.md` — Function signature changes (Breaking) (~2984 tok)

## ci/scripts/

- `upsert-deployments.ts` — Reads deployment artifacts, bumps the chain version, and upserts to Supabase. The `upsert-deployments` npm script is intentionally **bare** (no `doppler run` wrapper). Operators wrap on the CLI: `doppler run -p nivo -c stg -- pnpm run upsert-deployments ...` (staging). CI (`deploy-sync.yml`) supplies creds via GitHub Actions secrets (prod). NEVER bake `doppler run` into the npm script — the GH runner has no Doppler CLI. (~1678 tok)

## config/

- `buyback.ts` — Exports BuybackBatchAmount, BuybackGmxFactor, BuybackConfig (~600 tok)
- `chains.ts` — Exports EXISTING_MAINNET_DEPLOYMENTS, isExistingMainnetDeployment (~172 tok)
- `feeDistributor.ts` — Exports FeeDistributorConfig (~473 tok)
- `general.ts` — Former `generalConfig` defaults (GMX). Kept explicit on non-Nivo networks so removing (~3580 tok)
- `glvs.ts` — GlvConfig: createGlvMarketConfig (~3775 tok)
- `index.ts` (~433 tok)
- `layerZero.ts` — Exports LayerZeroEndpointConfig (~304 tok)
- `markets.ts` — Exports BaseMarketConfig, SpotMarketConfig, PerpMarketConfig, MarketConfig (~62460 tok)
- `oracle.ts` — Exports OracleConfig (~1788 tok)
- `overwrite.ts` — Exports getExistingContractAddresses (~144 tok)
- `riskOracle.ts` — Exports RiskOracleConfig (~896 tok)
- `roles.ts` — Exports RolesConfig (~2978 tok)
- `tokens.ts` — Exports TestTokenConfig, TokenConfig, TokensConfig (~21520 tok)
- `types.d.ts` — Exports OracleProvider (~375 tok)
- `vaultV1.ts` — Exports VaultV1Config (~392 tok)

## config/roleConfigs/

- `arbitrum.ts` — Exports getRoles (~1919 tok)
- `avalanche.ts` — Exports getRoles (~1775 tok)
- `botanix.ts` — Exports getRoles (~1581 tok)
- `index.ts` (~44 tok)

## contracts/adl/

- `AdlUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~3436 tok)

## contracts/bank/

- `Bank.sol` — SPDX-License-Identifier: BUSL-1.1 (~1005 tok)
- `StrictBank.sol` — SPDX-License-Identifier: BUSL-1.1 (~707 tok)

## contracts/callback/

- `CallbackUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~4473 tok)
- `IDepositCallbackReceiver.sol` — SPDX-License-Identifier: BUSL-1.1 (~212 tok)
- `IGasFeeCallbackReceiver.sol` — SPDX-License-Identifier: BUSL-1.1 (~65 tok)
- `IGlvDepositCallbackReceiver.sol` — SPDX-License-Identifier: BUSL-1.1 (~240 tok)
- `IGlvWithdrawalCallbackReceiver.sol` — SPDX-License-Identifier: BUSL-1.1 (~252 tok)
- `IOrderCallbackReceiver.sol` — SPDX-License-Identifier: BUSL-1.1 (~299 tok)
- `IShiftCallbackReceiver.sol` — SPDX-License-Identifier: BUSL-1.1 (~112 tok)
- `IWithdrawalCallbackReceiver.sol` — SPDX-License-Identifier: BUSL-1.1 (~222 tok)

## contracts/chain/

- `ArbGasInfo.sol` — SPDX-License-Identifier: BUSL-1.1 (~48 tok)
- `ArbSys.sol` — SPDX-License-Identifier: BUSL-1.1 (~104 tok)
- `Chain.sol` — SPDX-License-Identifier: BUSL-1.1 (~485 tok)
- `ChainReader.sol` — SPDX-License-Identifier: BUSL-1.1 (~492 tok)

## contracts/claim/

- `ClaimEventUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1831 tok)
- `ClaimHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~3521 tok)
- `ClaimUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~726 tok)
- `ClaimVault.sol` — SPDX-License-Identifier: BUSL-1.1 (~77 tok)

## contracts/config/

- `AutoCancelSyncer.sol` — SPDX-License-Identifier: BUSL-1.1 (~803 tok)
- `Config.sol` — SPDX-License-Identifier: BUSL-1.1 (~7011 tok)
- `ConfigSyncer.sol` — SPDX-License-Identifier: BUSL-1.1 (~1993 tok)
- `ConfigTimelockController.sol` — SPDX-License-Identifier: BUSL-1.1 (~833 tok)
- `ConfigUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~4823 tok)
- `IRiskOracle.sol` — SPDX-License-Identifier: BUSL-1.1 (~159 tok)
- `TimelockConfig.sol` — SPDX-License-Identifier: BUSL-1.1 (~6290 tok)

## contracts/contributor/

- `ContributorHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~2331 tok)

## contracts/data/

- `DataStore.sol` — SPDX-License-Identifier: BUSL-1.1 (~5179 tok)
- `Keys.sol` — SPDX-License-Identifier: BUSL-1.1 (~29025 tok)
- `Keys2.sol` — SPDX-License-Identifier: BUSL-1.1 (~3124 tok)

## contracts/deposit/

- `Deposit.sol` — SPDX-License-Identifier: BUSL-1.1 (~1906 tok)
- `DepositEventUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1389 tok)
- `DepositStoreUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~2743 tok)
- `DepositUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~2294 tok)
- `DepositVault.sol` — SPDX-License-Identifier: BUSL-1.1 (~76 tok)
- `ExecuteDepositUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~6405 tok)
- `IDepositUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~377 tok)
- `IExecuteDepositUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~264 tok)

## contracts/error/

- `Errors.sol` — SPDX-License-Identifier: BUSL-1.1 (~7448 tok)
- `ErrorUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~477 tok)

## contracts/event/

- `EventEmitter.sol` — SPDX-License-Identifier: BUSL-1.1 (~1121 tok)
- `EventUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~4511 tok)

## contracts/exchange/

- `AdlHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~1396 tok)
- `BaseHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~598 tok)
- `BaseOrderHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~736 tok)
- `DepositHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~2034 tok)
- `GlvDepositHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~1611 tok)
- `GlvShiftHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~1226 tok)
- `GlvWithdrawalHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~1693 tok)
- `IDepositHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~206 tok)
- `IGlvDepositHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~142 tok)
- `IGlvWithdrawalHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~148 tok)
- `IJitOrderHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~169 tok)
- `IOrderExecutor.sol` — SPDX-License-Identifier: BUSL-1.1 (~69 tok)
- `IOrderHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~227 tok)
- `IShiftHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~167 tok)
- `IWithdrawalHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~315 tok)
- `JitOrderHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~1507 tok)
- `LiquidationHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~673 tok)
- `OrderHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~4588 tok)
- `ShiftHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~1507 tok)
- `WithdrawalHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~2448 tok)

## contracts/external/

- `ExternalHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~740 tok)
- `IExternalHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~78 tok)

## contracts/feature/

- `FeatureUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~343 tok)

## contracts/fee/

- `FeeBatch.sol` — SPDX-License-Identifier: BUSL-1.1 (~75 tok)
- `FeeBatchStoreUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~841 tok)
- `FeeDistributor.sol` — SPDX-License-Identifier: BUSL-1.1 (~10240 tok)
- `FeeDistributorUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1161 tok)
- `FeeDistributorVault.sol` — SPDX-License-Identifier: BUSL-1.1 (~263 tok)
- `FeeHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~3304 tok)
- `FeeSwapUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1361 tok)
- `FeeUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~2629 tok)

## contracts/gas/

- `GasUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~7998 tok)

## contracts/glv/

- `Glv.sol` — SPDX-License-Identifier: BUSL-1.1 (~50 tok)
- `GlvEventUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~555 tok)
- `GlvFactory.sol` — SPDX-License-Identifier: BUSL-1.1 (~739 tok)
- `GlvStoreUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~849 tok)
- `GlvToken.sol` — SPDX-License-Identifier: BUSL-1.1 (~168 tok)
- `GlvUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~3336 tok)
- `GlvVault.sol` — SPDX-License-Identifier: BUSL-1.1 (~62 tok)

## contracts/glv/glvDeposit/

- `ExecuteGlvDepositUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~2513 tok)
- `GlvDeposit.sol` — SPDX-License-Identifier: BUSL-1.1 (~2181 tok)
- `GlvDepositCalc.sol` — SPDX-License-Identifier: BUSL-1.1 (~644 tok)
- `GlvDepositEventUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1331 tok)
- `GlvDepositStoreUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~3151 tok)
- `GlvDepositUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~3312 tok)
- `GlvTestUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~72 tok)
- `IGlvDepositUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~191 tok)

## contracts/glv/glvShift/

- `GlvShift.sol` — SPDX-License-Identifier: BUSL-1.1 (~520 tok)
- `GlvShiftEventUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~691 tok)
- `GlvShiftStoreUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1046 tok)
- `GlvShiftUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~2846 tok)

## contracts/glv/glvWithdrawal/

- `GlvWithdrawal.sol` — SPDX-License-Identifier: BUSL-1.1 (~1790 tok)
- `GlvWithdrawalEventUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1155 tok)
- `GlvWithdrawalStoreUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~2644 tok)
- `GlvWithdrawalUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~4207 tok)
- `IGlvWithdrawalUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~178 tok)

## contracts/gov/

- `GovTimelockController.sol` — SPDX-License-Identifier: BUSL-1.1 (~151 tok)
- `GovToken.sol` — SPDX-License-Identifier: BUSL-1.1 (~714 tok)
- `ProtocolGovernor.sol` — SPDX-License-Identifier: BUSL-1.1 (~1065 tok)

## contracts/liquidation/

- `LiquidationUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1122 tok)

## contracts/market/

- `Market.sol` — SPDX-License-Identifier: BUSL-1.1 (~452 tok)
- `MarketEventUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~6374 tok)
- `MarketFactory.sol` — SPDX-License-Identifier: BUSL-1.1 (~917 tok)
- `MarketPoolValueInfo.sol` — SPDX-License-Identifier: BUSL-1.1 (~384 tok)
- `MarketStoreUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1061 tok)
- `MarketToken.sol` — SPDX-License-Identifier: BUSL-1.1 (~258 tok)
- `MarketUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~37575 tok)
- `PositionImpactPoolUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~2076 tok)

## contracts/migration/

- `GlpMigrator.sol` — SPDX-License-Identifier: BUSL-1.1 (~2610 tok)
- `IGlpRewardRouter.sol` — SPDX-License-Identifier: BUSL-1.1 (~62 tok)
- `IGlpTimelock.sol` — SPDX-License-Identifier: BUSL-1.1 (~93 tok)
- `IGlpVault.sol` — SPDX-License-Identifier: BUSL-1.1 (~115 tok)
- `TimestampInitializer.sol` — SPDX-License-Identifier: BUSL-1.1 (~1120 tok)

## contracts/mock/

- `Governable.sol` — SPDX-License-Identifier: BUSL-1.1 (~280 tok)
- `MintableToken.sol` — SPDX-License-Identifier: BUSL-1.1 (~274 tok)
- `MockArbSys.sol` — SPDX-License-Identifier: BUSL-1.1 (~95 tok)
- `MockCallbackReceiver.sol` — SPDX-License-Identifier: BUSL-1.1 (~582 tok)
- `MockDataStreamVerifier.sol` — SPDX-License-Identifier: MIT (~168 tok)
- `MockEndpointV2.sol` — SPDX-License-Identifier: UNLICENSED (~7726 tok)
- `MockExternalExchange.sol` — SPDX-License-Identifier: BUSL-1.1 (~75 tok)
- `MockFeeDistributor.sol` — SPDX-License-Identifier: BUSL-1.1 (~10293 tok)
- `MockGelatoRelay.sol` — SPDX-License-Identifier: BUSL-1.1 (~838 tok)
- `MockGlpRewardRouter.sol` — SPDX-License-Identifier: MIT (~129 tok)
- `MockGlpTimelock.sol` — SPDX-License-Identifier: MIT (~121 tok)
- `MockGlpVault.sol` — SPDX-License-Identifier: MIT (~163 tok)
- `MockGMX_LockboxAdapter.sol` — SPDX-License-Identifier: UNLICENSED (~928 tok)
- `MockGMX_MintBurnAdapter.sol` — SPDX-License-Identifier: UNLICENSED (~1666 tok)
- `MockGovernor.sol` — SPDX-License-Identifier: BUSL-1.1 (~809 tok)
- `MockGovToken.sol` — SPDX-License-Identifier: BUSL-1.1 (~442 tok)
- `MockLzReadResponse.sol` — SPDX-License-Identifier: BUSL-1.1 (~128 tok)
- `MockMultichainReaderOriginator.sol` — SPDX-License-Identifier: MIT (~548 tok)
- `MockOFT.sol` — SPDX-License-Identifier: UNLICENSED (~515 tok)
- `MockOFTAdapter.sol` — SPDX-License-Identifier: UNLICENSED (~330 tok)
- `MockOracleProvider.sol` — SPDX-License-Identifier: MIT (~220 tok)
- `MockOverridableInboundRateLimiter.sol` — SPDX-License-Identifier: UNLICENSED (~1799 tok)
- `MockPriceFeed.sol` — SPDX-License-Identifier: MIT (~300 tok)
- `MockRewardDistributorV1.sol` — SPDX-License-Identifier: MIT (~139 tok)
- `MockRewardTrackerV1.sol` — SPDX-License-Identifier: MIT (~88 tok)
- `MockRiskOracle.sol` — SPDX-License-Identifier: MIT (~2668 tok)
- `MockStargatePool.sol` — SPDX-License-Identifier: MIT (~1320 tok)
- `MockStargatePoolNative.sol` — SPDX-License-Identifier: MIT (~53 tok)
- `MockStargatePoolUsdc.sol` — SPDX-License-Identifier: MIT (~112 tok)
- `MockTimelock.sol` — SPDX-License-Identifier: MIT (~139 tok)
- `MockTimelockController.sol` — SPDX-License-Identifier: BUSL-1.1 (~107 tok)
- `MockTimelockV1.sol` — SPDX-License-Identifier: BUSL-1.1 (~765 tok)
- `MockUnlimitedToken.sol` — Mock balanceOf returns non-zero balance for any untouched account (~617 tok)
- `MockVaultGovV1.sol` — SPDX-License-Identifier: MIT (~129 tok)
- `MockVaultV1.sol` — SPDX-License-Identifier: MIT (~202 tok)
- `MockVesterV1.sol` — SPDX-License-Identifier: MIT (~122 tok)
- `Multicall3.sol` — SPDX-License-Identifier: MIT (~2512 tok)
- `ReferralStorage.sol` — SPDX-License-Identifier: BUSL-1.1 (~1867 tok)
- `RevertingCallbackReceiver.sol` — SPDX-License-Identifier: BUSL-1.1 (~154 tok)
- `WNT.sol` — SPDX-License-Identifier: BUSL-1.1 (~385 tok)

## contracts/multichain/

- `BridgeOutFromControllerUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~2401 tok)
- `IMultichainGlvRouter.sol` — SPDX-License-Identifier: BUSL-1.1 (~227 tok)
- `IMultichainGmRouter.sol` — SPDX-License-Identifier: BUSL-1.1 (~304 tok)
- `IMultichainOrderRouter.sol` — SPDX-License-Identifier: BUSL-1.1 (~355 tok)
- `IMultichainProvider.sol` — SPDX-License-Identifier: BUSL-1.1 (~158 tok)
- `IMultichainTransferRouter.sol` — SPDX-License-Identifier: BUSL-1.1 (~194 tok)
- `IOriginator.sol` — SPDX-License-Identifier: BUSL-1.1 (~73 tok)
- `LayerZeroProvider.sol` — SPDX-License-Identifier: BUSL-1.1 (~6946 tok)
- `MultichainClaimsRouter.sol` — SPDX-License-Identifier: BUSL-1.1 (~1458 tok)
- `MultichainEventUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1494 tok)
- `MultichainGlvRouter.sol` — SPDX-License-Identifier: BUSL-1.1 (~795 tok)
- `MultichainGmRouter.sol` — SPDX-License-Identifier: BUSL-1.1 (~1129 tok)
- `MultichainOrderRouter.sol` — SPDX-License-Identifier: BUSL-1.1 (~1147 tok)
- `MultichainReader.sol` — SPDX-License-Identifier: BUSL-1.1 (~3050 tok)
- `MultichainReaderUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~112 tok)
- `MultichainRouter.sol` — SPDX-License-Identifier: BUSL-1.1 (~874 tok)
- `MultichainSubaccountRouter.sol` — SPDX-License-Identifier: BUSL-1.1 (~2050 tok)
- `MultichainTransferRouter.sol` — payable function so that it can be called as a multicall (~1507 tok)
- `MultichainUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1314 tok)
- `MultichainVault.sol` — SPDX-License-Identifier: BUSL-1.1 (~83 tok)

## contracts/nonce/

- `NonceUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~444 tok)

## contracts/oracle/

- `ChainlinkDataStreamProvider.sol` — SPDX-License-Identifier: BUSL-1.1 (~2608 tok)
- `ChainlinkPriceFeedProvider.sol` — SPDX-License-Identifier: BUSL-1.1 (~586 tok)
- `ChainlinkPriceFeedUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~783 tok)
- `EdgeDataStreamProvider.sol` — SPDX-License-Identifier: BUSL-1.1 (~821 tok)
- `EdgeDataStreamVerifier.sol` — SPDX-License-Identifier: MIT (~1146 tok)
- `GmOracleProvider.sol` — SPDX-License-Identifier: BUSL-1.1 (~2458 tok)
- `GmOracleUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~566 tok)
- `IChainlinkDataStreamFeeManager.sol` — SPDX-License-Identifier: MIT (~136 tok)
- `IChainlinkDataStreamVerifier.sol` — SPDX-License-Identifier: MIT (~240 tok)
- `IOracle.sol` — SPDX-License-Identifier: BUSL-1.1 (~368 tok)
- `IOracleProvider.sol` — SPDX-License-Identifier: MIT (~155 tok)
- `IPriceFeed.sol` — SPDX-License-Identifier: MIT (~122 tok)
- `Oracle.sol` — SPDX-License-Identifier: BUSL-1.1 (~3791 tok)
- `OracleModule.sol` — SPDX-License-Identifier: BUSL-1.1 (~653 tok)
- `OracleStore.sol` — SPDX-License-Identifier: BUSL-1.1 (~749 tok)
- `OracleUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~413 tok)

## contracts/order/

- `AutoCancelUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~380 tok)
- `BaseOrderUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~5049 tok)
- `DecreaseOrderExecutor.sol` — SPDX-License-Identifier: BUSL-1.1 (~148 tok)
- `DecreaseOrderUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~3885 tok)
- `ExecuteOrderUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1306 tok)
- `IBaseOrderUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~595 tok)
- `IncreaseOrderExecutor.sol` — SPDX-License-Identifier: BUSL-1.1 (~148 tok)
- `IncreaseOrderUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1007 tok)
- `Order.sol` — SPDX-License-Identifier: BUSL-1.1 (~5251 tok)
- `OrderEventUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~2494 tok)
- `OrderStoreUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~3487 tok)
- `OrderUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~4780 tok)
- `OrderVault.sol` — SPDX-License-Identifier: BUSL-1.1 (~75 tok)
- `SwapOrderExecutor.sol` — SPDX-License-Identifier: BUSL-1.1 (~144 tok)
- `SwapOrderUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~962 tok)

## contracts/position/

- `DecreasePositionCollateralUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~8918 tok)
- `DecreasePositionSwapUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1177 tok)
- `DecreasePositionUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~4606 tok)
- `IncreasePositionUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~3549 tok)
- `Position.sol` — SPDX-License-Identifier: BUSL-1.1 (~2191 tok)
- `PositionEventUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~4393 tok)
- `PositionStoreUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~2319 tok)
- `PositionUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~9145 tok)

## contracts/price/

- `Price.sol` — SPDX-License-Identifier: BUSL-1.1 (~483 tok)

## contracts/pricing/

- `ISwapPricingUtils.sol` — SPDX-License-Identifier: MIT (~63 tok)
- `PositionPricingUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~8011 tok)
- `PricingUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1380 tok)
- `SwapPricingUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~4629 tok)

## contracts/reader/

- `GlvReader.sol` — SPDX-License-Identifier: BUSL-1.1 (~2076 tok)
- `KeeperReader.sol` — SPDX-License-Identifier: BUSL-1.1 (~427 tok)
- `Reader.sol` — SPDX-License-Identifier: BUSL-1.1 (~3235 tok)
- `ReaderDepositUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1785 tok)
- `ReaderPositionUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~3304 tok)
- `ReaderPricingUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~3216 tok)
- `ReaderUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~2250 tok)
- `ReaderWithdrawalUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1010 tok)

## contracts/referral/

- `IGov.sol` — SPDX-License-Identifier: BUSL-1.1 (~52 tok)
- `IReferralStorage.sol` — SPDX-License-Identifier: BUSL-1.1 (~672 tok)
- `ITimelock.sol` — SPDX-License-Identifier: BUSL-1.1 (~83 tok)
- `ReferralEventUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~642 tok)
- `ReferralTier.sol` — SPDX-License-Identifier: BUSL-1.1 (~105 tok)
- `ReferralUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1751 tok)

## contracts/role/

- `Role.sol` — SPDX-License-Identifier: BUSL-1.1 (~1228 tok)
- `RoleModule.sol` — SPDX-License-Identifier: BUSL-1.1 (~1452 tok)
- `RoleStore.sol` — SPDX-License-Identifier: BUSL-1.1 (~1150 tok)

## contracts/router/

- `BaseRouter.sol` — SPDX-License-Identifier: BUSL-1.1 (~490 tok)
- `ExchangeRouter.sol` — SPDX-License-Identifier: BUSL-1.1 (~4461 tok)
- `GlvRouter.sol` — SPDX-License-Identifier: BUSL-1.1 (~1368 tok)
- `IExchangeRouter.sol` — SPDX-License-Identifier: BUSL-1.1 (~395 tok)
- `Router.sol` — SPDX-License-Identifier: BUSL-1.1 (~249 tok)
- `SubaccountRouter.sol` — SPDX-License-Identifier: BUSL-1.1 (~2260 tok)

## contracts/router/relay/

- `BaseGelatoRelayRouter.sol` — SPDX-License-Identifier: BUSL-1.1 (~4792 tok)
- `GelatoRelayRouter.sol` — SPDX-License-Identifier: BUSL-1.1 (~1009 tok)
- `IRelayUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1403 tok)
- `RelayUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~10314 tok)
- `SubaccountGelatoRelayRouter.sol` — SPDX-License-Identifier: BUSL-1.1 (~1722 tok)
- `SubaccountRouterUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~750 tok)

## contracts/safe/

- `SafeUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~242 tok)

## contracts/shift/

- `IShiftUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~131 tok)
- `Shift.sol` — SPDX-License-Identifier: BUSL-1.1 (~1072 tok)
- `ShiftEventUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1060 tok)
- `ShiftStoreUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~2007 tok)
- `ShiftUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~4094 tok)
- `ShiftVault.sol` — SPDX-License-Identifier: BUSL-1.1 (~63 tok)

## contracts/subaccount/

- `SubaccountUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~2818 tok)

## contracts/swap/

- `ISwapHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~56 tok)
- `ISwapUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~485 tok)
- `SwapHandler.sol` — SPDX-License-Identifier: BUSL-1.1 (~213 tok)
- `SwapUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~4380 tok)

## contracts/test/

- `ArrayTest.sol` — SPDX-License-Identifier: BUSL-1.1 (~84 tok)
- `AssemblyReturnTest.sol` — SPDX-License-Identifier: BUSL-1.1 (~240 tok)
- `CalcTest.sol` — SPDX-License-Identifier: BUSL-1.1 (~74 tok)
- `DepositStoreUtilsTest.sol` — SPDX-License-Identifier: BUSL-1.1 (~189 tok)
- `GasTest.sol` — SPDX-License-Identifier: MIT (~386 tok)
- `GasUsageTest.sol` — SPDX-License-Identifier: BUSL-1.1 (~127 tok)
- `GelatoRelay.sol` — SPDX-License-Identifier: BUSL-1.1 (~166 tok)
- `GlvDepositStoreUtilsTest.sol` — SPDX-License-Identifier: BUSL-1.1 (~202 tok)
- `GlvShiftStoreUtilsTest.sol` — SPDX-License-Identifier: BUSL-1.1 (~186 tok)
- `GlvStoreUtilsTest.sol` — SPDX-License-Identifier: BUSL-1.1 (~168 tok)
- `GlvWithdrawalStoreUtilsTest.sol` — SPDX-License-Identifier: BUSL-1.1 (~216 tok)
- `MarketStoreUtilsTest.sol` — SPDX-License-Identifier: BUSL-1.1 (~188 tok)
- `MarketUtilsTest.sol` — SPDX-License-Identifier: BUSL-1.1 (~280 tok)
- `OracleModuleTest.sol` — SPDX-License-Identifier: BUSL-1.1 (~567 tok)
- `OrderStoreUtilsTest.sol` — SPDX-License-Identifier: BUSL-1.1 (~180 tok)
- `PositionStoreUtilsTest.sol` — SPDX-License-Identifier: BUSL-1.1 (~193 tok)
- `PricingUtilsTest.sol` — SPDX-License-Identifier: BUSL-1.1 (~130 tok)
- `ShiftStoreUtilsTest.sol` — SPDX-License-Identifier: BUSL-1.1 (~154 tok)
- `WithdrawalStoreUtilsTest.sol` — SPDX-License-Identifier: BUSL-1.1 (~202 tok)

## contracts/token/

- `IWNT.sol` — SPDX-License-Identifier: BUSL-1.1 (~98 tok)
- `TokenUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~2478 tok)

## contracts/utils/

- `AccountUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~149 tok)
- `Array.sol` — SPDX-License-Identifier: BUSL-1.1 (~1757 tok)
- `BasicMulticall.sol` — SPDX-License-Identifier: BUSL-1.1 (~192 tok)
- `Bits.sol` — SPDX-License-Identifier: BUSL-1.1 (~202 tok)
- `Calc.sol` — SPDX-License-Identifier: BUSL-1.1 (~1536 tok)
- `Cast.sol` — SPDX-License-Identifier: BUSL-1.1 (~544 tok)
- `EnumerableValues.sol` — SPDX-License-Identifier: BUSL-1.1 (~770 tok)
- `GlobalReentrancyGuard.sol` — SPDX-License-Identifier: BUSL-1.1 (~340 tok)
- `PayableMulticall.sol` — SPDX-License-Identifier: BUSL-1.1 (~284 tok)
- `Precision.sol` — SPDX-License-Identifier: BUSL-1.1 (~1552 tok)
- `Printer.sol` — SPDX-License-Identifier: BUSL-1.1 (~195 tok)
- `StringUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~73 tok)
- `Uint256Mask.sol` — SPDX-License-Identifier: BUSL-1.1 (~157 tok)

## contracts/v1/

- `IMintable.sol` — SPDX-License-Identifier: MIT (~39 tok)
- `IRewardDistributorV1.sol` — SPDX-License-Identifier: BUSL-1.1 (~56 tok)
- `IRewardTrackerV1.sol` — SPDX-License-Identifier: BUSL-1.1 (~52 tok)
- `IRouterV1.sol` — SPDX-License-Identifier: BUSL-1.1 (~52 tok)
- `IVaultGovV1.sol` — SPDX-License-Identifier: BUSL-1.1 (~47 tok)
- `IVaultV1.sol` — SPDX-License-Identifier: BUSL-1.1 (~140 tok)
- `IVesterV1.sol` — SPDX-License-Identifier: BUSL-1.1 (~63 tok)

## contracts/withdrawal/

- `ExecuteWithdrawalUtils.sol` — Executes a withdrawal on the market. (~5166 tok)
- `IExecuteWithdrawalUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~279 tok)
- `IWithdrawalUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~243 tok)
- `Withdrawal.sol` — SPDX-License-Identifier: BUSL-1.1 (~1779 tok)
- `WithdrawalEventUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~1277 tok)
- `WithdrawalStoreUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~2529 tok)
- `WithdrawalUtils.sol` — SPDX-License-Identifier: BUSL-1.1 (~2005 tok)
- `WithdrawalVault.sol` — SPDX-License-Identifier: BUSL-1.1 (~79 tok)

## deploy/

- `configureDataStreamFeeds.ts` — Declares func (~413 tok)
- `configureGeneralSettings.ts` — Declares func (~425 tok)
- `configureGovTimelockController.ts` — Declares func (~294 tok)
- `configureOracleSigners.ts` — Declares func (~420 tok)
- `configureOracleTokens.ts` — Declares func (~738 tok)
- `configureRoles.ts` — example rolesToRemove format: (~274 tok)
- `deployAdlHandler.ts` — Declares constructorContracts (~266 tok)
- `deployAdlUtils.ts` — Declares func (~74 tok)
- `deployAndConfigureDataStore.ts` — Declares constructorContracts (~136 tok)
- `deployAndConfigureMarkets.ts` — Declares func (~1233 tok)
- `deployAndConfigureTestGlv.ts` — Declares func (~669 tok)
- `deployAutoCancelSyncer.ts` — Declares constructorContracts (~206 tok)
- `deployBaseOrderUtils.ts` — Declares func (~44 tok)
- `deployBridgeOutFromControllerUtils.ts` — Declares func (~54 tok)
- `deployCallbackUtils.ts` — Declares func (~96 tok)
- `deployChainlinkDataStreamProvider.ts` — Declares constructorContracts (~392 tok)
- `deployChainlinkPriceFeedProvider.ts` — Declares constructorContracts (~257 tok)
- `deployChainReader.ts` — Declares func (~43 tok)
- `deployClaimHandler.ts` — Declares constructorContracts (~215 tok)
- `deployClaimUtils.ts` — Declares func (~43 tok)
- `deployClaimVault.ts` — Declares constructorContracts (~124 tok)
- `deployConfig.ts` — Declares constructorContracts (~184 tok)
- `deployConfigSyncer.ts` — Declares constructorContracts (~437 tok)
- `deployConfigTimelockController.ts` — Declares timelockDelay (~265 tok)
- `deployConfigUtils.ts` — Declares func (~53 tok)
- `deployContributorHandler.ts` — Declares constructorContracts (~306 tok)
- `deployDecreaseOrderExecutor.ts` — Declares constructorContracts (~220 tok)
- `deployDecreaseOrderUtils.ts` — Declares func (~69 tok)
- `deployDecreasePositionCollateralUtils.ts` — Declares func (~111 tok)
- `deployDecreasePositionSwapUtils.ts` — Declares func (~47 tok)
- `deployDecreasePositionUtils.ts` — Declares func (~128 tok)
- `deployDepositEventUtils.ts` — Declares func (~45 tok)
- `deployDepositHandler.ts` — Declares constructorContracts (~259 tok)
- `deployDepositStoreUtils.ts` — Declares func (~45 tok)
- `deployDepositUtils.ts` — Declares func (~87 tok)
- `deployDepositVault.ts` — Declares constructorContracts (~125 tok)
- `deployEdgeDataStreamProvider.ts` — Declares constructorContracts (~237 tok)
- `deployEdgeDataStreamVerifier.ts` — Declares func (~234 tok)
- `deployEventEmitter.ts` — Declares constructorContracts (~121 tok)
- `deployExchangeRouter.ts` — Declares constructorContracts (~298 tok)
- `deployExecuteDepositUtils.ts` — Declares func (~124 tok)
- `deployExecuteGlvDepositUtils.ts` — Declares func (~128 tok)
- `deployExecuteOrderUtils.ts` — Declares func (~114 tok)
- `deployExecuteWithdrawalUtils.ts` — Declares func (~138 tok)
- `deployExternalHandler.ts` — Declares contractName (~82 tok)
- `deployFeeDistributor.ts` — Declares constructorContracts (~528 tok)
- `deployFeeDistributorUtils.ts` — Declares func (~46 tok)
- `deployFeeDistributorVault.ts` — Declares constructorContracts (~129 tok)
- `deployFeeHandler.ts` — Declares constructorContracts (~494 tok)
- `deployFeeUtils.ts` — Declares func (~63 tok)
- `deployGasTest.ts` — Declares func (~75 tok)
- `deployGasUtils.ts` — Declares func (~53 tok)
- `deployGelatoRelayRouter.ts` — Declares constructorContracts (~241 tok)
- `deployGlvDepositCalc.ts` — Declares func (~59 tok)
- `deployGlvDepositEventUtils.ts` — Declares func (~62 tok)
- `deployGlvDepositHandler.ts` — Declares constructorContracts (~270 tok)
- `deployGlvDepositStoreUtils.ts` — Declares func (~46 tok)
- `deployGlvDepositUtils.ts` — Declares func (~122 tok)
- `deployGlvFactory.ts` — Declares constructorContracts (~188 tok)
- `deployGlvReader.ts` — Declares func (~96 tok)
- `deployGlvRouter.ts` — Declares constructorContracts (~236 tok)
- `deployGlvShiftEventUtils.ts` — Declares func (~45 tok)
- `deployGlvShiftHandler.ts` — Declares constructorContracts (~269 tok)
- `deployGlvShiftStoreUtils.ts` — Declares func (~45 tok)
- `deployGlvShiftUtils.ts` — Declares func (~98 tok)
- `deployGlvStoreUtils.ts` — Declares func (~44 tok)
- `deployGlvUtils.ts` — Declares func (~62 tok)
- `deployGlvVault.ts` — Declares constructorContracts (~122 tok)
- `deployGlvWithdrawalEventUtils.ts` — Declares func (~47 tok)
- `deployGlvWithdrawalHandler.ts` — Declares constructorContracts (~266 tok)
- `deployGlvWithdrawalStoreUtils.ts` — Declares func (~47 tok)
- `deployGlvWithdrawalUtils.ts` — Declares func (~130 tok)
- `deployGmOracleProvider.ts` — Declares constructorContracts (~217 tok)
- `deployGovTimelockController.ts` — Declares func (~136 tok)
- `deployGovToken.ts` — Declares func (~119 tok)
- `deployIncreaseOrderExecutor.ts` — Declares constructorContracts (~215 tok)
- `deployIncreaseOrderUtils.ts` — Declares func (~79 tok)
- `deployIncreasePositionUtils.ts` — Declares func (~98 tok)
- `deployJitOrderHandler.ts` — API routes: GET (1 endpoints) (~434 tok)
- `deployLayerZeroProvider.ts` — Declares constructorContracts (~396 tok)
- `deployLiquidationHandler.ts` — Declares constructorContracts (~265 tok)
- `deployLiquidationUtils.ts` — Declares func (~72 tok)
- `deployMarketEventUtils.ts` — Declares func (~45 tok)
- `deployMarketFactory.ts` — Declares constructorContracts (~190 tok)
- `deployMarketStoreUtils.ts` — Declares func (~45 tok)
- `deployMarketUtils.ts` — Declares func (~60 tok)
- `deployMockDataStreamFeedVerifier.ts` — Declares func (~116 tok)
- `deployMockEndpointV2.ts` — Declares func (~135 tok)
- `deployMockMultichainReaderOriginator.ts` — Declares constructorContracts (~240 tok)
- `deployMockOracleProvider.ts` — Declares func (~115 tok)
- `deployMockPriceFeed.ts` — Declares func (~44 tok)
- `deployMockRiskOracle.ts` — Declares func (~412 tok)
- `deployMockStargatePoolNative.ts` — Declares constructorContracts (~183 tok)
- `deployMockStargatePoolUsdc.ts` — Declares constructorContracts (~184 tok)
- `deployMockTimelockV1.ts` — Declares func (~391 tok)
- `deployMockVaultGovV1.ts` — Declares func (~114 tok)
- `deployMockVaultV1.ts` — Declares constructorContracts (~185 tok)
- `deployMulticall3.ts` — Declares func (~61 tok)
- `deployMultichainClaimsRouter.ts` — Declares baseConstructorContracts (~438 tok)
- `deployMultichainGlvRouter.ts` — Declares baseConstructorContracts (~489 tok)
- `deployMultichainGmRouter.ts` — Declares baseConstructorContracts (~547 tok)
- `deployMultichainOrderRouter.ts` — Declares baseConstructorContracts (~765 tok)
- `deployMultichainReader.ts` — Declares constructorContracts (~336 tok)
- `deployMultichainSubaccountRouter.ts` — Declares baseConstructorContracts (~458 tok)
- `deployMultichainTransferRouter.ts` — Declares baseConstructorContracts (~409 tok)
- `deployMultichainUtils.ts` — Declares func (~44 tok)
- `deployMultichainVault.ts` — Declares constructorContracts (~126 tok)
- `deployOracle.ts` — Declares constructorContracts (~572 tok)
- `deployOracleStore.ts` — Declares constructorContracts (~175 tok)
- `deployOrderEventUtils.ts` — Declares func (~44 tok)
- `deployOrderHandler.ts` — Declares constructorContracts (~459 tok)
- `deployOrderStoreUtils.ts` — Declares func (~44 tok)
- `deployOrderUtils.ts` — Declares func (~97 tok)
- `deployOrderVault.ts` — Declares constructorContracts (~124 tok)
- `deployPositionEventUtils.ts` — Declares func (~45 tok)
- `deployPositionImpactPoolUtils.ts` — Declares func (~72 tok)
- `deployPositionPricingUtils.ts` — Declares func (~46 tok)
- `deployPositionStoreUtils.ts` — Declares func (~45 tok)
- `deployPositionUtils.ts` — Declares func (~66 tok)
- `deployPrinter.ts` — Declares func (~42 tok)
- `deployProtocolGovernor.ts` — Declares func (~203 tok)
- `deployReader.ts` — Declares func (~132 tok)
- `deployReaderDepositUtils.ts` — Declares func (~77 tok)
- `deployReaderPositionUtils.ts` — Declares func (~74 tok)
- `deployReaderPricingUtils.ts` — Declares func (~73 tok)
- `deployReaderUtils.ts` — Declares func (~70 tok)
- `deployReaderWithdrawalUtils.ts` — Declares func (~78 tok)
- `deployReferralEventUtils.ts` — Declares func (~45 tok)
- `deployReferralStorage.ts` — Declares func (~368 tok)
- `deployReferralUtils.ts` — Declares func (~60 tok)
- `deployRelayUtils.ts` — Declares func (~56 tok)
- `deployRoleStore.ts` — Declares func (~67 tok)
- `deployRouter.ts` — Declares constructorContracts (~118 tok)
- `deployShiftEventUtils.ts` — Declares func (~44 tok)
- `deployShiftHandler.ts` — Declares constructorContracts (~254 tok)
- `deployShiftStoreUtils.ts` — Declares func (~44 tok)
- `deployShiftUtils.ts` — Declares func (~124 tok)
- `deployShiftVault.ts` — Declares constructorContracts (~124 tok)
- `deploySubaccountGelatoRelayRouter.ts` — Declares constructorContracts (~256 tok)
- `deploySubaccountRouter.ts` — Declares constructorContracts (~265 tok)
- `deploySubaccountRouterUtils.ts` — Declares func (~61 tok)
- `deploySubaccountUtils.ts` — Declares func (~44 tok)
- `deploySwapHandler.ts` — Declares constructorContracts (~202 tok)
- `deploySwapOrderExecutor.ts` — Declares constructorContracts (~206 tok)
- `deploySwapOrderUtils.ts` — Declares func (~58 tok)
- `deploySwapPricingUtils.ts` — Declares func (~50 tok)
- `deploySwapUtils.ts` — Declares func (~73 tok)
- `deployTestPriceFeeds.ts` — Declares func (~241 tok)
- `deployTestTokens.ts` — Declares func (~697 tok)
- `deployTimelockConfig.ts` — libraries: grantProposerRole (~484 tok)
- `deployTimestampInitializer.ts` — Declares constructorContracts (~222 tok)
- `deployWithdrawalEventUtils.ts` — Declares func (~46 tok)
- `deployWithdrawalHandler.ts` — Declares constructorContracts (~263 tok)
- `deployWithdrawalStoreUtils.ts` — Declares func (~46 tok)
- `deployWithdrawalUtils.ts` — Declares func (~90 tok)
- `deployWithdrawalVault.ts` — Declares constructorContracts (~126 tok)
- `fixVirtualInventoryForPositions.ts` — Declares func (~1167 tok)
- `fixVirtualInventoryForSwaps.ts` — Declares func (~862 tok)
- `fixVirtualInventoryForSwaps2.ts` — Declares func (~918 tok)
- `fundAccounts.ts` — Declares func (~174 tok)

## deploy/migrations/

- `addVirtualTokenIdToBtcMarketsTestnet.ts` — Declares func (~238 tok)
- `disableOldTestMarketOnAvalanacheFuji.ts` — Declares func (~152 tok)

## docs/

- `arbitrum-deployments.md` — Arbitrum One Deployments (~5635 tok)
- `arbitrumSepolia-deployments.md` — Arbitrum Sepolia Deployments (~5756 tok)
- `avalanche-deployments.md` — Avalanche C-Chain Deployments (~5590 tok)
- `avalancheFuji-deployments.md` — Avalanche Fuji Deployments (~6058 tok)
- `base-mainnet-notes.md` — Base Mainnet Notes (~1770 tok)
- `botanix-deployments.md` — Botanix Deployments (~5456 tok)
- `contracts.json` (~24563 tok)
- `deploymentInfo.html` — Grouped Contracts Table (~750 tok)
- `README.md` — Project documentation (~414 tok)

## forked-env-example/

- `.gitignore` — Git ignore rules (~120 tok)
- `foundry.toml` (~179 tok)
- `hardhat.config.ts` — Filter out Foundry-specific files that import forge-std (~512 tok)
- `package.json` — Node.js package manifest (~292 tok)
- `QUICKSTART.md` — GMX Forked env example - Quick Start (~1663 tok)
- `tsconfig.json` — TypeScript configuration (~114 tok)

## forked-env-example/contracts/constants/

- `GmxArbitrumAddresses.sol` — GMX Synthetics V2 contract addresses on Arbitrum mainnet (~896 tok)

## forked-env-example/contracts/interfaces/

- `IERC20.sol` — ERC20 Token Interface (~106 tok)
- `IGmxV2.sol` — Minimal interface definitions copied from GMX Synthetics V2 (~1824 tok)

## forked-env-example/contracts/mock/

- `MockOracleProvider.sol` — SPDX-License-Identifier: BUSL-1.1 (~498 tok)

## forked-env-example/contracts/utils/

- `GmxForkHelpers.sol` — Helper utilities for GMX fork testing (~3696 tok)

## forked-env-example/scripts/

- `helpers.ts` — Load all GMX contracts at their deployed addresses (~4568 tok)
- `testOpenPosition.ts` — Test script demonstrating how to open and close a long ETH position on GMX V2 (~5240 tok)

## forked-env-example/test/

- `GmxOrderFlow.t.sol` — Fork tests demonstrating GMX Synthetics V2 order flow on Arbitrum (~3351 tok)

## interface/

- `Signer.css` — Styles: 3 rules (~120 tok)
- `Signer.tsx` — fetcher (~657 tok)
- `SignerButton.tsx` — SignerButton (~325 tok)
- `Style.css` — Styles: 4 rules (~121 tok)
- `Toast.ts` — Declares toastConfig (~119 tok)

## ops/

- `RUNBOOK.md` — Ops Runbook — Mainnet Config Changes (~1119 tok)

## ops/config-changes/2026-05-11-feature-redaction/

- `README.md` — Project documentation (~848 tok)

## scripts/

- `bridgedGmxReceivedLocalhost.ts` — Declares main (~4695 tok)
- `cacheUtils.ts` — Exports FileCache (~571 tok)
- `cancelOrder.ts` — Declares main (~134 tok)
- `checkUseOpenInterestInTokensImpact.ts` — Script to check the impact on GM token prices if USE_OPEN_INTEREST_IN_TOKENS_FOR_BALANCE is set to true (~3036 tok)
- `collectDeployments.ts` — Exports collectDeployments (~341 tok)
- `contractSizes.ts` — Exports checkContractsSizing (~372 tok)
- `createDepositSynthetic.ts` — getValues: main (~1446 tok)
- `createDepositWethUsdc.ts` — getValues: main (~1489 tok)
- `createDepositWnt.ts` — getValues: main (~1323 tok)
- `createGlv.ts` — Declares main (~797 tok)
- `createGlvDeposit.ts` — STARGATE_USDC_ARB_SEPOLIA: getValues, main (~1465 tok)
- `createGlvShift.ts` — Declares main (~586 tok)
- `createLimitLongWethUsdc.ts` — getValues: main (~1326 tok)
- `createMarket.ts` — Declares main (~1448 tok)
- `createMarketDecreaseLongWethUsdc.ts` — getValues: main (~1070 tok)
- `createMarketIncreaseLongWethUsdc_debugPriceAlreadySet.ts` — getValues: main (~1267 tok)
- `createMarketIncreaseLongWethUsdc.ts` — getValues: main (~1404 tok)
- `createMarketsOrders.ts` — Creates long and short orders for all (or specified) markets. (~7255 tok)
- `createMarketSwapWethUsdc.ts` — getValues: main (~1277 tok)
- `createOrder.ts` — INSTRUCTIONS TO RUN (~2042 tok)
- `createShift.ts` — amountToSend: getArgs, main (~612 tok)
- `cyclicDependencyCheck.ts` — SETTINGS (~822 tok)
- `debugDeposit.ts` — Declares main (~319 tok)
- `deleteFujiGlv.ts` — Declares main (~197 tok)
- `deployForkArbSys.ts` — ARB_SYS_ADDRESS: main (~132 tok)
- `deployFujiGlv.ts` — Declares main (~922 tok)
- `deployGlv.ts` — Declares main (~956 tok)
- `deployMockGovContracts.ts` — Declares main (~219 tok)
- `disableOldHandlers.ts` — Script to disable old handler contracts by revoking their CONTROLLER role (~1243 tok)
- `estimateShiftAmounts.ts` — getOracleAbi: getTickers, getPriceProp, main (~1237 tok)
- `feeDistributorConfigTestnet.ts` — ChainConfig: delay, getFactory, loadDeployment + 3 more (~8292 tok)
- `feeDistributorDeployTestnet.ts` — DEPLOYMENT_TAG: saveCheckpoint, loadCheckpoint, clearCheckpoint + 3 more (~6351 tok)
- `generateDeploymentDocs.sh` — Check if any deployment files have been modified in the last commit (~302 tok)
- `generateDeploymentDocs.ts` — Exports generateDeploymentDocs (~3184 tok)
- `generateMarketClaimsData.ts` — MARKET=<address> DISTRIBUTION_TYPE_ID=<number> START_BLOCK=<number> npx hardhat run scripts/generateMarketClaimsData.ts --network arbitrum (~5745 tok)
- `helpers.ts` — Exports getMinRewardThreshold, STIP_LP_DISTRIBUTION_TYPE_ID, STIP_MIGRATION_DISTRIBUTION_TYPE_ID, STIP_TRADING_INCENTIVES_DISTRIBUTION_TYPE_ID + 23... (~5338 tok)
- `initializeOrderTimestamps.ts` — Declares main (~367 tok)
- `initializePositionTimestamps.ts` — Declares main (~374 tok)
- `initOracleConfigForTokens.ts` — Declares main (~68 tok)
- `initOracleConfigForTokensUtils.ts` — Exports initOracleConfigForTokens, validatePriceFeed (~2740 tok)
- `keygen.ts` — npx ts-node scripts/keygen.ts (~143 tok)
- `mineBlock.ts` — Declares main (~65 tok)
- `parseError.ts` — Declares main (~150 tok)
- `parseExhangeRouterTransaction.ts` — Declares main (~156 tok)
- `parseTransactionData.ts` — value: main (~582 tok)
- `parseTransactionEvents.ts` — Declares main (~587 tok)
- `parseTransactionRevertReason.ts` — Declares main (~373 tok)
- `printAutoCancelOrders.ts` — Declares main (~178 tok)
- `printBtc.ts` — Declares main (~91 tok)
- `printBuybackInfo.ts` — getOracleAbi: getPricesFromTickers, main (~824 tok)
- `printChainlinkPriceFeedProviderReport.ts` — Declares main (~748 tok)
- `printClaimableCollateralAmounts.ts` — appendQuery: main (~731 tok)
- `printClaimableFundingAmounts.ts` — appendQuery: main (~630 tok)
- `printClaimHandlerDepositFundsPayload.ts` — payload: main (~262 tok)
- `printDataStoreValues.ts` — Declares main (~145 tok)
- `printDataStreamConfig.ts` — Declares main (~242 tok)
- `printDeployments.ts` — Declares main (~165 tok)
- `printDeposits.ts` — Declares main (~222 tok)
- `printFeeTypes.ts` — Declares main (~72 tok)
- `printGeneralConfig.ts` — Declares main (~314 tok)
- `printGlvPrices.ts` — getOracleAbi: getTickers, getPriceProp, main (~704 tok)
- `printGlvs.ts` — Declares main (~435 tok)
- `printGlvValueDiff.ts` — getValues: main (~1269 tok)
- `printHash.ts` — Declares main (~82 tok)
- `printKey.ts` — Declares main (~198 tok)
- `printKeys.ts` — Declares main (~92 tok)
- `printMarketFundingConfiguration.ts` — Declares main (~545 tok)
- `printMarketFundingOnchainConfiguration.ts` — Declares main (~545 tok)
- `printMarketFundingStaticConfiguration.ts` — main: getMarketToken (~579 tok)
- `printMarketInfo.ts` — fetch: getTickersUrl, getTokenPrice, main (~4674 tok)
- `printMarkets.ts` — Declares main (~481 tok)
- `printMarketTokenPrice.ts` — getValues: main (~902 tok)
- `printMaxExecutionGas.ts` — minHandleExecutionErrorGas + max(depositGasLimit, withdrawalGasLimit, increaseOrderGasLimit, decreaseOrderGasLimit, swapOrderGasLimit) + estimatedG... (~494 tok)
- `printOracleConfig.ts` — Declares main (~360 tok)
- `printOracleSigners.ts` — Declares main (~132 tok)
- `printOrder.ts` — API routes: GET (1 endpoints) (~154 tok)
- `printPoolData.ts` — Declares main (~378 tok)
- `printPositionInfo.ts` — API routes: GET (2 endpoints) (~2196 tok)
- `printPositionsWithAutoCancelOrders.ts` — getListKey: main (~562 tok)
- `printRoles.ts` — knownRoles: main (~485 tok)
- `printSettings.ts` — Declares main (~220 tok)
- `printTokens.ts` — Declares main (~493 tok)
- `printTrace.ts` — traceFileName: main, printCall, getInfo, getName, getFunctionData (~2505 tok)
- `printVirtualInventory.ts` — Declares main (~950 tok)
- `printWithdrawals.ts` — Declares main (~234 tok)
- `processLzReceiveLocalhost.ts` — Declares main (~4307 tok)
- `read.ts` — Declares main (~302 tok)
- `removeMarketFromGlv.ts` — Declares main (~328 tok)
- `rerunTransactionInLocalFork.ts` — Declares main (~567 tok)
- `sendPayments.ts` — Declares main (~396 tok)
- `setPricesLocalhost.ts` — main: getOracleParams (~1549 tok)
- `simulate.ts` — Declares main (~1826 tok)
- `simulateExecuteOrder.ts` — to run the script: (~439 tok)
- `syncAutoCancelList.ts` — Declares main (~111 tok)
- `syncConfigWithRiskOracle.ts` — Declares main (~236 tok)
- `syncContributorPayments.ts` — scripts/sync.ts (~2164 tok)
- `syncPositionImpactExponentFactors.ts` — write: generateOldKey, generateNewKey, main (~2035 tok)
- `syncVirtualPriceImpact.ts` — write: processMarketGroup, main (~1450 tok)
- `testExecuteOrders.ts` — orders: simulateExecuteOrders, main (~574 tok)
- `toggleFeatures.ts` — Exports main (~1308 tok)
- `toggleMarkets.ts` — Exports main (~818 tok)
- `updateAtomicOracleProviders.ts` — expectedTimelockMethods: main (~525 tok)
- `updateBuybackConfig.ts` — Declares main (~742 tok)
- `updateChainReader.ts` — Declares main (~301 tok)
- `updateClaimableCollateralFactors.ts` — updateSingleFactor: updateMultipleFactors, main (~1173 tok)
- `updateClaimableReductionFactors.ts` — updateMultipleFactors: main (~1082 tok)
- `updateConfig.ts` — Declares main (~230 tok)
- `updateConfigUtils.ts` — Exports ConfigChangeItem, ChangeResult, handleConfigChanges (~1353 tok)
- `updateGeneralConfig.ts` — Declares main (~78 tok)
- `updateGeneralConfigUtils.ts` — Exports updateGeneralConfig (~3519 tok)
- `updateGlvConfig.ts` — Declares main (~74 tok)
- `updateGlvConfigUtils.ts` — Exports updateGlvConfig (~1668 tok)
- `updateMarketConfig.ts` — Declares main (~198 tok)
- `updateMarketConfigUtils.ts` — RISK_ORACLE_MANAGED_BASE_KEYS: getRiskOracleManagedBaseKeys, getKeeperManagedBaseKeys (~7715 tok)
- `updateMarketPositionImpactDistributionConfig.ts` — Declares main (~1879 tok)
- `updateOracleConfig.ts` — Declares main (~589 tok)
- `updateOracleConfigForTokens.ts` — Exports updateOracleConfigForTokens (~3665 tok)
- `updateOracleProviders.ts` — expectedTimelockMethods: main (~886 tok)
- `updateOracleTimestampAdjustment.ts` — Declares main (~392 tok)
- `updatePriceFeeds.ts` — expectedPhases: main (~770 tok)
- `updateReferralStorage.ts` — Exports main (~482 tok)
- `updateRiskOracleConfig.ts` — Declares main (~80 tok)
- `updateRiskOracleConfigUtils.ts` — Exports updateRiskOracleConfig (~1252 tok)
- `updateRoles.ts` — expectedTimelockMethods: getTimelock, getGrantRoleActionKeysToCancel, main (~1919 tok)
- `updateTokenConfig.ts` — processTokens: main (~640 tok)
- `validateContractDeployment.ts` — COMMIT_HASH: main, printResults, isRoleSignalEvent + 5 more (~1938 tok)
- `validateDeploymentUtils.ts` — API routes: GET (3 endpoints) (~4038 tok)
- `validateFunctions.ts` — ROOT: maskRange, stripNoise, buildLineIndex + 5 more (~1862 tok)
- `validateGlpDistribution.ts` — summarize: printDiffs, main (~783 tok)
- `validateMarketConfigs.ts` — Declares main (~72 tok)
- `validateMarketConfigsUtils.ts` — Declares priceImpactBpsList (~14613 tok)
- `validateRoles.ts` — Declares main (~65 tok)
- `validateRolesUtils.ts` — API routes: GET (4 endpoints) (~3896 tok)
- `validateTickers.ts` — Declares main (~66 tok)
- `validateTickersUtils.ts` — Exports validateTickers (~1511 tok)
- `validateTokenUtils.ts` — Exports isErc777Token, validateTokens (~1675 tok)
- `verifyFallback.ts` — largeContractsMap: withTimeout, getIsContractVerified, encodeArg, verifyForNetwork, main (~1970 tok)
- `verifyTenderly.ts` — TENDERLY_USERNAME=<username> npx hardhat --config hardhat.config.tenderly.ts run scripts/verifyTenderly.ts --network <network> (~849 tok)
- `withdrawFromPositionImpactPool.ts` — expectedTimelockMethods: fetchChainlinkPriceFeedInfo, fetchChainlinkDataStreamInfo, fetchOracleParams, main (~2787 tok)
- `wrapNativeToken.ts` — value: main (~404 tok)

## scripts/configs/

- `configRuntime.ts` — Exports isTruthy, getConfigHre, getWriteMode, getIsDisabled + 2 more (~394 tok)
- `index.ts` — Declares main (~785 tok)
- `README.md` — Project documentation (~1488 tok)
- `run-feature-validation.sh` (~88 tok)

## scripts/configs/configs/

- `applyPoolRiskGuards.ts` — Exports runApplyPoolRiskGuards (~2156 tok)
- `disableInactiveMarkets.ts` — Exports runDisableInactiveMarkets (~1146 tok)
- `disableOrderCreateFeatures.ts` — Exports runDisableOrderCreateFeatures (~122 tok)
- `disableOrderExecuteFeatures.ts` — Exports runDisableOrderExecuteFeatures (~124 tok)
- `setAtomicWithdrawalFeatureState.ts` — Exports runSetAtomicWithdrawalFeatureState (~123 tok)
- `setGaslessFeatureState.ts` — Exports runSetGaslessFeatureState (~112 tok)
- `setJitFeatureState.ts` — Exports runSetJitFeatureState (~108 tok)
- `setShiftFeaturesState.ts` — Exports runSetShiftFeaturesState (~104 tok)
- `setSubaccountFeatureState.ts` — Exports runSetSubaccountFeatureState (~114 tok)

## scripts/configs/helpers/

- `applyFeatureFlagWrites.ts` — * Writes Config.setBool entries for the provided feature specs (dry-run unless WRITE=true is specifi (~756 tok)
- `disableOrderFeatures.ts` — Exports disableOrderFeatures (~726 tok)
- `featureFlagSpecs.ts` — Exports ManagedFeatureId, ModuleFeatureSpec, OrderTypeFeatureSpec, ManagedFeatureSpec + 8 more (~3164 tok)
- `getConfigKeeperSigner.ts` — Exports getConfigKeeperRoleSigner (~1087 tok)

## scripts/configs/presets/

- `default.ts` — Exports defaultPreset (~122 tok)
- `index.ts` — Exports PRESET, loadPreset (~182 tok)
- `README.md` — Project documentation (~509 tok)
- `types.ts` — Exports RunFeatureKey, FeatureFlags (~148 tok)
- `validate.ts` — Exports validatePreset (~111 tok)

## scripts/configs/profiles/

- `all.ts` — Exports allProfile (~105 tok)
- `index.ts` — Exports PROFILES, loadProfile (~156 tok)
- `README.md` — Project documentation (~540 tok)
- `redact-all.ts` — Exports redactAllProfile (~106 tok)
- `types.ts` — Exports RunFeatureKey, Profile (~146 tok)

## scripts/configs/validations/

- `printRolesResolved.ts` — Exports runPrintRolesResolved (~876 tok)
- `runInvariantChecks.ts` — Exports runInvariantChecks (~169 tok)
- `verifyAtomicWithdrawalFeatureState.ts` — Exports runVerifyAtomicWithdrawalFeatureState (~124 tok)
- `verifyFeatureFlagStates.ts` — Exports makeVerifyFeatureFlagRunner, verifyFeatureFlagStates (~591 tok)
- `verifyFeaturesState.ts` — Exports runVerifyFeaturesState (~406 tok)
- `verifyFeatureValidationProfile.ts` — PROFILE_PATH: main (~529 tok)
- `verifyGaslessFeatureState.ts` — Exports runVerifyGaslessFeatureState (~113 tok)
- `verifyJitFeatureState.ts` — Exports runVerifyJitFeatureState (~109 tok)
- `verifyPoolRiskGuards.ts` — Exports runVerifyPoolRiskGuards (~1452 tok)
- `verifyRedactionState.ts` — Exports runVerifyRedactionState (~1309 tok)
- `verifySameTokenInvariants.ts` — Exports runVerifySameTokenInvariants (~1081 tok)
- `verifyShiftCancelFeatureState.ts` — Exports runVerifyShiftCancelFeatureState (~118 tok)
- `verifyShiftCreateFeatureState.ts` — Exports runVerifyShiftCreateFeatureState (~118 tok)
- `verifyShiftExecuteFeatureState.ts` — Exports runVerifyShiftExecuteFeatureState (~118 tok)
- `verifySubaccountFeatureState.ts` — Exports runVerifySubaccountFeatureState (~116 tok)
- `verifyVirtualIdAllowlist.ts` — Exports runVerifyVirtualIdAllowlist (~1150 tok)

## scripts/incentives/

- `.batchesInProgress.json` (~1 tok)
- `.migrations.json` (~1884 tok)
- `batchSend.ts` — getArbValues: getAvaxValues, getValues, main + 7 more (~3192 tok)
- `getTotalGlpMigrationRebates.ts` — Exports main (~377 tok)
- `getTotalGlpMigrationRebatesDiff.ts` — Exports main (~1011 tok)
- `lpIncentives.ts` — getUserMarketInfosQuery: requestBalancesData, main (~4065 tok)
- `new.json` (~15794 tok)
- `old.json` (~11508 tok)
- `receiverOverrides.ts` (~124 tok)
- `sendResidualFundsBack.ts` — shouldSendTxn: getArbValues, getAvaxValues, getValues, main (~527 tok)
- `stipGlpMigrationRebates.ts` — BASIS_POINTS_DIVISOR: requestMigrationData, main (~1782 tok)
- `tradingIncentives.ts` — requestMigrationData: main (~1929 tok)

## scripts/incentives/abi/

- `BatchSender.json` (~447 tok)

## scripts/multichain/

- `bridgeInComposedMsg.ts` — STARGATE_POOL_USDC_SEPOLIA: prepareSend, getComposedMsg (~10065 tok)
- `bridgeInCrossChain.ts` — IOFT_FQN: getComposedMsg, prepareSend, main (~2320 tok)
- `bridgeInSameChain.ts` — multichainTransferRouterJson: main (~875 tok)
- `bridgeOutCrossChain.ts` — GM_OFT: main (~1293 tok)
- `utils.ts` — Exports getDeployments, getIncreasedValues, checkBalance, checkMultichainBalance + 4 more (~2087 tok)

## scripts/nivo/

- `cancelDepositOrder.ts` — Cancel a deposit created with createDepositNivoMarket.ts, uses the WALLET_TESTER_PRIVATE_KEY. (~898 tok)
- `cancelPositionOrder.ts` — Cancel a position order created with openPositionOrder.ts using WALLET_TESTER_PRIVATE_KEY. (~830 tok)
- `closePositionOrder.ts` — createCloseOrder: main (~1580 tok)
- `depositOrder.ts` — Create a deposit into a Nivo FX market (FX/USDC). Uses the WALLET_TESTER_PRIVATE_KEY. (~2296 tok)
- `executeClosePosition.ts` — Execute a close (MarketDecrease) order. Same flow as executeOpenPosition: (~1258 tok)
- `executeDeposit.ts` — Execute a deposit into a Nivo FX market (GBP/USDC). Uses the NIVO_KEEPER_PRIVATE_KEY. (~1399 tok)
- `executeOpenPosition.ts` — Declares main (~1282 tok)
- `openPositionOrder.ts` — computeAcceptablePrice: createOrder, main (~2668 tok)
- `printPositionInfo.ts` — applyInversion: main, toMarketTokenPrice (~2299 tok)
- `utils.ts` — Exports withGasBuffer, SUPPORTED_NETWORKS, getDepositExecutionFee (~534 tok)

## scripts/nivo/chainlinkProvider/

- `chainlinkReportFetcher.ts` — Exports PriceData, fetchDataStreamReport (~512 tok)
- `client.ts` — Exports DATA_STREAM_CONFIG, getDataStreamsClient (~289 tok)
- `signedPricesBaseSepolia.ts` — Exports PriceData, SignedPrices, fetchChainlinkPriceForToken, fetchSignedPricesBaseSepolia (~441 tok)

## scripts/position/

- `closeLongPosition.ts` — API routes: GET (2 endpoints) (~2448 tok)

## scripts/roles/rolesToAdd/

- `arbitrum.ts` — Exports ROLES_TO_ADD (~1766 tok)
- `avalanche.ts` — Exports ROLES_TO_ADD (~1789 tok)
- `botanix.ts` — Exports ROLES_TO_ADD (~1717 tok)
- `index.ts` (~48 tok)

## scripts/roles/rolesToRemove/

- `arbitrum.ts` — Exports ROLES_TO_REMOVE (~110 tok)
- `avalanche.ts` — Exports ROLES_TO_REMOVE (~3148 tok)
- `botanix.ts` — Exports ROLES_TO_REMOVE (~2310 tok)
- `index.ts` (~50 tok)

## scripts/sanity/

- `checkGeneralConfig.ts` — safeAddress: main (~402 tok)

## test/claim/

- `ClaimHandler.ts` — Declares initialDepositorBalance (~13044 tok)

## test/config/

- `Config.ts` — Declares keys (~6898 tok)
- `ConfigSyncer.ts` — Declares referenceIds (~5810 tok)
- `Timelock.ts` — Declares orderKeeperRole (~10087 tok)
- `VerifySwapReconfiguration.ts` — DEFAULT_CONFIG_KEEPER: tryRpc, impersonateAccount, stopImpersonateAccount, setAccountBalance (~1261 tok)

## test/contributor/

- `ContributorHandler.ts` — Declares block (~3219 tok)

## test/deposit/

- `DepositStoreUtils.ts` (~476 tok)

## test/event/

- `EventEmitter.ts` — Declares topic1 (~238 tok)

## test/exchange/

- `AdlOrder.ts` — Declares maxPnlFactorForAdlKey (~824 tok)
- `AutoCancelOrder.ts` — Declares _createOrder (~1818 tok)
- `BorrowingFees.ts` — Declares testBorrowingFees (~6548 tok)
- `CancelDeposit.ts` — Declares revertingCallbackReceiver (~1463 tok)
- `CancelOrder.ts` — Declares revertingCallbackReceiver (~2249 tok)
- `CancelWithdrawal.ts` — Declares withdrawalKeys (~826 tok)
- `Deposit.ts` — Declares params (~10800 tok)
- `DepositCollateral.ts` — Declares params (~1177 tok)
- `Jit.ts` — Declares glvShiftExecutedLogs (~3054 tok)
- `LimitDecreaseOrder.ts` — Declares getParams (~1407 tok)
- `LimitIncreaseOrder.ts` — Declares params (~2574 tok)
- `LiquidationOrder.ts` (~802 tok)
- `MarketDecreaseOrder.ts` — Declares getParams (~3171 tok)
- `MarketIncreaseOrder.ts` — Declares dataList (~5795 tok)
- `PositionFees.ts` — Declares referralCode0 (~7128 tok)
- `PositionImpactPoolDistribution.ts` (~1147 tok)
- `PositionOrder.ts` — Declares params (~3444 tok)
- `Shift.ts` — Declares dataList (~2779 tok)
- `StopIncreaseOrder.ts` — Declares params (~2026 tok)
- `StopLossDecreaseOrder.ts` — Declares params (~927 tok)
- `SwapOrder.ts` — Declares swapInfoEvent (~3722 tok)
- `UpdateOrder.ts` — Declares params (~2168 tok)
- `VirtualPositionPriceImpact.ts` — Declares ethUsdVirtualTokenId (~2595 tok)
- `VirtualSwapPriceImpact.ts` — Declares ethUsdVirtualMarketId (~2301 tok)
- `Withdrawal.ts` — Declares dataList (~6689 tok)
- `WithdrawCollateral.ts` — Declares positionIncreaseEvent (~1170 tok)

## test/exchange/DecreasePosition/

- `CappedPnl.ts` (~2456 tok)
- `CappedPriceImpact.ts` — Declares positionKey0 (~3960 tok)
- `InsolventClose.ts` — Declares refTime (~4619 tok)
- `NegativePnl.ts` — Declares positionKey0 (~681 tok)
- `NegativePriceImpact_NegativePnl.ts` — Declares positionKey0 (~2098 tok)
- `NegativePriceImpact_PositivePnl.ts` — Declares positionKey0Long (~2130 tok)
- `PositivePriceImpact_NegativePnl.ts` — Declares positionKey0 (~1796 tok)
- `PositivePriceImpact_PositivePnl.ts` — Declares positionKey0 (~2152 tok)
- `PositivePriceImpact_SwapPnlTokenToCollateralToken.ts` — Declares positionKey0 (~1556 tok)
- `RemainingCollateral.ts` (~1372 tok)
- `Spread.ts` — Declares positionKey0 (~1653 tok)
- `SwapCollateralTokenToPnlToken_PositivePnl_UnableToSwap.ts` (~410 tok)
- `SwapCollateralTokenToPnlToken_PositivePnl.ts` (~351 tok)
- `SwapPnlTokenToCollateralToken_PositivePnl_UnableToSwap.ts` (~594 tok)
- `SwapPnlTokenToCollateralToken_PositivePnl.ts` (~317 tok)

## test/exchange/FundingFees/

- `AdaptiveFunding.ts` — Declares testAdaptiveFunding (~5566 tok)
- `PairMarket.ts` — Declares block (~4112 tok)
- `PairMarketBalanceCheck.ts` — Declares feeInfo (~5113 tok)
- `SingleTokenMarket.ts` — Declares testFunding (~2115 tok)
- `SingleTokenMarketBalanceCheck.ts` — Declares feeInfo (~4148 tok)

## test/exchange/PositionPriceImpact/

- `PairMarket.ts` — Declares params (~12968 tok)
- `SyntheticMarket.ts` — Declares params (~1198 tok)

## test/fee/

- `FeeDistributor.ts` — Declares eidA (~22772 tok)
- `FeeHandler.ts` — Declares wethPrice (~5310 tok)

## test/gas/

- `gasLeft.ts` — Declares gasUsageTestLib (~160 tok)

## test/glv/

- `Glv.ts` — Declares glvType (~2757 tok)
- `glvDeposit.ts` — Declares glvType (~9895 tok)
- `GlvDepositStoreUtils.ts` (~515 tok)
- `glvReader.ts` — Declares glvInfo (~273 tok)
- `glvShift.ts` — Declares block (~5749 tok)
- `GlvShiftStoreUtils.ts` (~432 tok)
- `GlvStoreUtils.ts` — Declares sampleItem (~850 tok)
- `glvTokenPrice.ts` — getPriceProp: expectGlvTokenPrice, _expectBalances (~2273 tok)
- `glvWithdrawal.ts` — Declares glvType (~7723 tok)
- `GlvWithdrawalStoreUtils.ts` (~536 tok)

## test/gov/

- `GovTimelockController.ts` — Declares accountList (~1702 tok)
- `GovToken.ts` — Declares accountList (~1687 tok)
- `ProtocolGovenor.ts` — Declares accountList (~1972 tok)

## test/guardian/

- `testAdl.ts` — Declares maxPnlFactorKey (~2069 tok)
- `testCallback.ts` — Declares mockCallbackReceiver (~1193 tok)
- `testCancelOrder.ts` — Declares orderKeys (~3906 tok)
- `testDataStreamFeeds.ts` — Declares getBaseDataStreamData (~2829 tok)
- `testDeposit.ts` — Declares depositKeys (~6589 tok)
- `testDPCU.ts` — Declares event (~5459 tok)
- `testFees.ts` — Declares code (~14105 tok)
- `testFirstDeposit.ts` — Declares normally (~2849 tok)
- `testFrozenOrder.ts` — Declares orderKeys (~2632 tok)
- `testFundingFees.ts` — Declares positionKeys (~10410 tok)
- `testGasEstimation.ts` — Declares depositGasLimitKey (~3990 tok)
- `testGlv.ts` — Declares glvSolGMBalanceBefore (~4059 tok)
- `testHomogenousMarkets.ts` (~1278 tok)
- `testImpactDistribution.ts` — Declares positionKey1 (~4164 tok)
- `testLifeCycle.ts` — Declares referralCode0 (~18533 tok)
- `testLimitIncrease.ts` — Declares initialUSDCBalance (~2111 tok)
- `testLiquidation.ts` — Declares initialUSDCBalance (~8845 tok)
- `testMarketDecrease.ts` — Declares initialUSDCBalance (~12393 tok)
- `testMarketIncrease.ts` — Declares initialUSDTBalance (~5128 tok)
- `testMarketSwap.ts` (~3417 tok)
- `testOIReserve.ts` — Declares oiReserveKey (~2810 tok)
- `testPositionUtils.ts` — Declares sol (~2822 tok)
- `testPriceImpact.ts` — Declares positionKeys (~3603 tok)
- `testProtocolGoverner.ts` — Declares accountList (~5050 tok)
- `testScenarios.ts` — Declares collateralAmount (~3155 tok)
- `testSpotOnly.ts` (~1124 tok)
- `testStopLoss.ts` — Declares initialUSDCBalance (~2508 tok)
- `testSwap.ts` — Declares block1 (~5280 tok)
- `testUpdateOrder.ts` — Declares orderKeys (~4753 tok)
- `testWithdrawal.ts` — Declares wntBalAfterWithdraw1 (~1885 tok)

## test/market/

- `MarketStoreUtils.ts` — Declares sampleItem (~884 tok)
- `MarketUtils.ts` — Declares marketUtilsTest (~3137 tok)

## test/migration/

- `GlpMigrator.ts` — Declares getRedemptionInfo (~3377 tok)

## test/multichain/

- `LayerZeroProvider.ts` — Declares wntAmount (~9602 tok)
- `MultichainClaimsRouter.ts` — Declares feeAmount (~7657 tok)
- `MultichainGlvRouter.ts` — Declares wntAmount (~9752 tok)
- `MultichainGmRouter.ts` — Declares wntAmount (~12900 tok)
- `MultichainLifeCycle.ts` — Declares wntAmount (~6403 tok)
- `MultichainOrderRouter.ts` — Declares referralCode (~12501 tok)
- `MultichainReader.ts` — eid1: getUint, getUint, getUint, balanceOf, totalSupply (~2644 tok)
- `MultichainSubaccountRouter.ts` — Declares BAD_SIGNATURE (~14607 tok)
- `MultichainTransferRouter.ts` — Declares amount (~6350 tok)

## test/oracle/

- `ChainlinkDataStreamProvider.ts` — encodeReport: getOraclePrice (~730 tok)
- `EdgeDataStreamProvider.ts` — Edge (Chaos Labs) deploy scripts removed for Nivo; contract tests skipped unless Edge is deployed manually. (~1569 tok)
- `EdgeDataStreamVerifier.ts` — Edge (Chaos Labs) deploy scripts removed for Nivo; contract tests skipped unless Edge is deployed manually. (~1051 tok)
- `Oracle.ts` — Declares fixture (~861 tok)

## test/order/

- `OrderStoreUtils.ts` (~563 tok)

## test/position/

- `Hedge.ts` — highPrices: setMarketState, getPositionInfo, getLongExposure (~5203 tok)
- `PositionStoreUtils.ts` (~477 tok)

## test/pricing/

- `PricingUtils.ts` — Declares pricingUtilsTest (~727 tok)

## test/reader/

- `ReaderPendingImpactAmount.ts` — Declares params (~966 tok)

## test/router/

- `ExchangeRouter.ts` — Declares executionFee (~3508 tok)
- `SubaccountRouter.ts` — Declares subaccount (~7632 tok)

## test/router/relay/

- `GelatoRelayRouter.ts` — Declares INVALID_SIGNATURE (~17419 tok)
- `signatures.ts` — Declares BAD_SIGNATURE (~1061 tok)
- `SubaccountGelatoRelayRouter.ts` — Declares INVALID_SIGNATURE (~15492 tok)

## test/scenes/

- `decreasePosition.ts` — Exports decreasePosition (~1649 tok)
- `deposit.ts` — Exports deposit (~112 tok)
- `increasePosition.ts` — Exports increasePosition (~701 tok)
- `index.ts` — Exports scenes (~65 tok)

## test/shift/

- `ShiftStoreUtils.ts` (~453 tok)

## test/utils/

- `Array.ts` — Declares median (~163 tok)
- `AssemblyReturn.ts` (~274 tok)
- `Calc.ts` — Declares result (~179 tok)

## test/withdrawal/

- `WithdrawalStoreUtils.ts` (~511 tok)

## utils/

- `account.ts` — Exports createAccount (~37 tok)
- `adl.ts` — Exports getIsAdlEnabled, getLatestAdlBlock, updateAdlState, executeAdl (~912 tok)
- `batch.ts` — Exports handleInBatches (~162 tok)
- `collateral.ts` — Exports getClaimableCollateralTimeKey (~45 tok)
- `config.ts` — Exports EXCLUDED_CONFIG_KEYS, appendUintConfigIfDifferent, appendIntConfigIfDifferent, appendAddressConfigIfDifferent + 3 more (~2192 tok)
- `configSyncer.ts` — Exports parametersList, maxPnlFactorForTradersLongs, getDataForKey (~827 tok)
- `constants.ts` — Exports SECONDS_PER_HOUR, SECONDS_PER_DAY, SECONDS_PER_YEAR (~42 tok)
- `contributorHandler.ts` — Exports daysInSeconds, increaseBlockTimestamp (~125 tok)
- `dataStore.ts` — Exports setUintIfDifferent, setIntIfDifferent, setAddressIfDifferent, setBytes32IfDifferent, setBoolIfDifferent (~619 tok)
- `dependencies.ts` — Exports DependencyMap, parseDeployments, normalizeDependencies, collectDependents (~672 tok)
- `deploy.ts` — Exports deployContract, contractAt, createDeployFunction, skipHandlerFunction (~1566 tok)
- `deposit.ts` — Exports getDepositCount, getDepositKeys, getAccountDepositCount, getAccountDepositKeys + 3 more (~1643 tok)
- `error.ts` — Exports errorsInterface, errorsContract, getErrorString, PANIC_SIGNATURE4 + 4 more (~848 tok)
- `event.ts` — Exports parseLogs, getEventData, getEventDataArray, getEventDataValue, getEventDataFromLog (~698 tok)
- `exchange.ts` — Exports getExecuteParams, executeWithOracleParams (~1416 tok)
- `explorer.ts` — Exports getContractNameFromEtherscan, getContractCreationFromEtherscan, sendExplorerRequest (~781 tok)
- `fee.ts` — Exports getClaimableFeeAmount (~55 tok)
- `feeDistributor.ts` — Exports gmxKey, extendedGmxTrackerKey, dataStoreKey, treasuryKey + 5 more (~506 tok)
- `file.ts` — Exports readJsonFile, writeJsonFile, iterateDirectory, searchDirectory + 2 more (~516 tok)
- `fixture.ts` — Declares setup (~4655 tok)
- `gas.ts` — Exports printGasUsage, logGasUsage, GAS_BUFFER (~363 tok)
- `gov.ts` — Exports TIMELOCK_ADMIN_ROLE, PROPOSER_ROLE, EXECUTOR_ROLE, CANCELLER_ROLE + 2 more (~144 tok)
- `hash.ts` — Exports encodeData, decodeData, hashData, hashString + 2 more (~263 tok)
- `jit.ts` — Exports executeJitOrder (~1154 tok)
- `keys.ts` — Exports WNT, NONCE, FEE_RECEIVER, HOLDING_ADDRESS + 148 more (~13732 tok)
- `liquidation.ts` — Exports executeLiquidation (~516 tok)
- `market.ts` — Exports DEFAULT_MARKET_TYPE, getMarketCount, getMarketKeys, getPoolAmount + 9 more (~1572 tok)
- `math.ts` — Exports MAX_UINT8, MAX_UINT32, MAX_UINT64, PRECISION + 12 more (~1247 tok)
- `multicall.ts` — Exports performMulticall (~223 tok)
- `multichain.ts` — Exports bridgeInTokens, encodeDepositMessage, encodeWithdrawalMessage, encodeGlvDepositMessage + 4 more (~3439 tok)
- `nonce.ts` — Exports getNextKey (~80 tok)
- `oracle-provider.ts` — Exports decodeValidatedPrice (~131 tok)
- `oracle.ts` — Exports TOKEN_ORACLE_TYPES, signPrice, signPrices, getSignerInfo + 10 more (~3176 tok)
- `order.ts` — Exports OrderType, orderTypeNames, DecreasePositionSwapType, getOrderCount + 8 more (~2550 tok)
- `position.ts` — Exports getPositionCount, getPositionKeys, getAccountPositionCount, getAccountPositionKeys + 2 more (~270 tok)
- `prices.ts` — Exports fetchTickerPrices, fetchSignedPrices, getGmxInfraUrl, getSignedPricesUrl + 2 more (~1811 tok)
- `print.ts` — Exports toLoggableObject (~228 tok)
- `realtimeFeed.ts` — Exports RealtimeFeedReport, decodeBlob, fetchRealtimeFeedReport (~1068 tok)
- `role.ts` — Exports grantRole, revokeRole, grantRoleIfNotGranted, revokeRoleIfGranted (~522 tok)
- `shift.ts` — Exports getShiftCount, getShiftKeys, getAccountShiftCount, getAccountShiftKeys + 3 more (~1435 tok)
- `signer.ts` — API routes: GET, POST (2 endpoints) (~963 tok)
- `stats.ts` — Exports getSubgraphUrl, getSubgraphClient (~180 tok)
- `storeUtils.ts` — Exports validateStoreUtils (~2173 tok)
- `subaccount.ts` — Exports getSubaccountsCount, getSubaccounts (~90 tok)
- `swap.ts` — Exports SwapPricingType (~22 tok)
- `test.ts` — https://www.chaijs.com/api/plugins/#method_overwritemethod (~484 tok)
- `time.ts` — Exports increaseTime (~94 tok)
- `timelock.ts` — Exports timelockWriteMulticall, cancelAction, cancelActionById, executeTimelock + 14 more (~2327 tok)
- `token.ts` — Exports getBalanceOf, getSupplyOf, getSyntheticTokenAddress, expectTokenBalanceIncrease (~272 tok)
- `use.ts` — Exports usingResult (~30 tok)
- `validation.ts` — Exports expectWithinRange, expectBalances, expectBalance, expectCancellationReason (~833 tok)
- `withdrawal.ts` — Exports getWithdrawalCount, getWithdrawalKeys, getAccountWithdrawalCount, getAccountWithdrawalKeys + 4 more (~2098 tok)

## utils/glv/

- `glvDeposit.ts` — Exports getGlvDepositKeys, getGlvDepositCount, getAccountGlvDepositCount, getAccountGlvDepositKeys + 5 more (~2832 tok)
- `glvShift.ts` — Exports createGlvShift, executeGlvShift, getGlvShiftKeys, getGlvShiftCount, handleGlvShift (~1179 tok)
- `glvWithdrawal.ts` — Exports getGlvWithdrawalKeys, getGlvWithdrawalCount, getAccountGlvWithdrawalCount, getAccountGlvWithdrawalKeys + 5 more (~2502 tok)
- `index.ts` — Exports DEFAULT_GLV_TYPE, getGlvAddress, getGlvKeys, getGlvCount + 3 more (~611 tok)

## utils/relay/

- `addresses.ts` — Exports GELATO_RELAY_ADDRESS (~24 tok)
- `gelatoRelay.ts` — Exports getSendCreateOrderCalldata, sendCreateOrder, sendUpdateOrder, sendCancelOrder + 3 more (~2671 tok)
- `helpers.ts` — Exports SubaccountApproval, ExternalCalls, TokenPermit, OracleParams + 12 more (~2074 tok)
- `multichain.ts` — Exports sendCreateDeposit, sendCreateWithdrawal, sendCreateShift, sendCreateGlvDeposit + 6 more (~7630 tok)
- `signatures.ts` — Exports getCreateOrderSignature, getBatchSignature, getUpdateOrderSignature, getCancelOrderSignature + 5 more (~3606 tok)
- `subaccountGelatoRelay.ts` — Exports sendCreateOrder, sendUpdateOrder, getEmptySubaccountApproval, getSubaccountApproval + 3 more (~4043 tok)
- `tokenPermit.ts` — Exports getTokenPermit (~392 tok)

## verification/

- `glv.js` — npx hardhat --network arbitrumSepolia verify --constructor-args ./verification/glv.js --contract contracts/glv/GlvToken.sol:GlvToken 0xAb3567e55c20... (~116 tok)
- `market.js` — ARBISCAN_API_KEY=<api key> npx hardhat --network arbitrumSepolia verify --constructor-args ./verification/market.js --contract contracts/market/Mar... (~96 tok)

## verification/gov/

- `configTimelockController.js` — npx hardhat verify --network arbitrumSepolia --constructor-args ./verification/gov/configTimelockController.js --contract contracts/config/ConfigTi... (~169 tok)
- `govTimelockController.js` — npx hardhat verify --network arbitrumSepolia --constructor-args ./verification/gov/govTimelockController.js --contract contracts/gov/GovTimelockCon... (~126 tok)

## verification/mock/

- `mockGovernorArgs.js` (~32 tok)
- `mockGovTokenArgs.js` (~14 tok)
- `mockTimelockControllerArgs.js` (~34 tok)

## verification/multichain/

- `multichainClaimsRouter.js` — a custom argument file may be needed for complex arguments (~310 tok)
- `multichainGlvRouter.js` — Verification arguments for MultichainGlvRouter (~332 tok)
- `multichainGmRouter.js` — Verification arguments for MultichainGmRouter (~385 tok)
- `multichainOrderRouter.js` — Verification arguments for MultichainOrderRouter (~296 tok)
- `multichainSubaccountRouter.js` — Verification arguments for MultichainSubaccountRouter (~282 tok)
- `multichainTransferRouter.js` — Verification arguments for MultichainTransferRouter (~280 tok)

## verification/sources/

- `MockPriceFeed.json` — setAnswer: latestAnswer, latestRoundData, latestRoundData (~543 tok)
- `SubaccountRouter.json` — \n * @dev Contract module that helps prevent reentrant calls to a function.\n *\n * Inheriting from `ReentrancyGuard` will make the {nonReentrant} ... (~249252 tok)
