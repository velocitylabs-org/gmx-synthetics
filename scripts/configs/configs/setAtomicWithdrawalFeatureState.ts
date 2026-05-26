import hre from "hardhat";

import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { applyFeatureFlagWrites } from "../helpers/applyFeatureFlagWrites";
import { runConfigScript } from "../configRuntime";

export async function runSetAtomicWithdrawalFeatureState() {
  await applyFeatureFlagWrites(hre, [FEATURE_FLAG_SPECS.EXECUTE_ATOMIC_WITHDRAWAL_FEATURE_DISABLED]);
}

if (require.main === module) {
  runConfigScript(runSetAtomicWithdrawalFeatureState);
}
