import { deployments, ethers } from "hardhat";

/**
 * Creates a WETH/USDC market for local testing.
 * Uses MarketFactory to create a proper market that can be used for trading.
 */
async function main() {
  console.log("=== Creating Local Test Market ===\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Get required contracts
  const roleStoreDeployment = await deployments.get("RoleStore");
  const dataStoreDeployment = await deployments.get("DataStore");
  const marketFactoryDeployment = await deployments.get("MarketFactory");

  let wethAddress: string;

  try {
    const wethDeployment = await deployments.get("WETH");
    wethAddress = wethDeployment.address;
  } catch {
    const wntDeployment = await deployments.get("WNT");
    wethAddress = wntDeployment.address;
  }

  const usdcDeployment = await deployments.get("USDC");
  const usdcAddress = usdcDeployment.address;

  console.log("MarketFactory:", marketFactoryDeployment.address);
  console.log("DataStore:", dataStoreDeployment.address);
  console.log("WETH/WNT:", wethAddress);
  console.log("USDC:", usdcAddress);

  const roleStore = await ethers.getContractAt("RoleStore", roleStoreDeployment.address);
  const dataStore = await ethers.getContractAt("DataStore", dataStoreDeployment.address);
  const marketFactory = await ethers.getContractAt("MarketFactory", marketFactoryDeployment.address);

  // Ensure deployer has CONTROLLER role
  const CONTROLLER_ROLE = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"]));
  const hasController = await roleStore.hasRole(deployer.address, CONTROLLER_ROLE);

  if (!hasController) {
    console.log("\n⚠️  Deployer does not have CONTROLLER role. Run: npm run local:grant-roles");
    process.exit(1);
  }
  console.log("✅ Deployer has CONTROLLER role");

  // Check existing markets
  const MARKET_LIST_KEY = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MARKET_LIST"));
  const marketCount = await dataStore.getAddressCount(MARKET_LIST_KEY);
  console.log(`\nExisting markets: ${marketCount}`);

  if (marketCount.gt(0)) {
    const markets = await dataStore.getAddressValuesAt(MARKET_LIST_KEY, 0, marketCount);
    console.log("Market addresses:", markets);

    // Check if we already have a WETH/USDC market
    for (const marketAddress of markets) {
      try {
        const _marketToken = await ethers.getContractAt("MarketToken", marketAddress);
        // Try to get market info
        console.log(`  Market ${marketAddress}`);
      } catch (_e) {
        console.log(`  Market ${marketAddress} (could not read details)`);
      }
    }

    console.log("\n⚠️  Markets already exist. Use existing market or reset the node.");
    console.log("   First market address:", markets[0]);
    return;
  }

  // Create market via MarketFactory
  console.log("\n=== Creating WETH/USDC Market via MarketFactory ===\n");

  // Market type - use default
  const DEFAULT_MARKET_TYPE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("default"));

  console.log("Parameters:");
  console.log("  Index Token:", wethAddress, "(WETH)");
  console.log("  Long Token:", wethAddress, "(WETH)");
  console.log("  Short Token:", usdcAddress, "(USDC)");
  console.log("  Market Type:", DEFAULT_MARKET_TYPE);

  try {
    // First do a static call to get the market token address
    const marketTokenAddress = await marketFactory.callStatic.createMarket(
      wethAddress, // indexToken
      wethAddress, // longToken
      usdcAddress, // shortToken
      DEFAULT_MARKET_TYPE
    );
    console.log("\nPredicted market token address:", marketTokenAddress);

    // Now actually create the market
    console.log("Sending createMarket transaction...");
    const tx = await marketFactory.createMarket(wethAddress, wethAddress, usdcAddress, DEFAULT_MARKET_TYPE);

    console.log("Tx hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Market created in block:", receipt.blockNumber);

    // Verify market was created
    const newMarketCount = await dataStore.getAddressCount(MARKET_LIST_KEY);
    console.log(`Markets after creation: ${newMarketCount}`);

    if (newMarketCount.gt(0)) {
      const markets = await dataStore.getAddressValuesAt(MARKET_LIST_KEY, 0, newMarketCount);
      const newMarket = markets[markets.length - 1];

      console.log("\n=== Market Created Successfully ===");
      console.log("Market Token Address:", newMarket);
      console.log("\nUpdate nivo-demo/src/config.ts with:");
      console.log(`  marketAddress: '${newMarket}',`);
    }
  } catch (e: any) {
    console.log("\n❌ Error creating market:");
    console.log(e.message?.slice(0, 500));

    // Try to decode error
    if (e.error?.data) {
      console.log("Error data:", e.error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
