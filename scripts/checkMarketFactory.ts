import { deployments, ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();

  const roleStore = await ethers.getContractAt("RoleStore", (await deployments.get("RoleStore")).address);
  const marketFactory = await deployments.get("MarketFactory");

  const CONTROLLER_ROLE = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"]));

  console.log("MarketFactory address:", marketFactory.address);

  const hasController = await roleStore.hasRole(marketFactory.address, CONTROLLER_ROLE);
  console.log("MarketFactory has CONTROLLER:", hasController);

  if (!hasController) {
    console.log("\nGranting CONTROLLER role to MarketFactory...");
    const tx = await roleStore.grantRole(marketFactory.address, CONTROLLER_ROLE);
    await tx.wait();
    console.log("Done!");
  }

  // Also check RoleAdmin
  const ROLE_ADMIN = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ROLE_ADMIN"]));
  const hasRoleAdmin = await roleStore.hasRole(deployer.address, ROLE_ADMIN);
  console.log("\nDeployer has ROLE_ADMIN:", hasRoleAdmin);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
