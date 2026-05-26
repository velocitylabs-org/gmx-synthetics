import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { makeVerifyFeatureFlagRunner } from "./verifyFeatureFlagStates";
import { runConfigScript } from "../configRuntime";

export const runVerifyGaslessFeatureState = makeVerifyFeatureFlagRunner(FEATURE_FLAG_SPECS.GASLESS_FEATURE_DISABLED);

if (require.main === module) {
  runConfigScript(runVerifyGaslessFeatureState);
}
