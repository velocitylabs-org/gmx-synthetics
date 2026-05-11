import hre from "hardhat";

import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { applyFeatureFlagWrites } from "../helpers/applyFeatureFlagWrites";

export async function runSetGaslessFeatureState() {
  await applyFeatureFlagWrites(hre, [FEATURE_FLAG_SPECS.GASLESS_FEATURE_DISABLED]);
}

async function main() {
  await runSetGaslessFeatureState();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((ex) => {
      console.error(ex);
      process.exit(1);
    });
}
