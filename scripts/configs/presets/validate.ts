import { FeatureFlags } from "./types";

export const validatePreset: FeatureFlags = {
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
