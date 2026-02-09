import { deployments, ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Granting roles to deployer:", deployer.address);

  const roleStoreDeployment = await deployments.get("RoleStore");
  const roleStoreAddress = roleStoreDeployment.address;
  console.log("Using RoleStore at:", roleStoreAddress);

  const roleStore = await ethers.getContractAt("RoleStore", roleStoreAddress);

  // CONTROLLER role hash (keccak256(abi.encode("CONTROLLER")))
  const CONTROLLER_ROLE = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"]));

  // =============================================
  // 1. Grant CONTROLLER role to deployer (EOA)
  // =============================================
  console.log("\n=== Granting roles to deployer ===");
  console.log("Granting CONTROLLER role to deployer...");
  const tx = await roleStore.grantRole(deployer.address, CONTROLLER_ROLE);
  await tx.wait();
  console.log("Granted CONTROLLER role to", deployer.address);

  const roles = [
    "GOV_TOKEN_CONTROLLER",
    "MARKET_KEEPER",
    "ORDER_KEEPER",
    "FEE_KEEPER",
    "LIQUIDATION_KEEPER",
    "ADL_KEEPER",
    "FEE_DISTRIBUTOR",
    "FROZEN_ORDER_KEEPER",
    "PRICING_KEEPER",
  ];

  for (const role of roles) {
    const roleHash = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], [role]));
    const tx = await roleStore.grantRole(deployer.address, roleHash);
    await tx.wait();
    console.log(`Granted ${role} role to`, deployer.address);
  }

  // =============================================
  // 2. Grant CONTROLLER role to protocol contracts
  // =============================================
  // These contracts need CONTROLLER to call each other and write to DataStore
  console.log("\n=== Granting CONTROLLER role to protocol contracts ===");

  const contractsNeedingController = [
    "ExchangeRouter",
    "OrderHandler",
    "DepositHandler",
    "WithdrawalHandler",
    "LiquidationHandler",
    "AdlHandler",
    "ShiftHandler",
    "SubaccountRouter",
    "GlvDepositHandler",
    "GlvWithdrawalHandler",
    "FeeHandler",
  ];

  for (const contractName of contractsNeedingController) {
    try {
      const deployment = await deployments.get(contractName);
      const contractAddress = deployment.address;

      // Check if already has role
      const hasRole = await roleStore.hasRole(contractAddress, CONTROLLER_ROLE);
      if (hasRole) {
        console.log(`${contractName} (${contractAddress}) already has CONTROLLER role`);
        continue;
      }

      const tx = await roleStore.grantRole(contractAddress, CONTROLLER_ROLE);
      await tx.wait();
      console.log(`Granted CONTROLLER to ${contractName} at ${contractAddress}`);
    } catch (error: any) {
      // Contract might not be deployed yet - that's okay
      console.log(`Skipping ${contractName} - not deployed yet or error: ${error.message?.slice(0, 50)}`);
    }
  }

  // =============================================
  // 3. Grant ROUTER_PLUGIN role to ExchangeRouter
  // =============================================
  // ExchangeRouter needs ROUTER_PLUGIN to transfer tokens via Router
  console.log("\n=== Granting ROUTER_PLUGIN role ===");
  const ROUTER_PLUGIN_ROLE = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ROUTER_PLUGIN"]));

  try {
    const exchangeRouterDeployment = await deployments.get("ExchangeRouter");
    const hasPlugin = await roleStore.hasRole(exchangeRouterDeployment.address, ROUTER_PLUGIN_ROLE);
    if (!hasPlugin) {
      const tx = await roleStore.grantRole(exchangeRouterDeployment.address, ROUTER_PLUGIN_ROLE);
      await tx.wait();
      console.log(`Granted ROUTER_PLUGIN to ExchangeRouter at ${exchangeRouterDeployment.address}`);
    } else {
      console.log(`ExchangeRouter already has ROUTER_PLUGIN role`);
    }
  } catch (error: any) {
    console.log(`Skipping ROUTER_PLUGIN grant - ExchangeRouter not deployed: ${error.message?.slice(0, 50)}`);
  }

  console.log("\n=== Role granting complete! ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
