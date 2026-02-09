import { deployments, ethers } from "hardhat";

async function main() {
  console.log("=== Debugging Market Token ===\n");

  const marketTokenAddress = "0x25413bA58D07cf34369ae410dd77700F186a48c4";
  const dataStoreDeployment = await deployments.get("DataStore");

  console.log("Checking market token:", marketTokenAddress);

  // Check if contract exists at this address
  const code = await ethers.provider.getCode(marketTokenAddress);
  console.log("Contract code exists:", code !== "0x");
  console.log("Code length:", code.length);

  if (code === "0x") {
    console.log("\n❌ No contract deployed at this address!");
    return;
  }

  // Try to interact with it as MarketToken
  try {
    const marketToken = await ethers.getContractAt("MarketToken", marketTokenAddress);
    const name = await marketToken.name();
    const symbol = await marketToken.symbol();
    console.log("\nMarket Token details:");
    console.log("  Name:", name);
    console.log("  Symbol:", symbol);
  } catch (e: any) {
    console.log("Could not read as MarketToken:", e.message?.slice(0, 100));
  }

  // Check DataStore for market info
  const dataStore = await ethers.getContractAt("DataStore", dataStoreDeployment.address);

  // Market properties are stored with keys like: keccak256(abi.encode(BASE_KEY, market))
  console.log("\n=== Checking DataStore for market ===");

  // MARKET_LIST key
  const MARKET_LIST_KEY = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MARKET_LIST"));
  console.log("MARKET_LIST_KEY:", MARKET_LIST_KEY);

  // Check if market is in the list by checking contains
  try {
    const contains = await dataStore.containsAddress(MARKET_LIST_KEY, marketTokenAddress);
    console.log("Market in MARKET_LIST:", contains);
  } catch (e: any) {
    console.log("Error checking MARKET_LIST:", e.message?.slice(0, 100));
  }

  // Get all addresses in MARKET_LIST
  try {
    const count = await dataStore.getAddressCount(MARKET_LIST_KEY);
    console.log("MARKET_LIST count:", count.toString());

    if (count.gt(0)) {
      const addresses = await dataStore.getAddressValuesAt(MARKET_LIST_KEY, 0, count);
      console.log("Markets:", addresses);
    }
  } catch (e: any) {
    console.log("Error getting MARKET_LIST:", e.message?.slice(0, 100));
  }

  // Check market token properties directly
  // INDEX_TOKEN
  const INDEX_TOKEN_BASE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("INDEX_TOKEN"));
  const indexTokenKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [INDEX_TOKEN_BASE, marketTokenAddress])
  );
  try {
    const indexToken = await dataStore.getAddress(indexTokenKey);
    console.log("Index Token:", indexToken);
  } catch (e: any) {
    console.log("Error getting index token:", e.message?.slice(0, 50));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
