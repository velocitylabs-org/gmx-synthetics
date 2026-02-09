import { deployments, ethers } from "hardhat";

async function main() {
  console.log("=== Listing All Markets ===\n");

  const dataStoreDeployment = await deployments.get("DataStore");
  const readerDeployment = await deployments.get("Reader");

  const _dataStore = await ethers.getContractAt("DataStore", dataStoreDeployment.address);
  const reader = await ethers.getContractAt("Reader", readerDeployment.address);

  console.log("DataStore:", dataStoreDeployment.address);
  console.log("Reader:", readerDeployment.address);

  // Get all markets using Reader
  try {
    const markets = await reader.getMarkets(dataStoreDeployment.address, 0, 100);
    console.log(`\nFound ${markets.length} markets:\n`);

    for (const market of markets) {
      console.log("Market Token:", market.marketToken);
      console.log("  Index Token:", market.indexToken);
      console.log("  Long Token:", market.longToken);
      console.log("  Short Token:", market.shortToken);
      console.log();
    }
  } catch (e: any) {
    console.log("Error getting markets via Reader:", e.message?.slice(0, 100));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
