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
  return ["baseSepolia"].includes(hre.network.name);
};

export default func;
