import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { makeSetFeatureFlagRunner } from "../helpers/applyFeatureFlagWrites";
import { runConfigScript } from "../configRuntime";

export const runSetJitFeatureState = makeSetFeatureFlagRunner(FEATURE_FLAG_SPECS.JIT_FEATURE_DISABLED);

if (require.main === module) {
  runConfigScript(runSetJitFeatureState);
}
