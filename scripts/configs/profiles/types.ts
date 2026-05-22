export type RunFeatureKey =
  | "RUN_ORDER_FEATURE_REDACTION"
  | "RUN_POOL_RISK_GUARDS"
  | "RUN_INVARIANT_VALIDATIONS"
  | "RUN_SHIFT_FEATURES"
  | "RUN_JIT_FEATURE"
  | "RUN_SUBACCOUNT_FEATURE"
  | "RUN_GASLESS_FEATURE"
  | "RUN_ATOMIC_WITHDRAWAL_FEATURE"
  | "RUN_FEATURE_VALIDATIONS";

// WRITE, IS_DISABLED, and TARGET_DISABLED_STATE are intentionally absent —
// those are safety-critical flags that must stay visible on the npm-script command line.
export type Profile = Record<RunFeatureKey, boolean>;
