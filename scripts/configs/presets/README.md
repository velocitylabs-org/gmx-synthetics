# Feature Presets

A feature preset is a named collection of `RUN_*_FEATURE` toggles that tells the
config orchestrator (`scripts/configs/index.ts`) which workstreams to run.

## How the orchestrator consumes a preset

The orchestrator reads `process.env.FEATURES`, looks it up in the registry
(`scripts/configs/presets/index.ts`), and uses the resulting object instead
of individual `RUN_*` env vars. If `FEATURES` is missing or unknown, the
orchestrator exits with code 1 and lists available names.

## Adding a preset

1. Create `scripts/configs/presets/<name>.ts`:

   ```typescript
   import { FeatureFlags } from "./types";

   export const myPreset: FeatureFlags = {
     RUN_ORDER_FEATURE_REDACTION: false,
     RUN_POOL_RISK_GUARDS: false,
     RUN_INVARIANT_VALIDATIONS: false,
     RUN_SHIFT_FEATURES: false,
     RUN_JIT_FEATURE: false,
     RUN_SUBACCOUNT_FEATURE: false,
     RUN_GASLESS_FEATURE: false,
     RUN_ATOMIC_WITHDRAWAL_FEATURE: false,
     RUN_FEATURE_VALIDATIONS: true,
   };
   ```

   Every key in `FeatureFlags` is required — the TypeScript compiler will reject
   a partial object.

2. Register it in `scripts/configs/presets/index.ts`:

   ```typescript
   import { myPreset } from "./my-name";

   export const PRESET: Record<string, FeatureFlags> = {
     default: defaultPreset,
     "my-name": myPreset,  // ← add here
   };
   ```

3. Use it in an npm script:

   ```
   FEATURES=my-name WRITE=false npx hardhat run scripts/configs/index.ts --network anvil
   ```

## What presets must NOT contain

`WRITE`, `IS_DISABLED`, and `TARGET_DISABLED_STATE` are intentionally absent
from the `FeatureFlags` type. They are safety-critical flags and must remain
visible on the npm-script command line.

## Existing presets

| Name | Description |
|---|---|
| `default` | Standard run — all feature setters and post-redaction verification enabled. |
| `validate` | Validation-only run — all feature setters disabled, post-redaction verification enabled. Used by `run-feature-validation.sh`. |
