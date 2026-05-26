import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { makeVerifyFeatureFlagRunner } from "./verifyFeatureFlagStates";
import { runConfigScript } from "../configRuntime";

export const runVerifyShiftCancelFeatureState = makeVerifyFeatureFlagRunner(
  FEATURE_FLAG_SPECS.CANCEL_SHIFT_FEATURE_DISABLED
);

if (require.main === module) {
  runConfigScript(runVerifyShiftCancelFeatureState);
}
