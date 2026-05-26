import { runConfigScript } from "../configRuntime";
import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { verifyFeatureFlagStates } from "./verifyFeatureFlagStates";

export async function runVerifyJitFeatureState() {
  await verifyFeatureFlagStates([FEATURE_FLAG_SPECS.JIT_FEATURE_DISABLED]);
}

if (require.main === module) {
  runConfigScript(runVerifyJitFeatureState);
}
