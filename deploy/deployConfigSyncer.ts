import { grantRoleIfNotGranted } from "../utils/role";
import { createDeployFunction } from "../utils/deploy";

const constructorContracts = ["RoleStore", "Config", "DataStore", "EventEmitter"];

const func = createDeployFunction({
  contractName: "ConfigSyncer",
  dependencyNames: constructorContracts,
  getDeployArgs: async ({ dependencyContracts, gmx, network, get }) => {
    const riskOracleConfig = await gmx.getRiskOracle();
    let riskOracleAddress = riskOracleConfig.riskOracle;
    if (network.name === "hardhat" || network.name === "localhost") {
      const riskOracle = await get("MockRiskOracle");
      riskOracleAddress = riskOracle.address;
    }
    if (!riskOracleAddress) {
      throw new Error("riskOracleAddress is not defined");
    }
    return constructorContracts
      .map((dependencyName) => dependencyContracts[dependencyName].address)
      .concat(riskOracleAddress);
  },
  afterDeploy: async ({ deployedContract }) => {
    await grantRoleIfNotGranted(deployedContract, "CONTROLLER");
    await grantRoleIfNotGranted(deployedContract, "CONFIG_KEEPER");
  },
});

func.skip = async ({ network }) => {
  // Nivo doesn't rely on ConfigSyncer automation at launch. RiskOracle for `base`
  // is configured as `address(0)` so we skip deploying ConfigSyncer on Base until
  // the real risk oracle address + sync policy are finalized.
  return ["botanix", "baseSepolia", "base"].includes(network.name);
};

func.dependencies = func.dependencies.concat(["MockRiskOracle"]);

export default func;
