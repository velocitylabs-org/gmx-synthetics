/**
 * Check Pool Configuration
 */
import { deployments, ethers } from "hardhat";
import * as keys from "../utils/keys";

async function main() {
  console.log("=== Checking Pool Configuration ===\n");

  const dataStore = await ethers.getContractAt("DataStore", (await deployments.get("DataStore")).address);

  // Get the Reader contract which has access to MarketUtils
  const reader = await ethers.getContractAt("Reader", (await deployments.get("Reader")).address);

  // Get market addresses
  const market = "0x763779b6c23e29C02d675eA0cE6CBFf8DCc328e6"; // BRL/USD
  const longToken = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"; // USDT

  console.log("Market:", market);
  console.log("Token:", longToken);

  // Use the official GMX keys library function
  console.log("\n=== Using Official GMX Keys Library ===");
  console.log("MAX_POOL_USD_FOR_DEPOSIT base key:", keys.MAX_POOL_USD_FOR_DEPOSIT);

  const officialKey = keys.maxPoolUsdForDepositKey(market, longToken);
  console.log("Official key from keys.ts:", officialKey);

  // Read value using official key
  const officialValue = await dataStore.getUint(officialKey);
  console.log("Value at official key:", officialValue.toString());
  console.log("Value in USD:", ethers.utils.formatUnits(officialValue, 30));

  // Get market info to see what token is actually used
  const marketInfo = await reader.getMarket(dataStore.address, market);
  console.log("\n=== Market Info ===");
  console.log("  Market Token:", marketInfo.marketToken);
  console.log("  Index Token:", marketInfo.indexToken);
  console.log("  Long Token:", marketInfo.longToken);
  console.log("  Short Token:", marketInfo.shortToken);

  // Use the actual market longToken from chain
  const actualLongToken = marketInfo.longToken;
  console.log("\nUsing actual long token from market:", actualLongToken);

  const keyWithActualToken = keys.maxPoolUsdForDepositKey(market, actualLongToken);
  console.log("Key with actual token:", keyWithActualToken);

  const valueWithActualToken = await dataStore.getUint(keyWithActualToken);
  console.log("Value at key with actual token:", valueWithActualToken.toString());
  console.log("Value in USD:", ethers.utils.formatUnits(valueWithActualToken, 30));

  // Check MAX_POOL_AMOUNT as well
  const maxPoolAmountKey = keys.maxPoolAmountKey(market, longToken);
  const maxPoolAmount = await dataStore.getUint(maxPoolAmountKey);
  console.log("\n=== MAX_POOL_AMOUNT ===");
  console.log("Key:", maxPoolAmountKey);
  console.log("Value:", maxPoolAmount.toString());
  console.log("Value in USDT:", ethers.utils.formatUnits(maxPoolAmount, 6));

  // Check pool amount
  const poolAmountKey = keys.poolAmountKey(market, longToken);
  const poolAmount = await dataStore.getUint(poolAmountKey);
  console.log("\n=== Current POOL_AMOUNT ===");
  console.log("Key:", poolAmountKey);
  console.log("Value:", poolAmount.toString());
  console.log("Value in USDT:", ethers.utils.formatUnits(poolAmount, 6));

  // Check Deposit Vault Balance
  console.log("\n=== Deposit Vault Balance ===");
  const depositVault = await deployments.get("DepositVault");
  const usdt = await ethers.getContractAt("MintableToken", longToken);
  const vaultBalance = await usdt.balanceOf(depositVault.address);
  console.log("USDT in DepositVault:", ethers.utils.formatUnits(vaultBalance, 6));

  // Check Market Token Balance
  console.log("\n=== Market Token Balance ===");
  const [signer] = await ethers.getSigners();
  const marketToken = await ethers.getContractAt("MarketToken", market);
  const mtBalance = await marketToken.balanceOf(signer.address);
  console.log("Market Token Balance:", ethers.utils.formatUnits(mtBalance, 18));
  const mtSupply = await marketToken.totalSupply();
  console.log("Market Token Total Supply:", ethers.utils.formatUnits(mtSupply, 18));

  // Check the market pool (longToken balance)
  const marketBalance = await usdt.balanceOf(market);
  console.log("USDT in Market:", ethers.utils.formatUnits(marketBalance, 6));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
