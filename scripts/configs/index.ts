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

  if (preset.RUN_ORDER_FEATURE_REDACTION) {
    await runDisableOrderCreateFeatures();
    await runDisableOrderExecuteFeatures();
  }

  if (preset.RUN_POOL_RISK_GUARDS) {
    await runApplyPoolRiskGuards();
  }

  if (preset.RUN_INVARIANT_VALIDATIONS) {
    await runInvariantChecks();
  }

  if (preset.RUN_SHIFT_FEATURES) {
    await runSetShiftFeaturesState();
  }

  if (preset.RUN_JIT_FEATURE) {
    await runSetJitFeatureState();
  }

  if (preset.RUN_SUBACCOUNT_FEATURE) {
    await runSetSubaccountFeatureState();
  }

  if (preset.RUN_GASLESS_FEATURE) {
    await runSetGaslessFeatureState();
  }

  if (preset.RUN_ATOMIC_WITHDRAWAL_FEATURE) {
    await runSetAtomicWithdrawalFeatureState();
  }

  if (preset.RUN_FEATURE_VALIDATIONS) {
    await runVerifyFeaturesState();
  }

  if (Object.values(preset).every((v) => !v)) {
    console.log("No workstreams selected. Check the active preset's feature flags.");
  }

  console.log("Completed config orchestrator.");
}

if (require.main === module) {
  runConfigScript(main);
}
