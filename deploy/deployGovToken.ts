import { createDeployFunction } from "../utils/deploy";

const func = createDeployFunction({
  contractName: "GovToken",
  id: "GovToken_1",
  dependencyNames: ["RoleStore"],
  getDeployArgs: async ({ dependencyContracts }) => {
    return [
      dependencyContracts.RoleStore.address, // roleStore
      "NIVO DAO", // name
      "NIVO_DAO", // symbol
      18, // decimals
    ];
  },
});

export default func;
