# Global Test Suite Anomalies (Post Checksum Patch)

## Command
- `pnpm test`

## Result Summary
- Passing: `818`
- Pending: `34`
- Failing: `5`

## Fixed in this pass
- Removed checksum-based impersonation failures by replacing helper-based impersonation/balance calls with RPC-based helpers in multichain/relay suites.
- Removed execution gate from `test/config/DisabledOrderTypesReverts.ts` and validated disabled-order create/execute reverts (`2 passing`).

## Remaining Failures
1. `test/multichain/MultichainSubaccountRouter.ts`
   - `createOrder` -> `execution fee should be capped`
   - expected `9003720880000000`, actual `8989804920000000`
2. `test/multichain/MultichainSubaccountRouter.ts`
   - `updateOrder` -> `execution fee should be capped if increased`
   - expected close to `8058060700000000`, actual `7958017880000000`
3. `test/router/SubaccountRouter.ts`
   - `MarketIncrease order`
   - balance assertion drift in WNT output
4. `test/router/relay/SubaccountGelatoRelayRouter.ts`
   - `createOrder` -> `execution fee should be capped`
   - expected `9003720880000000`, actual `8989804920000000`
5. `test/router/relay/SubaccountGelatoRelayRouter.ts`
   - `updateOrder` -> `execution fee should be capped if increased`
   - expected close to `8039135020000000`, actual `7949457480000000`

## Interpretation
- Remaining failures are not checksum/address-format failures.
- They are assertion-level deltas concentrated in execution-fee capping and one subaccount balance check path.
