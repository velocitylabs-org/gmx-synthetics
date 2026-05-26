import hre from "hardhat";

import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { applyFeatureFlagWrites } from "../helpers/applyFeatureFlagWrites";
import { runConfigScript } from "../configRuntime";

export async function runSetSubaccountFeatureState() {
  await applyFeatureFlagWrites(hre, [FEATURE_FLAG_SPECS.SUBACCOUNT_FEATURE_DISABLED]);
}

if (require.main === module) {
  runConfigScript(runSetSubaccountFeatureState);
}
