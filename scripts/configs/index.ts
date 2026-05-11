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

function envFlag(name: string, defaultValue: boolean) {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return value === "true";
}

async function main() {
  console.log("Running config orchestrator...");

  // Existing workstreams
  const runOrderFeatureRedaction = envFlag("RUN_ORDER_FEATURE_REDACTION", true);
  const runPoolRiskGuards = envFlag("RUN_POOL_RISK_GUARDS", true);
  const runInvariantValidations = envFlag("RUN_INVARIANT_VALIDATIONS", false);

  // New remaining-redaction feature workstreams
  const runShiftFeatures = envFlag("RUN_SHIFT_FEATURES", false);
  const runJitFeature = envFlag("RUN_JIT_FEATURE", false);
  const runSubaccountFeature = envFlag("RUN_SUBACCOUNT_FEATURE", false);
  const runGaslessFeature = envFlag("RUN_GASLESS_FEATURE", false);
  const runAtomicWithdrawalFeature = envFlag("RUN_ATOMIC_WITHDRAWAL_FEATURE", false);
  const runFeatureValidations = envFlag("RUN_FEATURE_VALIDATIONS", false);

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
    console.log("No workstreams selected. Set RUN_* env vars to execute setters or validations.");
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
