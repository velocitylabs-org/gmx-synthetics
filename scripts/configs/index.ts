import { runDisableOrderCreateFeatures } from "./configs/disableOrderCreateFeatures";
import { runDisableOrderExecuteFeatures } from "./configs/disableOrderExecuteFeatures";
import { runApplyPoolRiskGuards } from "./configs/applyPoolRiskGuards";
import { runSetShiftFeaturesState } from "./configs/setShiftFeaturesState";
import { runSetJitFeatureState } from "./configs/setJitFeatureState";
import { runSetSubaccountFeatureState } from "./configs/setSubaccountFeatureState";
import { runSetGaslessFeatureState } from "./configs/setGaslessFeatureState";
import { runSetAtomicWithdrawalFeatureState } from "./configs/setAtomicWithdrawalFeatureState";
import { runInvariantChecks } from "./validations/runInvariantChecks";
import { runVerifyFeaturesState } from "./validations/verifyFeaturesState";
import { loadProfile } from "./profiles";

async function main() {
  console.log("Running config orchestrator...");

  const profile = loadProfile(process.env.FEATURES);

  const runOrderFeatureRedaction = profile.RUN_ORDER_FEATURE_REDACTION;
  const runPoolRiskGuards = profile.RUN_POOL_RISK_GUARDS;
  const runInvariantValidations = profile.RUN_INVARIANT_VALIDATIONS;
  const runShiftFeatures = profile.RUN_SHIFT_FEATURES;
  const runJitFeature = profile.RUN_JIT_FEATURE;
  const runSubaccountFeature = profile.RUN_SUBACCOUNT_FEATURE;
  const runGaslessFeature = profile.RUN_GASLESS_FEATURE;
  const runAtomicWithdrawalFeature = profile.RUN_ATOMIC_WITHDRAWAL_FEATURE;
  const runFeatureValidations = profile.RUN_FEATURE_VALIDATIONS;

  if (runOrderFeatureRedaction) {
    await runDisableOrderCreateFeatures();
    await runDisableOrderExecuteFeatures();
  }

  if (runPoolRiskGuards) {
    await runApplyPoolRiskGuards();
  }

  if (runInvariantValidations) {
    await runInvariantChecks();
  }

  if (runShiftFeatures) {
    await runSetShiftFeaturesState();
  }

  if (runJitFeature) {
    await runSetJitFeatureState();
  }

  if (runSubaccountFeature) {
    await runSetSubaccountFeatureState();
  }

  if (runGaslessFeature) {
    await runSetGaslessFeatureState();
  }

  if (runAtomicWithdrawalFeature) {
    await runSetAtomicWithdrawalFeatureState();
  }

  if (runFeatureValidations) {
    await runVerifyFeaturesState();
  }

  if (
    !runOrderFeatureRedaction &&
    !runPoolRiskGuards &&
    !runInvariantValidations &&
    !runShiftFeatures &&
    !runJitFeature &&
    !runSubaccountFeature &&
    !runGaslessFeature &&
    !runAtomicWithdrawalFeature &&
    !runFeatureValidations
  ) {
    console.log("No workstreams selected. Check the active profile's feature flags.");
  }

  console.log("Completed config orchestrator.");
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((ex) => {
      console.error(ex);
      process.exit(1);
    });
}
