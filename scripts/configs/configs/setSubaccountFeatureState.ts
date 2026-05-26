import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { makeSetFeatureFlagRunner } from "../helpers/applyFeatureFlagWrites";
import { runConfigScript } from "../configRuntime";

export const runSetSubaccountFeatureState = makeSetFeatureFlagRunner(FEATURE_FLAG_SPECS.SUBACCOUNT_FEATURE_DISABLED);

if (require.main === module) {
  runConfigScript(runSetSubaccountFeatureState);
}
