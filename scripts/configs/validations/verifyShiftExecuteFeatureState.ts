import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { verifyFeatureFlagStates } from "./verifyFeatureFlagStates";

export async function runVerifyShiftExecuteFeatureState() {
  await verifyFeatureFlagStates([FEATURE_FLAG_SPECS.EXECUTE_SHIFT_FEATURE_DISABLED]);
}

async function main() {
  await runVerifyShiftExecuteFeatureState();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((ex) => {
      console.error(ex);
      process.exit(1);
    });
}
