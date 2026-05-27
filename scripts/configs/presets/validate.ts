import { FeatureFlags } from "./types";

/**
 * The ENV Vars Preset for when we want to run the Contract Redaction Validations.
 * Only `RUN_FEATURE_VALIDATIONS` is set to true.
 */
export const validatePreset: FeatureFlags = {
  // We only want to run the validations
  RUN_FEATURE_VALIDATIONS: true,

  // The rest is false
  RUN_ORDER_FEATURE_REDACTION: false,
  RUN_POOL_RISK_GUARDS: false,
  RUN_INVARIANT_VALIDATIONS: false,
  RUN_SHIFT_FEATURES: false,
  RUN_JIT_FEATURE: false,
  RUN_SUBACCOUNT_FEATURE: false,
  RUN_GASLESS_FEATURE: false,
  RUN_ATOMIC_WITHDRAWAL_FEATURE: false,
};
