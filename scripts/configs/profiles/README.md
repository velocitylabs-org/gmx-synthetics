# Feature Sets

A feature set is a named collection of `RUN_*_FEATURE` toggles that tells the
config orchestrator (`scripts/configs/index.ts`) which workstreams to run.

## How the orchestrator consumes a feature set

The orchestrator reads `process.env.FEATURES`, looks it up in the registry
(`scripts/configs/profiles/index.ts`), and uses the resulting object instead
of individual `RUN_*` env vars. If `FEATURES` is missing or unknown, the
orchestrator exits with code 1 and lists available names.

## Adding a feature set

1. Create `scripts/configs/profiles/<name>.ts`:

   ```typescript
   import { Profile } from "./types";

   export const myProfile: Profile = {
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

   Every key in `Profile` is required — the TypeScript compiler will reject
   a partial object.

2. Register it in `scripts/configs/profiles/index.ts`:

   ```typescript
   import { myProfile } from "./my-name";

   export const PROFILES: Record<string, Profile> = {
     all: allProfile,
     "my-name": myProfile,  // ← add here
   };
   ```

3. Use it in an npm script:

   ```
   FEATURES=my-name WRITE=false npx hardhat run scripts/configs/index.ts --network anvil
   ```

## What feature sets must NOT contain

`WRITE`, `IS_DISABLED`, and `TARGET_DISABLED_STATE` are intentionally absent
from the `Profile` type. They are safety-critical flags and must remain
visible on the npm-script command line.

## Existing feature sets

| Name | Description |
|---|---|
| `all` | Full redaction run — all feature setters and post-redaction verification enabled. |

## The `feature-validation.env` file

`feature-validation.env` is a legacy `.env`-format file consumed by
`run-feature-validation.sh` (SCRUM-303). Its `RUN_*` flags map directly to
the `Profile` type — it can be expressed as a TypeScript feature set without
any changes to the mechanism.
