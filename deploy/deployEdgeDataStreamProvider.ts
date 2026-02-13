import { HardhatRuntimeEnvironment } from "hardhat/types";
import { createDeployFunction } from "../utils/deploy";

const constructorContracts = ["DataStore", "Oracle", "EdgeDataStreamVerifier"];

const func = createDeployFunction({
  contractName: "EdgeDataStreamProvider",
  dependencyNames: constructorContracts,
  getDeployArgs: async ({ dependencyContracts }) => {
    return constructorContracts.map((dependencyName) => dependencyContracts[dependencyName].address);
  },
  id: "EdgeDataStreamProvider_6",
});

func.skip = async (hre: HardhatRuntimeEnvironment) => {
  return ["baseSepolia"].includes(hre.network.name);
};

export default func;
