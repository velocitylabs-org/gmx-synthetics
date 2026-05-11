import hre from "hardhat";

import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { applyFeatureFlagWrites } from "../helpers/applyFeatureFlagWrites";

export async function runSetAtomicWithdrawalFeatureState() {
  await applyFeatureFlagWrites(hre, [FEATURE_FLAG_SPECS.EXECUTE_ATOMIC_WITHDRAWAL_FEATURE_DISABLED]);
}

async function main() {
  await runSetAtomicWithdrawalFeatureState();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((ex) => {
      console.error(ex);
      process.exit(1);
    });
}
