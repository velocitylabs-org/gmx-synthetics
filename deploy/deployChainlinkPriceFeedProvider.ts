import { createDeployFunction } from "../utils/deploy";
import { setBoolIfDifferent } from "../utils/dataStore";
import * as keys from "../utils/keys";

const constructorContracts = ["DataStore"];

const func = createDeployFunction({
  contractName: "ChainlinkPriceFeedProvider",
  dependencyNames: constructorContracts,
  getDeployArgs: async ({ dependencyContracts }) => {
    return constructorContracts.map((dependencyName) => dependencyContracts[dependencyName].address);
  },
  afterDeploy: async ({ deployedContract }) => {
    await setBoolIfDifferent(
      keys.isOracleProviderEnabledKey(deployedContract.address),
      true,
      "isOracleProviderEnabledKey"
    );

    await setBoolIfDifferent(
      keys.isAtomicOracleProviderKey(deployedContract.address),
      true,
      "isAtomicOracleProviderKey"
    );
  },
  id: "ChainlinkPriceFeedProvider_6",
});

func.skip = async (hre) => {
  const deployOnFork = process.env.DEPLOY_ON_FORK === "true";
  const rpcUrl = typeof hre.network.config.url === "string" ? hre.network.config.url : "";
  const usesLocalRpc = rpcUrl.includes("127.0.0.1") || rpcUrl.includes("localhost");
  return hre.network.name === "base" && (deployOnFork || usesLocalRpc);
};

export default func;
