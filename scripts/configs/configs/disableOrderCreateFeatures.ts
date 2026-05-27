import * as keys from "../../../utils/keys";
import { runConfigScript } from "../configRuntime";
import { disableOrderFeatures } from "../helpers/disableOrderFeatures";

export async function runDisableOrderCreateFeatures() {
  await disableOrderFeatures(keys.CREATE_ORDER_FEATURE_DISABLED, "CREATE_ORDER_FEATURE_DISABLED", "create-order");
}

if (require.main === module) {
  runConfigScript(runDisableOrderCreateFeatures);
}
