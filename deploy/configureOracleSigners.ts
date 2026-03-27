import { ethers } from "ethers";
import * as keys from "../utils/keys";
import { setUintIfDifferent } from "../utils/dataStore";
import { hashString } from "../utils/hash";

const func = async ({ deployments, getNamedAccounts, gmx }: any) => {
  const { read, execute, log, get } = deployments;
  const { deployer } = await getNamedAccounts();
  const controllerRoleHash = hashString("CONTROLLER");

  // `OracleStore.addSigner/removeSigner` are guarded by `onlyController` (RoleStore.CONTROLLER).
  // On existing mainnet deployments, role auto-configuration might be skipped, so ensure
  // the deployer can perform the signer updates.
  const deployerHasControllerRole = await read("RoleStore", "hasRole", deployer, controllerRoleHash);
  if (!deployerHasControllerRole) {
    log("deployer %s missing CONTROLLER role, granting it via RoleStore...", deployer);
    await execute("RoleStore", { from: deployer, log: true }, "grantRole", deployer, controllerRoleHash);
  }

  // OracleStore emits events through EventEmitter, whose emit functions are onlyController.
  // This means OracleStore contract address itself must also have CONTROLLER role.
  const oracleStore = await get("OracleStore");
  const oracleStoreHasControllerRole = await read("RoleStore", "hasRole", oracleStore.address, controllerRoleHash);
  if (!oracleStoreHasControllerRole) {
    log("OracleStore %s missing CONTROLLER role, granting it via RoleStore...", oracleStore.address);
    await execute("RoleStore", { from: deployer, log: true }, "grantRole", oracleStore.address, controllerRoleHash);
  }

  const oracleConfig = await gmx.getOracle();
  const oracleSigners = oracleConfig.signers.map((s) => ethers.utils.getAddress(s));

  const existingSignersCount = await read("OracleStore", "getSignerCount");
  const existingSigners = await read("OracleStore", "getSigners", 0, existingSignersCount);
  log("existing signers", existingSigners.join(","));

  for (const oracleSigner of oracleSigners) {
    if (!existingSigners.includes(oracleSigner)) {
      log("adding oracle signer", oracleSigner);
      await execute("OracleStore", { from: deployer, log: true }, "addSigner", oracleSigner);
    }
  }

  for (const existingSigner of existingSigners) {
    if (!oracleSigners.includes(existingSigner)) {
      log("removing oracle signer", existingSigner);
      await execute("OracleStore", { from: deployer, log: true }, "removeSigner", existingSigner);
    }
  }

  await setUintIfDifferent(keys.MIN_ORACLE_SIGNERS, oracleConfig.minOracleSigners, "min oracle signers");
};
func.tags = ["OracleSigners"];
func.dependencies = ["RoleStore", "OracleStore", "DataStore"];
export default func;
