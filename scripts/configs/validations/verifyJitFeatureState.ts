import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { makeVerifyFeatureFlagRunner } from "./verifyFeatureFlagStates";
import { runConfigScript } from "../configRuntime";

export const runVerifyJitFeatureState = makeVerifyFeatureFlagRunner(FEATURE_FLAG_SPECS.JIT_FEATURE_DISABLED);

if (require.main === module) {
  runConfigScript(runVerifyJitFeatureState);
}
