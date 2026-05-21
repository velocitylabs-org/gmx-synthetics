import hre from "hardhat";

import type { ManagedFeatureSpec } from "../helpers/featureFlagSpecs";
import { getFeatureFlagStorageKeyForSpec, resolveModuleAddress, resolveModuleContractNames } from "../helpers/featureFlagSpecs";
import { getDeployedContract } from "../helpers/getDeployedContract";

export async function verifyFeatureFlagStates(specs: ManagedFeatureSpec[]) {
  const dataStore = await getDeployedContract(hre, "DataStore");
  const targetDisabled =
    process.env.TARGET_DISABLED_STATE === undefined || process.env.TARGET_DISABLED_STATE === "true";

  const failOnMismatch = process.env.FAIL_ON_MISMATCH === "true";

  const mismatches: string[] = [];

  console.log(`TARGET_DISABLED_STATE (expected bool): ${targetDisabled}`);

  for (const spec of specs) {
    const moduleNames = resolveModuleContractNames(spec);

    for (const moduleName of moduleNames) {
      const moduleAddress = await resolveModuleAddress(hre, moduleName);
      const storageKey = getFeatureFlagStorageKeyForSpec(spec, moduleAddress);
      const actual = await dataStore.getBool(storageKey);

      const orderTypeSuffix = spec.scope === "module_with_order_type" ? ` orderType=${spec.orderType}` : "";
      const line = `${spec.id}${orderTypeSuffix} module=${moduleName} (${moduleAddress}) expected=${targetDisabled} actual=${actual}`;
      console.log(line);

      if (actual !== targetDisabled) {
        mismatches.push(line);
      }
    }
  }

  if (mismatches.length > 0) {
    console.log("\n=== MISMATCHES ===");
    mismatches.forEach((m) => console.log(`- ${m}`));

    if (failOnMismatch) {
      throw new Error(`Feature flag verification failed with ${mismatches.length} mismatches`);
    }
  } else {
    console.log("\nVerification passed: all feature flags matched expected state.");
  }
}
