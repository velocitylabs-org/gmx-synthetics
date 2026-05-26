import { runConfigScript } from "../configRuntime";
import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { verifyFeatureFlagStates } from "./verifyFeatureFlagStates";

export async function runVerifySubaccountFeatureState() {
  await verifyFeatureFlagStates([FEATURE_FLAG_SPECS.SUBACCOUNT_FEATURE_DISABLED]);
}

if (require.main === module) {
  runConfigScript(runVerifySubaccountFeatureState);
}
