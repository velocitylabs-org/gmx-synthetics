import { Profile } from "./types";

export const redactAllProfile: Profile = {
  RUN_ORDER_FEATURE_REDACTION: true,
  RUN_POOL_RISK_GUARDS: true,
  RUN_INVARIANT_VALIDATIONS: false,
  RUN_SHIFT_FEATURES: true,
  RUN_JIT_FEATURE: true,
  RUN_SUBACCOUNT_FEATURE: true,
  RUN_GASLESS_FEATURE: true,
  RUN_ATOMIC_WITHDRAWAL_FEATURE: true,
  RUN_FEATURE_VALIDATIONS: true,
};
