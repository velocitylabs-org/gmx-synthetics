import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { makeSetFeatureFlagRunner } from "../helpers/applyFeatureFlagWrites";
import { runConfigScript } from "../configRuntime";

export const runSetGaslessFeatureState = makeSetFeatureFlagRunner(FEATURE_FLAG_SPECS.GASLESS_FEATURE_DISABLED);

if (require.main === module) {
  runConfigScript(runSetGaslessFeatureState);
}
