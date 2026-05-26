import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { makeVerifyFeatureFlagRunner } from "./verifyFeatureFlagStates";
import { runConfigScript } from "../configRuntime";

export const runVerifyShiftCreateFeatureState = makeVerifyFeatureFlagRunner(
  FEATURE_FLAG_SPECS.CREATE_SHIFT_FEATURE_DISABLED
);

if (require.main === module) {
  runConfigScript(runVerifyShiftCreateFeatureState);
}
