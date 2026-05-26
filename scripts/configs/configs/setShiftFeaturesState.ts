import { SHIFT_FEATURE_SPECS } from "../helpers/featureFlagSpecs";
import { makeSetFeatureFlagRunner } from "../helpers/applyFeatureFlagWrites";
import { runConfigScript } from "../configRuntime";

export const runSetShiftFeaturesState = makeSetFeatureFlagRunner(SHIFT_FEATURE_SPECS);

if (require.main === module) {
  runConfigScript(runSetShiftFeaturesState);
}
