import * as keys from "../../../utils/keys";
import { runConfigScript } from "../configRuntime";
import { disableOrderFeatures } from "../helpers/disableOrderFeatures";

export async function runDisableOrderExecuteFeatures() {
  await disableOrderFeatures(keys.EXECUTE_ORDER_FEATURE_DISABLED, "EXECUTE_ORDER_FEATURE_DISABLED", "execute-order");
}

if (require.main === module) {
  runConfigScript(runDisableOrderExecuteFeatures);
}
