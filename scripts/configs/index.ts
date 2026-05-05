import { runDisableOrderCreateFeatures } from "./configs/disableOrderCreateFeatures";
import { runDisableOrderExecuteFeatures } from "./configs/disableOrderExecuteFeatures";
import { runApplyPoolRiskGuards } from "./configs/applyPoolRiskGuards";
import { runInvariantChecks } from "./validations/runInvariantChecks";

async function main() {
  console.log("Running config redaction scripts...");

  // Toggle workstreams here for local testing, or control via env vars:
  // RUN_ORDER_FEATURE_REDACTION=true|false RUN_POOL_RISK_GUARDS=true|false RUN_INVARIANT_VALIDATIONS=true|false
  const runOrderFeatureRedaction =
    process.env.RUN_ORDER_FEATURE_REDACTION === undefined ? true : process.env.RUN_ORDER_FEATURE_REDACTION === "true";
  const runPoolRiskGuards =
    process.env.RUN_POOL_RISK_GUARDS === undefined ? true : process.env.RUN_POOL_RISK_GUARDS === "true";
  const runInvariantValidations = process.env.RUN_INVARIANT_VALIDATIONS === "true";

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

  console.log("Completed config redaction scripts.");
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((ex) => {
      console.error(ex);
      process.exit(1);
    });
}
