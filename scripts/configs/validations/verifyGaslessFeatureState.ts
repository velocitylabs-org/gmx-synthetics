import { runConfigScript } from "../configRuntime";
import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { verifyFeatureFlagStates } from "./verifyFeatureFlagStates";

export async function runVerifyGaslessFeatureState() {
  await verifyFeatureFlagStates([FEATURE_FLAG_SPECS.GASLESS_FEATURE_DISABLED]);
}

if (require.main === module) {
  runConfigScript(runVerifyGaslessFeatureState);
}
