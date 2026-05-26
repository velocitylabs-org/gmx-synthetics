import { runConfigScript } from "../configRuntime";
import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { verifyFeatureFlagStates } from "./verifyFeatureFlagStates";

export async function runVerifyAtomicWithdrawalFeatureState() {
  await verifyFeatureFlagStates([FEATURE_FLAG_SPECS.EXECUTE_ATOMIC_WITHDRAWAL_FEATURE_DISABLED]);
}

if (require.main === module) {
  runConfigScript(runVerifyAtomicWithdrawalFeatureState);
}
