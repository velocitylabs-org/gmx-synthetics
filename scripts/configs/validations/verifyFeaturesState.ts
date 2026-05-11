import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { verifyFeatureFlagStates } from "./verifyFeatureFlagStates";

export async function runVerifyFeaturesState() {
  await verifyFeatureFlagStates([
    FEATURE_FLAG_SPECS.CREATE_SHIFT_FEATURE_DISABLED,
    FEATURE_FLAG_SPECS.CANCEL_SHIFT_FEATURE_DISABLED,
    FEATURE_FLAG_SPECS.EXECUTE_SHIFT_FEATURE_DISABLED,
    FEATURE_FLAG_SPECS.EXECUTE_ATOMIC_WITHDRAWAL_FEATURE_DISABLED,
    FEATURE_FLAG_SPECS.JIT_FEATURE_DISABLED,
    FEATURE_FLAG_SPECS.SUBACCOUNT_FEATURE_DISABLED,
    FEATURE_FLAG_SPECS.GASLESS_FEATURE_DISABLED,
  ]);
}

async function main() {
  await runVerifyFeaturesState();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((ex) => {
      console.error(ex);
      process.exit(1);
    });
}
