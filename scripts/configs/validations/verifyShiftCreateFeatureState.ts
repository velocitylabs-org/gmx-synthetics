import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { verifyFeatureFlagStates } from "./verifyFeatureFlagStates";

export async function runVerifyShiftCreateFeatureState() {
  await verifyFeatureFlagStates([FEATURE_FLAG_SPECS.CREATE_SHIFT_FEATURE_DISABLED]);
}

async function main() {
  await runVerifyShiftCreateFeatureState();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((ex) => {
      console.error(ex);
      process.exit(1);
    });
}
