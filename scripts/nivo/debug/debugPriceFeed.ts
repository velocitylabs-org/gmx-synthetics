/**
 * Debug Price Feed Configuration
 *
 * Dynamically reads token addresses from deployed markets via Reader.
 * No hardcoded addresses -- always uses current deployment.
 */
import { deployments, ethers } from "hardhat";
import { hashData, hashString } from "../../../utils/hash";

async function main() {
  console.log("=== Debug Price Feed Configuration ===\n");

  const dataStore = await ethers.getContractAt("DataStore", (await deployments.get("DataStore")).address);
  const mockPriceFeed = await ethers.getContractAt("MockPriceFeed", (await deployments.get("MockPriceFeed")).address);

  // Get markets dynamically from Reader
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
  console.log("Index Token:", indexToken);
  console.log("Long Token (USDT):", longToken);
  console.log("MockPriceFeed:", mockPriceFeed.address);

  const PRICE_FEED = hashString("PRICE_FEED");
  console.log("\nPRICE_FEED hash:", PRICE_FEED);

  // Check index token price feed
  const indexPriceFeedKey = hashData(["bytes32", "address"], [PRICE_FEED, indexToken]);
  console.log("\nIndex Token Price Feed Key:", indexPriceFeedKey);
  const indexPriceFeedAddress = await dataStore.getAddress(indexPriceFeedKey);
  console.log("Index Token Price Feed Address:", indexPriceFeedAddress);
  console.log("Expected (MockPriceFeed):", mockPriceFeed.address);
  console.log("Match:", indexPriceFeedAddress.toLowerCase() === mockPriceFeed.address.toLowerCase());

  // Check long token (USDT) price feed
  const longTokenPriceFeedKey = hashData(["bytes32", "address"], [PRICE_FEED, longToken]);
  console.log("\nLong Token Price Feed Key:", longTokenPriceFeedKey);
  const longTokenPriceFeedAddress = await dataStore.getAddress(longTokenPriceFeedKey);
  console.log("Long Token Price Feed Address:", longTokenPriceFeedAddress);
  console.log("Match:", longTokenPriceFeedAddress.toLowerCase() === mockPriceFeed.address.toLowerCase());

  // Check MockPriceFeed response
  console.log("\n=== MockPriceFeed Data ===");
  const latestRoundData = await mockPriceFeed.latestRoundData();
  console.log("Latest Answer:", latestRoundData[1].toString());
  console.log("Updated At:", latestRoundData[3].toString());
  console.log("Current Timestamp:", (await ethers.provider.getBlock("latest")).timestamp);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
