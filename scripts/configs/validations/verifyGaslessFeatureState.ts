import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { verifyFeatureFlagStates } from "./verifyFeatureFlagStates";

export async function runVerifyGaslessFeatureState() {
  await verifyFeatureFlagStates([FEATURE_FLAG_SPECS.GASLESS_FEATURE_DISABLED]);
}

async function main() {
  await runVerifyGaslessFeatureState();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((ex) => {
      console.error(ex);
      process.exit(1);
    });
}
