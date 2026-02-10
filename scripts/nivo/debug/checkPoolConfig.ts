/**
 * Check Pool Configuration
 *
 * Dynamically reads markets from the Reader contract so addresses are always current.
 */
import { deployments, ethers } from "hardhat";
import * as keys from "../../../utils/keys";

async function main() {
  console.log("=== Checking Pool Configuration ===\n");

  const dataStore = await ethers.getContractAt("DataStore", (await deployments.get("DataStore")).address);

  // Get the Reader contract which has access to MarketUtils
  const reader = await ethers.getContractAt("Reader", (await deployments.get("Reader")).address);

  // Get markets dynamically
  const allMarkets = await reader.getMarkets(dataStore.address, 0, 100);
  if (allMarkets.length === 0) {
    console.log("No markets deployed.");
    return;
  }

  console.log("Deployed markets:");
  for (let i = 0; i < allMarkets.length; i++) {
    let name = allMarkets[i].marketToken;
    try {
      const token = await ethers.getContractAt("MintableToken", allMarkets[i].indexToken);
      name = `${await token.symbol()}/USD`;
    } catch { /* ignore */ }
    console.log(`  [${i}] ${name}: ${allMarkets[i].marketToken}`);
  }

  const marketIdx = process.env.MARKET_INDEX ? parseInt(process.env.MARKET_INDEX) : 0;
  const selected = allMarkets[marketIdx];
  const market = selected.marketToken;
  const longToken = selected.longToken;

  console.log("\nSelected market:", market);
  console.log("Long token:", longToken);

  // Use the official GMX keys library function
  console.log("\n=== Using Official GMX Keys Library ===");
  console.log("MAX_POOL_USD_FOR_DEPOSIT base key:", keys.MAX_POOL_USD_FOR_DEPOSIT);

  const officialKey = keys.maxPoolUsdForDepositKey(market, longToken);
  console.log("Official key from keys.ts:", officialKey);

  // Read value using official key
  const officialValue = await dataStore.getUint(officialKey);
  console.log("Value at official key:", officialValue.toString());
  console.log("Value in USD:", ethers.utils.formatUnits(officialValue, 30));

  // Get detailed market info from Reader
  const detailedMarket = await reader.getMarket(dataStore.address, market);
  console.log("\n=== Market Info ===");
  console.log("  Market Token:", detailedMarket.marketToken);
  console.log("  Index Token:", detailedMarket.indexToken);
  console.log("  Long Token:", detailedMarket.longToken);
  console.log("  Short Token:", detailedMarket.shortToken);

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
