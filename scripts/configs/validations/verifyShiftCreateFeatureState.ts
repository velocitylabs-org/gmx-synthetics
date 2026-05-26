import { runConfigScript } from "../configRuntime";
import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { verifyFeatureFlagStates } from "./verifyFeatureFlagStates";

export async function runVerifyShiftCreateFeatureState() {
  await verifyFeatureFlagStates([FEATURE_FLAG_SPECS.CREATE_SHIFT_FEATURE_DISABLED]);
}

if (require.main === module) {
  runConfigScript(runVerifyShiftCreateFeatureState);
}
