/**
 * Check all relevant balances
 * 
 * Dynamically reads markets from the Reader contract so addresses are always current.
 */
import { deployments, ethers } from "hardhat";

async function main() {
  console.log("=== Balance Check ===\n");

  const [signer] = await ethers.getSigners();

  // Get USDT dynamically from deployments
  const usdtDeployment = await deployments.get("USDT");
  const usdt = await ethers.getContractAt("MintableToken", usdtDeployment.address);

  // Get markets dynamically from Reader
  const dataStoreDeployment = await deployments.get("DataStore");
  const readerDeployment = await deployments.get("Reader");
  const reader = await ethers.getContractAt("Reader", readerDeployment.address);
  const dataStore = await ethers.getContractAt("DataStore", dataStoreDeployment.address);
  const allMarkets = await reader.getMarkets(dataStoreDeployment.address, 0, 100);

  if (allMarkets.length === 0) {
    console.log("No markets deployed.");
    return;
  }

  // Use first market (or MARKET_INDEX env var)
  const marketIdx = process.env.MARKET_INDEX ? parseInt(process.env.MARKET_INDEX) : 0;
  const marketInfo = allMarkets[marketIdx];
  const market = marketInfo.marketToken;
  const marketToken = await ethers.getContractAt("MarketToken", market);

  let marketName = market;
  try {
    const token = await ethers.getContractAt("MintableToken", marketInfo.indexToken);
    marketName = `${await token.symbol()}/USD`;
  } catch { /* ignore */ }

  const depositVault = await deployments.get("DepositVault");

  console.log("Signer:", signer.address);
  console.log("Market:", marketName, `(${market})`);
  console.log("USDT:", usdtDeployment.address);

  console.log("\n=== USDT Balances ===");
  console.log("Signer USDT:", ethers.utils.formatUnits(await usdt.balanceOf(signer.address), 6));
  console.log("DepositVault USDT:", ethers.utils.formatUnits(await usdt.balanceOf(depositVault.address), 6));
  console.log("Market USDT:", ethers.utils.formatUnits(await usdt.balanceOf(market), 6));

  console.log("\n=== Market Token Balances ===");
  console.log("Signer Market Token:", ethers.utils.formatUnits(await marketToken.balanceOf(signer.address), 18));
  console.log("Total Supply:", ethers.utils.formatUnits(await marketToken.totalSupply(), 18));

  // Check DataStore pool amount
  const { hashString, hashData } = await import("../../../utils/hash");
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
