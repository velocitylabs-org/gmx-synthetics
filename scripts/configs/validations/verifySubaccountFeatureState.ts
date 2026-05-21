import { FEATURE_FLAG_SPECS } from "../helpers/featureFlagSpecs";
import { verifyFeatureFlagStates } from "./verifyFeatureFlagStates";

export async function runVerifySubaccountFeatureState() {
  await verifyFeatureFlagStates([FEATURE_FLAG_SPECS.SUBACCOUNT_FEATURE_DISABLED]);
}

async function main() {
  await runVerifySubaccountFeatureState();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((ex) => {
      console.error(ex);
      process.exit(1);
    });
}
