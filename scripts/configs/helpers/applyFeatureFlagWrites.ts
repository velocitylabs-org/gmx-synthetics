import type { HardhatRuntimeEnvironment } from "hardhat/types";

import type { ManagedFeatureSpec } from "./featureFlagSpecs";
import { encodeFeatureData, resolveModuleAddress, resolveModuleContractNames } from "./featureFlagSpecs";
import { getDeployedContract } from "./getDeployedContract";
import { getConfigKeeperRoleSigner } from "./getConfigKeeperRoleSigner";

/**
 *
 * Writes Config.setBool entries for the provided feature specs (dry-run unless WRITE=true is specified).
 * TARGET_DISABLED_STATE=true → disable the feature (write true to the DataStore)
 * TARGET_DISABLED_STATE=false → enable the feature (write false to the DataStore)
 */
export async function applyFeatureFlagWrites(hre: HardhatRuntimeEnvironment, specs: ManagedFeatureSpec[]) {
  const config = await getDeployedContract(hre, "Config");
  const write = process.env.WRITE === "true";
  const targetDisabled =
    process.env.TARGET_DISABLED_STATE === undefined || process.env.TARGET_DISABLED_STATE === "true";

  const rows: { label: string; module: string; address: string }[] = [];
  const multicallWriteParams: string[] = [];

  for (const spec of specs) {
    const moduleNames = resolveModuleContractNames(spec);
    for (const moduleName of moduleNames) {
      const moduleAddress = await resolveModuleAddress(hre, moduleName);
      const data = encodeFeatureData(spec, moduleAddress);
      multicallWriteParams.push(config.interface.encodeFunctionData("setBool", [spec.baseKey, data, targetDisabled]));
      rows.push({
        label: spec.label,
        module: moduleName,
        address: moduleAddress,
      });
    }
  }

  const { configKeeperRoleAddress, configKeeperRoleSigner } = await getConfigKeeperRoleSigner(hre);
  const signedConfig = config.connect(configKeeperRoleSigner);

  console.log(`Config keeper role address: ${configKeeperRoleAddress}`);
  console.log(`TARGET_DISABLED_STATE (write ${targetDisabled}): ${targetDisabled}`);
  console.log(`Prepared ${multicallWriteParams.length} config updates`);
  rows.forEach((r) => console.log(`- ${r.label} | ${r.module} (${r.address})`));

  await signedConfig.callStatic.multicall(multicallWriteParams);
  console.log("callStatic passed");

  if (!write) {
    console.log("NOTE: executed in read-only mode, no transactions were sent");
    return;
  }

  const tx = await signedConfig.multicall(multicallWriteParams);
  console.log(`tx sent: ${tx.hash}`);
  await tx.wait();
  console.log("tx mined");
}
