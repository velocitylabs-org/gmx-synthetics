/**
 * Check WNT (Wrapped Native Token) configuration
 */
import { deployments, ethers } from "hardhat";

function hashString(value: string): string {
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(value));
}

async function main() {
  console.log("=== Checking WNT Configuration ===\n");

  const dataStore = await ethers.getContractAt("DataStore", (await deployments.get("DataStore")).address);

  // WNT key
  const WNT = hashString("WNT");
  const wntAddress = await dataStore.getAddress(WNT);
  console.log("WNT address in DataStore:", wntAddress);

  // Also check WETH deployment
  try {
    const wethDeployment = await deployments.get("WETH");
    console.log("WETH deployment:", wethDeployment.address);
  } catch {
    console.log("WETH not deployed");
  }

  try {
    const wntDeployment = await deployments.get("WNT");
    console.log("WNT deployment:", wntDeployment.address);
  } catch {
    console.log("WNT not deployed");
  }

  // Check if they match
  if (wntAddress === ethers.constants.AddressZero) {
    console.log("\n⚠️  WNT is not configured in DataStore!");
    console.log("   This will cause order creation to fail.");
  }

  // Check OrderVault
  const orderVaultDeployment = await deployments.get("OrderVault");
  const orderVault = await ethers.getContractAt("OrderVault", orderVaultDeployment.address);
  console.log("\nOrderVault:", orderVaultDeployment.address);

  // Check balance in OrderVault
  const usdtAddress = (await deployments.get("USDT")).address;
  const usdt = await ethers.getContractAt("IERC20", usdtAddress);
  const vaultBalance = await usdt.balanceOf(orderVaultDeployment.address);
  console.log("OrderVault USDT balance:", ethers.utils.formatUnits(vaultBalance, 6));

  // Check ETH balance in OrderVault
  const vaultEthBalance = await ethers.provider.getBalance(orderVaultDeployment.address);
  console.log("OrderVault ETH balance:", ethers.utils.formatEther(vaultEthBalance));

  // Check if OrderVault can recordTransferIn
  // This requires the DataStore address
  const dsAddress = await orderVault.dataStore();
  console.log("OrderVault.dataStore():", dsAddress);

  // Check EXECUTION_GAS_FEE_BASE_AMOUNT
  const EXECUTION_GAS_FEE_BASE_AMOUNT = hashString("EXECUTION_GAS_FEE_BASE_AMOUNT");
  const EXECUTION_GAS_FEE_BASE_AMOUNT_V2_1 = hashString("EXECUTION_GAS_FEE_BASE_AMOUNT_V2_1");
  const execFeeBase = await dataStore.getUint(EXECUTION_GAS_FEE_BASE_AMOUNT);
  const execFeeBaseV2 = await dataStore.getUint(EXECUTION_GAS_FEE_BASE_AMOUNT_V2_1);
  console.log("\nEXECUTION_GAS_FEE_BASE_AMOUNT:", execFeeBase.toString());
  console.log("EXECUTION_GAS_FEE_BASE_AMOUNT_V2_1:", execFeeBaseV2.toString());

  console.log("\n=== Debug Complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
