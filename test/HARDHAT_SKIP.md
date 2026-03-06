# Hardhat test suites skipped (pre–Phase 1)

These suites use `describe.skip` because they target deprecated/removed contracts or features that are not part of the remaining protocol. They remain in the repo for reference and can be re-enabled or migrated to Foundry later.

## Skipped suites

| Area | Files / suites | Reason |
|------|----------------|--------|
| **Claim** | `claim/ClaimHandler.ts` | Claim flow deprecated / not in remaining protocol |
| **Config** | `config/ConfigSyncer.ts` | Config syncer deprecated |
| **Fee** | `fee/FeeDistributor.ts`, `fee/FeeHandler.ts` | Fee distributor / handler deprecated |
| **Gov** | `gov/ProtocolGovenor.ts`, `gov/GovTimelockController.ts`, `gov/GovToken.ts` | Gov / timelock / token not in scope |
| **Guardian** | All `guardian/test*.ts` | Guardian integration suite deprecated |
| **Migration** | `migration/GlpMigrator.ts` | One-time migration, not in scope |
| **Multichain** | All `multichain/*.ts` | Multichain routers / LayerZero not in remaining protocol |
| **Reader** | `reader/ReaderPendingImpactAmount.ts` | Pending impact reader deprecated |
| **Router** | `router/SubaccountRouter.ts`, `router/relay/*.ts` | Subaccount + Gelato relay deprecated |
| **Oracle** | `oracle/EdgeDataStreamProvider.ts`, `oracle/EdgeDataStreamVerifier.ts`, `oracle/ChainlinkDataStreamProvider.ts` | Data-stream providers deprecated |
| **Contributor** | `contributor/ContributorHandler.ts` | Contributor handler deprecated |

## Suites that still run (remaining protocol)

- **Config:** `config/Config.ts`, `config/Timelock.ts`
- **Exchange:** All `exchange/*` (deposit, withdrawal, order, fees, etc.)
- **StoreUtils / readers:** `deposit/DepositStoreUtils.ts`, `withdrawal/WithdrawalStoreUtils.ts`, `order/OrderStoreUtils.ts`, `position/PositionStoreUtils.ts`, `shift/ShiftStoreUtils.ts`, `market/*`, `pricing/*`
- **GLV:** All `glv/*`
- **Router:** `router/ExchangeRouter.ts`
- **Oracle:** `oracle/Oracle.ts`
- **Scenes, gas, event, utils:** `scenes/*`, `gas/*`, `event/*`, `utils/*`

Run Hardhat tests: `npm test` (or `npx hardhat test`).

Before Phase 1 (Foundry migration), re-enable or migrate skipped suites as needed.
