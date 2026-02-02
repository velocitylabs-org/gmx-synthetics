import { grantRoleIfNotGranted } from "../utils/role";
import { createDeployFunction, skipHandlerFunction } from "../utils/deploy";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const constructorContracts = ["RoleStore", "Oracle", "DataStore", "EventEmitter"];
const contractName = "FeeHandler";

const func = createDeployFunction({
  contractName: contractName,
  dependencyNames: constructorContracts,
  getDeployArgs: async ({ dependencyContracts, gmx, network }) => {
    const vaultV1Config = await gmx.getVaultV1();
    let gmxAddress = vaultV1Config.gmx;
    if (network.name === "hardhat") {
      const tokens = await hre.gmx.getTokens();
      gmxAddress = tokens.GMX.address;
    }
    return constructorContracts.map((dependencyName) => dependencyContracts[dependencyName].address).concat(gmxAddress);
  },
  libraryNames: ["MarketUtils"],
  afterDeploy: async ({ deployedContract }) => {
    await grantRoleIfNotGranted(deployedContract, "CONTROLLER");
  },
  // FeeHandler should not be re-deployed as the new FeeHandler would not have
  // the funds from the existing FeeHandler which could lead to errors in
  // buybacks and withdrawal of fees as the amounts in the DataStore would
  // not match the contract balance
  // The migration of funds must be explicitly handled if a re-deploy is required
  id: "FeeHandler_1",
});

func.skip = async (hre: HardhatRuntimeEnvironment) => {
  if (["botanix", "avalancheFuji", "arbitrumSepolia"].includes(hre.network.name)) {
    return true;
  }

  return skipHandlerFunction(contractName)(hre);
};

export default func;
