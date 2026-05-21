import hre from "hardhat";

import { SHIFT_FEATURE_SPECS } from "../helpers/featureFlagSpecs";
import { applyFeatureFlagWrites } from "../helpers/applyFeatureFlagWrites";

export async function runSetShiftFeaturesState() {
  await applyFeatureFlagWrites(hre, SHIFT_FEATURE_SPECS);
}

async function main() {
  await runSetShiftFeaturesState();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((ex) => {
      console.error(ex);
      process.exit(1);
    });
}
