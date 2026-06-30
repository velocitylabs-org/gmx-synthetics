# scripts/configs — Feature Flag & Config Management

This folder contains scripts to **enable or disable protocol features** on-chain, **apply pool risk parameters**, and **verify that on-chain state matches what the config files say it should be**. Nothing here modifies Solidity contracts — it only writes values to the `DataStore`.

Features you can control from here:
- **Order creation & Order execution** — disable/enable creating market swap, limit swap, limit increase/decrease, stop-loss orders
- **Gasless relay** — disable/enable gasless transaction flows (Gelato relay routers)
- **JIT execution** — disable/enable just-in-time order execution path
- **Subaccount delegation** — disable/enable subaccount router flows
- **Atomic withdrawals** — disable/enable atomic withdrawal execution
- **Shift operations** — disable/enable shift create, cancel, and execute

Pool risk parameters you can apply:
- Max pool token amounts and max pool USD caps per market
- Minimum market tokens required for first deposit
- Marking inactive markets as disabled

---

## Directory structure

| Path | What it is |
|---|---|
| `index.ts` | The main script. Reads a preset name from `FEATURES` env var and runs whichever modules the preset enables. This is the normal way to run everything. |
| `configRuntime.ts` | Utility functions shared by all scripts: reads `WRITE`, `IS_DISABLED`, `FAIL_ON_MISMATCH` env vars, and wraps scripts in a `process.exit` handler. |
| `configs/` | Scripts that **write** state to the DataStore. |
| `validations/` | Scripts that **read** state from the DataStore and check it against expectations. No writes. |
| `helpers/` | Shared infrastructure used by both `configs/` and `validations/`: spec definitions, the write/verify engines, contract resolution, signer resolution. |
| `presets/` | Named flag bundles. A preset is a TypeScript object that says which modules `index.ts` should run. Add one when you need a new named run mode. |

---

## Scripts that write state (`configs/`)

Each script supports dry-run mode (`WRITE=false`) and write mode (`WRITE=true`). All scripts use `IS_DISABLED` to control the target state: `true` = disable the feature, `false` = re-enable it.

| Script | What it writes |
|---|---|
| `disableOrderCreateFeatures.ts` | Sets `CREATE_ORDER_FEATURE_DISABLED` for MarketSwap, LimitSwap, LimitIncrease, LimitDecrease, StopLossDecrease order types |
| `disableOrderExecuteFeatures.ts` | Sets `EXECUTE_ORDER_FEATURE_DISABLED` for the same order types |
| `setShiftFeaturesState.ts` | Sets `CREATE_SHIFT_FEATURE_DISABLED`, `CANCEL_SHIFT_FEATURE_DISABLED`, `EXECUTE_SHIFT_FEATURE_DISABLED` |
| `setJitFeatureState.ts` | Sets `JIT_FEATURE_DISABLED` for `JitOrderHandler` |
| `setSubaccountFeatureState.ts` | Sets `SUBACCOUNT_FEATURE_DISABLED` for subaccount routers |
| `setGaslessFeatureState.ts` | Sets `GASLESS_FEATURE_DISABLED` for Gelato relay routers |
| `setAtomicWithdrawalFeatureState.ts` | Sets `EXECUTE_ATOMIC_WITHDRAWAL_FEATURE_DISABLED` for `WithdrawalHandler` |
| `applyPoolRiskGuards.ts` | Sets `MAX_POOL_AMOUNT`, `MAX_POOL_USD_FOR_DEPOSIT`, `MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT` for active markets; sets `IS_MARKET_DISABLED` for inactive markets |

---

## Scripts that verify state (`validations/`)

Each script reads from the DataStore and reports mismatches. Pass `FAIL_ON_MISMATCH=true` to make a script exit non-zero on any mismatch (required for CI).

| Script | What it checks |
|---|---|
| `verifyFeaturesState.ts` | All 17 feature flags — checks each one matches `TARGET_DISABLED_STATE` |
| `verifyPoolRiskGuards.ts` | Pool caps and min first deposit — checks DataStore values match `config/markets.ts` |
| `runInvariantChecks.ts` | Runs three sub-checks in sequence: role assignments, same-token market invariants, virtual ID allowlist |
| `printRolesResolved.ts` | Prints every role and its current holder addresses (used inside `runInvariantChecks`) |
| `verifySameTokenInvariants.ts` | Checks that same-token markets have zero swap impact factors and correct disabled state |
| `verifyVirtualIdAllowlist.ts` | Checks that `virtualTokenId` and `virtualMarketId` in DataStore match the values in `config/markets.ts` |

> **Behavioral test (not a script in this folder):**
> [`test/config/DisabledOrderTypesReverts.ts`](../../test/config/DisabledOrderTypesReverts.ts)
> verifies that disabled order types actually revert with `DisabledFeature`
> when create/execute is attempted — a stronger guarantee than the DataStore
> flag check alone. Run with `pnpm hardhat test test/config/DisabledOrderTypesReverts.ts`.

---

## How to run

See [CLAUDE.md](../../CLAUDE.md) for Doppler setup. All mainnet/testnet commands below need `doppler run --` to inject secrets.

**Dry-run everything (no transactions sent)**
```bash
DOPPLER_CONFIG=stg NETWORK=baseSepolia pnpm run config:features:dryrun
DOPPLER_CONFIG=prd NETWORK=base pnpm run config:features:dryrun
```

**Write everything (sends transactions)**
```bash
DOPPLER_CONFIG=stg NETWORK=baseSepolia pnpm run config:features:write
DOPPLER_CONFIG=prd NETWORK=base pnpm run config:features:write
```

**Validate only — check that all feature flags are in the expected state**
```bash
DOPPLER_CONFIG=stg NETWORK=baseSepolia pnpm run config:features:status
DOPPLER_CONFIG=prd NETWORK=base pnpm run config:features:status
```

**Run a single validator directly (useful for spot-checking)**
```bash
DOPPLER_CONFIG=prd doppler run -p nivo -c $DOPPLER_CONFIG -- pnpm hardhat run scripts/configs/validations/verifyPoolRiskGuards.ts --network base
DOPPLER_CONFIG=prd doppler run -p nivo -c $DOPPLER_CONFIG -- pnpm hardhat run scripts/configs/validations/runInvariantChecks.ts --network base
```

**Test on a local fork before mainnet (recommended before any write)**

1. Start the fork:
```bash
pnpm run hardhat:fork
```

2. In a separate terminal, run the config script against it:
```bash
pnpm run config:features:fork
```

This forks Base mainnet (chain ID 8453) locally via Anvil and applies the config change against the fork — showing exactly what would happen on mainnet with zero risk.

---

## Adding a new feature flag

1. Add a new `ManagedFeatureId` string to the union in `helpers/featureFlagSpecs.ts`
2. Add a matching `ManagedFeatureSpec` entry to `FEATURE_FLAG_SPECS` in the same file — set `baseKey`, `scope`, `defaultModuleContractNames`
3. Create `configs/set<Feature>FeatureState.ts` — call `makeSetFeatureFlagRunner(FEATURE_FLAG_SPECS.<your_id>)`
4. Add the new spec to the spec array in `validations/verifyFeaturesState.ts`
5. Add a `RUN_<FEATURE>` key to the `RunFeatureKey` union in `presets/types.ts`
6. Add the key to `presets/default.ts` and `presets/validate.ts` — TypeScript will error if you miss either one
7. Wire the setter in `index.ts`: add the import and a `if (preset.RUN_<FEATURE>)` block

---

## Pre/post-deploy checklist

Before a mainnet config change:
- Run on a fork first (see "Test on a local fork before mainnet" above)
- Run `runInvariantChecks.ts` for role/invariant checks
- Run `test/config/DisabledOrderTypesReverts.ts` if disabled-path behavior is affected

After a mainnet config change:
- Run `config:features:status` to confirm on-chain state matches expectations
- Archive the run (see "Evidence" below)

---

## Rollback

**Order feature redaction:**
- Set `CREATE_ORDER_FEATURE_DISABLED=false` and `EXECUTE_ORDER_FEATURE_DISABLED=false` for the targeted order types (use `config:features:write` with `IS_DISABLED=false`)
- Verify with `config:features:status`

**Pool risk guards:**
- Restore prior values for `MAX_POOL_AMOUNT`, `MAX_POOL_USD_FOR_DEPOSIT`, `MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT`, `IS_MARKET_DISABLED` using the archived evidence from the original change
- Re-run verification and archive a rollback evidence note

---

## Evidence

After every mainnet run, follow [ops/RUNBOOK-FEATURE-CONFIG.md](../../ops/RUNBOOK-FEATURE-CONFIG.md) 
to archive the dry-run, write, and validation output, and document the change.
