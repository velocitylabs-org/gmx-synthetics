import { ethers, deployments } from "hardhat";

async function main() {
  const readerDeployment = await deployments.get("Reader");
  const dataStoreDeployment = await deployments.get("DataStore");

  const reader = await ethers.getContractAt("Reader", readerDeployment.address);
  const dataStore = await ethers.getContractAt("DataStore", dataStoreDeployment.address);

  const start = 0;
  const end = 100; // Fetch up to 100 markets

  console.log("Fetching markets from Reader at:", reader.address);

  // getMarkets(dataStore, start, end)
  const markets = await reader.getMarkets(dataStore.address, start, end);

  console.log(`Found ${markets.length} markets:`);

  for (const market of markets) {
    // Market struct: { marketToken, indexToken, longToken, shortToken }
    console.log(`Market Token: ${market.marketToken}`);
    console.log(`  Index Token: ${market.indexToken}`);
    console.log(`  Long Token:  ${market.longToken}`);
    console.log(`  Short Token: ${market.shortToken}`);
    console.log("---");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
