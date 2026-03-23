import { HardhatRuntimeEnvironment } from "hardhat/types";
import { createDeployFunction } from "../utils/deploy";

const func = createDeployFunction({
  contractName: "EdgeDataStreamVerifier",
  getDeployArgs: async () => {
    const oracleConfig = await hre.gmx.getOracle();
    return [oracleConfig.edgeOracleSigner];
  },
  id: "EdgeDataStreamVerifier_6",
});

func.skip = async (hre: HardhatRuntimeEnvironment) => {
  // Edge data streams are optional; keep them explicitly opt-in so we don't
  // block deployments when edgeOracleSigner isn't configured.
  if (hre.network.name === "baseSepolia") return true;

  if (hre.network.name === "base") {
    const enableEdgeDataStreams = process.env.ENABLE_EDGE_DATA_STREAMS === "true";
    return !enableEdgeDataStreams;
  }

  return false;
};

export default func;
