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
  if (hre.network.name === "baseSepolia") return true;

  if (hre.network.name === "base") {
    const enableEdgeDataStreams = process.env.ENABLE_EDGE_DATA_STREAMS === "true";
    return !enableEdgeDataStreams;
  }

  return false;
};

export default func;
