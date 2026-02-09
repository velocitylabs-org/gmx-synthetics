/**
 * Debug Price Feed Configuration
 */
import { deployments, ethers } from "hardhat";
import { hashData, hashString } from "../utils/hash";

async function main() {
  console.log("=== Debug Price Feed Configuration ===\n");

  const dataStore = await ethers.getContractAt("DataStore", (await deployments.get("DataStore")).address);
  const mockPriceFeed = await ethers.getContractAt("MockPriceFeed", (await deployments.get("MockPriceFeed")).address);

  const indexToken = "0xf3aa2cd2ED74463405cE698f3e2ad12dd2808f90"; // BRL index token
  const USDT = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

  const PRICE_FEED = hashString("PRICE_FEED");
  console.log("PRICE_FEED hash:", PRICE_FEED);

  // Check index token price feed
  const indexPriceFeedKey = hashData(["bytes32", "address"], [PRICE_FEED, indexToken]);
  console.log("\nIndex Token Price Feed Key:", indexPriceFeedKey);
  const indexPriceFeedAddress = await dataStore.getAddress(indexPriceFeedKey);
  console.log("Index Token Price Feed Address:", indexPriceFeedAddress);
  console.log("Expected (MockPriceFeed):", mockPriceFeed.address);
  console.log("Match:", indexPriceFeedAddress.toLowerCase() === mockPriceFeed.address.toLowerCase());

  // Check USDT price feed
  const usdtPriceFeedKey = hashData(["bytes32", "address"], [PRICE_FEED, USDT]);
  console.log("\nUSDT Price Feed Key:", usdtPriceFeedKey);
  const usdtPriceFeedAddress = await dataStore.getAddress(usdtPriceFeedKey);
  console.log("USDT Price Feed Address:", usdtPriceFeedAddress);
  console.log("Match:", usdtPriceFeedAddress.toLowerCase() === mockPriceFeed.address.toLowerCase());

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
