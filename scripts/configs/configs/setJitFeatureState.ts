import hre from "hardhat";

import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { applyFeatureFlagWrites } from "../helpers/applyFeatureFlagWrites";
import { runConfigScript } from "../configRuntime";

export async function runSetJitFeatureState() {
  await applyFeatureFlagWrites(hre, [FEATURE_FLAG_SPECS.JIT_FEATURE_DISABLED]);
}

if (require.main === module) {
  runConfigScript(runSetJitFeatureState);
}
