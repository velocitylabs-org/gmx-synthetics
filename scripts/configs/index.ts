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
import { loadPreset } from "./presets";
import { runConfigScript } from "./configRuntime";

async function main() {
  console.log("Running config orchestrator...");

  const preset = loadPreset(process.env.FEATURES);

  const runOrderFeatureRedaction = preset.RUN_ORDER_FEATURE_REDACTION;
  const runPoolRiskGuards = preset.RUN_POOL_RISK_GUARDS;
  const runInvariantValidations = preset.RUN_INVARIANT_VALIDATIONS;
  const runShiftFeatures = preset.RUN_SHIFT_FEATURES;
  const runJitFeature = preset.RUN_JIT_FEATURE;
  const runSubaccountFeature = preset.RUN_SUBACCOUNT_FEATURE;
  const runGaslessFeature = preset.RUN_GASLESS_FEATURE;
  const runAtomicWithdrawalFeature = preset.RUN_ATOMIC_WITHDRAWAL_FEATURE;
  const runFeatureValidations = preset.RUN_FEATURE_VALIDATIONS;

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
    console.log("No workstreams selected. Check the active preset's feature flags.");
  }

  console.log("Completed config orchestrator.");
}

if (require.main === module) {
  runConfigScript(main);
}
