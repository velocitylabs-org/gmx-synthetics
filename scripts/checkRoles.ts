import { ethers, deployments } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Checking roles for deployer:", deployer.address);

  const roleStoreDeployment = await deployments.get("RoleStore");
  const roleStoreAddress = roleStoreDeployment.address;
  console.log("RoleStore address:", roleStoreAddress);

  const roleStore = await ethers.getContractAt("RoleStore", roleStoreAddress);

  const CONTROLLER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CONTROLLER"));
  const hasControllerRole = await roleStore.hasRole(deployer.address, CONTROLLER_ROLE);

  console.log(`Has CONTROLLER role: ${hasControllerRole}`);

  if (!hasControllerRole) {
    console.log("Attempting to grant role again...");
    // Try to grant it here to double check
    try {
      const tx = await roleStore.grantRole(deployer.address, CONTROLLER_ROLE);
      await tx.wait();
      console.log("Grant role transaction succeeded");
      const hasRoleNow = await roleStore.hasRole(deployer.address, CONTROLLER_ROLE);
      console.log(`Has CONTROLLER role after retry: ${hasRoleNow}`);
    } catch (e) {
      console.error("Failed to grant role:", e);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
