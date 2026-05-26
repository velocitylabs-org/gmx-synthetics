import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { makeSetFeatureFlagRunner } from "../helpers/applyFeatureFlagWrites";
import { runConfigScript } from "../configRuntime";

export const runSetAtomicWithdrawalFeatureState = makeSetFeatureFlagRunner(
  FEATURE_FLAG_SPECS.EXECUTE_ATOMIC_WITHDRAWAL_FEATURE_DISABLED
);

if (require.main === module) {
  runConfigScript(runSetAtomicWithdrawalFeatureState);
}
