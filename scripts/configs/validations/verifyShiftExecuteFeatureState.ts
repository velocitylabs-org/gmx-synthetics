import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { makeVerifyFeatureFlagRunner } from "./verifyFeatureFlagStates";
import { runConfigScript } from "../configRuntime";

export const runVerifyShiftExecuteFeatureState = makeVerifyFeatureFlagRunner(
  FEATURE_FLAG_SPECS.EXECUTE_SHIFT_FEATURE_DISABLED
);

if (require.main === module) {
  runConfigScript(runVerifyShiftExecuteFeatureState);
}
