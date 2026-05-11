import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { verifyFeatureFlagStates } from "./verifyFeatureFlagStates";

export async function runVerifyShiftCancelFeatureState() {
  await verifyFeatureFlagStates([FEATURE_FLAG_SPECS.CANCEL_SHIFT_FEATURE_DISABLED]);
}

async function main() {
  await runVerifyShiftCancelFeatureState();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((ex) => {
      console.error(ex);
      process.exit(1);
    });
}
