import hre from "hardhat";

import { SHIFT_FEATURE_SPECS } from "../helpers/featureFlagSpecs";
import { applyFeatureFlagWrites } from "../helpers/applyFeatureFlagWrites";
import { runConfigScript } from "../configRuntime";

export async function runSetShiftFeaturesState() {
  await applyFeatureFlagWrites(hre, SHIFT_FEATURE_SPECS);
}

if (require.main === module) {
  runConfigScript(runSetShiftFeaturesState);
}
