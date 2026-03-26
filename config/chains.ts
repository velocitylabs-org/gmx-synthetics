import { HardhatRuntimeEnvironment } from "hardhat/types";

export const EXISTING_MAINNET_DEPLOYMENTS = ["arbitrum", "avalanche", "botanix", "base"];

export function isExistingMainnetDeployment(hre: HardhatRuntimeEnvironment) {
  const deployOnFork = process.env.DEPLOY_ON_FORK === "true";
  const rpcUrl = typeof hre.network.config?.url === "string" ? hre.network.config.url : "";
  const usesLocalRpc = rpcUrl.includes("127.0.0.1") || rpcUrl.includes("localhost");

  if (deployOnFork || usesLocalRpc) {
    return false;
  }

  return EXISTING_MAINNET_DEPLOYMENTS.includes(hre.network.name);
}
