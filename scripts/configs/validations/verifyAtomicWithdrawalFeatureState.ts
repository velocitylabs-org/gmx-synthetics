import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { makeVerifyFeatureFlagRunner } from "./verifyFeatureFlagStates";
import { runConfigScript } from "../configRuntime";

export const runVerifyAtomicWithdrawalFeatureState = makeVerifyFeatureFlagRunner(
  FEATURE_FLAG_SPECS.EXECUTE_ATOMIC_WITHDRAWAL_FEATURE_DISABLED
);

if (require.main === module) {
  runConfigScript(runVerifyAtomicWithdrawalFeatureState);
}
