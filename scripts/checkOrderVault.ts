/**
 * Check OrderVault contract
 */
import { deployments, ethers } from "hardhat";

async function main() {
  console.log("=== Checking OrderVault ===\n");

  const orderVaultAddress = "0x4c5859f0F772848b2D91F1D83E2Fe57935348029";

  // Check if there's code at the address
  const code = await ethers.provider.getCode(orderVaultAddress);
  console.log("OrderVault address:", orderVaultAddress);
  console.log("Code length:", code.length);
  console.log("Has code:", code !== "0x");

  // Get the deployment
  try {
    const deployment = await deployments.get("OrderVault");
    console.log("\nDeployment address:", deployment.address);
    console.log("Same address:", deployment.address === orderVaultAddress);
  } catch {
    console.log("\nOrderVault not in deployments!");
  }

  // Check StrictBank address (OrderVault base)
  const orderVault = await ethers.getContractAt("OrderVault", orderVaultAddress);
  const dataStoreAddr = await orderVault.dataStore();
  const roleStoreAddr = await orderVault.roleStore();
  console.log("\nOrderVault.dataStore():", dataStoreAddr);
  console.log("OrderVault.roleStore():", roleStoreAddr);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
