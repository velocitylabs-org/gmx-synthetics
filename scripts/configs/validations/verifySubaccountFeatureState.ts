import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { makeVerifyFeatureFlagRunner } from "./verifyFeatureFlagStates";
import { runConfigScript } from "../configRuntime";

export const runVerifySubaccountFeatureState = makeVerifyFeatureFlagRunner(
  FEATURE_FLAG_SPECS.SUBACCOUNT_FEATURE_DISABLED
);

if (require.main === module) {
  runConfigScript(runVerifySubaccountFeatureState);
}
