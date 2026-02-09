/**
 * Check all relevant balances
 */
import { deployments, ethers } from "hardhat";

async function main() {
  console.log("=== Balance Check ===\n");

  const [signer] = await ethers.getSigners();
  const usdt = await ethers.getContractAt("MintableToken", "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9");
  const market = "0x763779b6c23e29C02d675eA0cE6CBFf8DCc328e6";
  const marketToken = await ethers.getContractAt("MarketToken", market);

  const depositVault = await deployments.get("DepositVault");
  const _marketStore = await deployments.get("MarketStoreUtils"); // This might not exist as a separate deployment

  console.log("Signer:", signer.address);
  console.log("\n=== USDT Balances ===");
  console.log("Signer USDT:", ethers.utils.formatUnits(await usdt.balanceOf(signer.address), 6));
  console.log("DepositVault USDT:", ethers.utils.formatUnits(await usdt.balanceOf(depositVault.address), 6));
  console.log("Market USDT:", ethers.utils.formatUnits(await usdt.balanceOf(market), 6));

  console.log("\n=== Market Token Balances ===");
  console.log("Signer Market Token:", ethers.utils.formatUnits(await marketToken.balanceOf(signer.address), 18));
  console.log("Total Supply:", ethers.utils.formatUnits(await marketToken.totalSupply(), 18));

  // Check DataStore pool amount
  const dataStore = await ethers.getContractAt("DataStore", (await deployments.get("DataStore")).address);
  const { hashString, hashData } = await import("../utils/hash");
  const POOL_AMOUNT = hashString("POOL_AMOUNT");
  const poolAmountKey = hashData(["bytes32", "address", "address"], [POOL_AMOUNT, market, usdt.address]);
  const poolAmount = await dataStore.getUint(poolAmountKey);
  console.log("\n=== Pool Amount (from DataStore) ===");
  console.log("Pool Amount Key:", poolAmountKey);
  console.log("Pool Amount:", ethers.utils.formatUnits(poolAmount, 6), "USDT");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
