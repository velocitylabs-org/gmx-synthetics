/**
 * Test Oracle Price Provider
 *
 * Dynamically reads token addresses from deployed markets via Reader.
 * No hardcoded addresses -- always uses current deployment.
 */
import { deployments, ethers } from "hardhat";

async function main() {
  console.log("=== Test Oracle Price ===\n");

  const chainlinkProvider = await ethers.getContractAt(
    "ChainlinkPriceFeedProvider",
    (
      await deployments.get("ChainlinkPriceFeedProvider")
    ).address
  );

  // Get markets dynamically from Reader
  const dataStore = await ethers.getContractAt("DataStore", (await deployments.get("DataStore")).address);
  const reader = await ethers.getContractAt("Reader", (await deployments.get("Reader")).address);
  const allMarkets = await reader.getMarkets(dataStore.address, 0, 100);

  if (allMarkets.length === 0) {
    console.log("No markets deployed. Run: npm run local:deploy:markets");
    return;
  }

  // Select market
  const marketIdx = process.env.MARKET_INDEX ? parseInt(process.env.MARKET_INDEX) : 0;
  const selected = allMarkets[marketIdx];
  const indexToken = selected.indexToken;
  const longToken = selected.longToken;

  let marketName = selected.marketToken;
  try {
    const token = await ethers.getContractAt("MintableToken", indexToken);
    marketName = `${await token.symbol()}/USD`;
  } catch {
    /* ignore */
  }

  console.log("Market:", marketName);
  console.log("Testing ChainlinkPriceFeedProvider.getOraclePrice()...\n");

  try {
    console.log("Index Token:", indexToken);
    const indexPrice = await chainlinkProvider.getOraclePrice(indexToken, "0x");
    console.log("  Price min:", ethers.utils.formatUnits(indexPrice.min, 30));
    console.log("  Price max:", ethers.utils.formatUnits(indexPrice.max, 30));
    console.log("  Timestamp:", indexPrice.timestamp.toString());
    console.log("  Provider:", indexPrice.provider);
  } catch (e: any) {
    console.log("  ERROR:", e.reason || e.message);
  }

  console.log("");

  try {
    console.log("Long Token (USDT):", longToken);
    const longTokenPrice = await chainlinkProvider.getOraclePrice(longToken, "0x");
    console.log("  Price min:", ethers.utils.formatUnits(longTokenPrice.min, 30));
    console.log("  Price max:", ethers.utils.formatUnits(longTokenPrice.max, 30));
    console.log("  Timestamp:", longTokenPrice.timestamp.toString());
    console.log("  Provider:", longTokenPrice.provider);
  } catch (e: any) {
    console.log("  ERROR:", e.reason || e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
