import { deployments, ethers } from "hardhat";

/**
 * This script verifies the local GMX setup is complete and outputs
 * all the contract addresses needed for the frontend config.
 */
async function main() {
  console.log("=== Verifying Local GMX Setup ===\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH\n");

  const requiredContracts = [
    // Core infrastructure
    "RoleStore",
    "DataStore",
    "EventEmitter",
    "Router",

    // Vaults
    "OrderVault",
    "DepositVault",
    "WithdrawalVault",

    // Oracle
    "Oracle",
    "MockPriceFeed",

    // Handlers
    "OrderHandler",
    "DepositHandler",
    "WithdrawalHandler",
    "LiquidationHandler",
    "ShiftHandler",

    // Router
    "ExchangeRouter",

    // Tokens
    "USDC",
    "WETH",
    "WBTC",

    // Other
    "ReferralStorage",
    "Reader",
  ];

  const deployedAddresses: Record<string, string> = {};
  const missingContracts: string[] = [];

  console.log("=== Checking Contract Deployments ===\n");

  for (const contractName of requiredContracts) {
    try {
      const deployment = await deployments.get(contractName);
      deployedAddresses[contractName] = deployment.address;
      console.log(`✅ ${contractName}: ${deployment.address}`);
    } catch (_error) {
      missingContracts.push(contractName);
      console.log(`❌ ${contractName}: NOT DEPLOYED`);
    }
  }

  // Check roles
  console.log("\n=== Checking Roles ===\n");

  if (deployedAddresses.RoleStore) {
    const roleStore = await ethers.getContractAt("RoleStore", deployedAddresses.RoleStore);
    const CONTROLLER_ROLE = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"]));
    const ROUTER_PLUGIN_ROLE = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(["string"], ["ROUTER_PLUGIN"])
    );

    // Check deployer roles
    const deployerHasController = await roleStore.hasRole(deployer.address, CONTROLLER_ROLE);
    console.log(`Deployer has CONTROLLER: ${deployerHasController ? "✅" : "❌"}`);

    // Check ExchangeRouter roles
    if (deployedAddresses.ExchangeRouter) {
      const erHasController = await roleStore.hasRole(deployedAddresses.ExchangeRouter, CONTROLLER_ROLE);
      const erHasRouterPlugin = await roleStore.hasRole(deployedAddresses.ExchangeRouter, ROUTER_PLUGIN_ROLE);
      console.log(`ExchangeRouter has CONTROLLER: ${erHasController ? "✅" : "❌"}`);
      console.log(`ExchangeRouter has ROUTER_PLUGIN: ${erHasRouterPlugin ? "✅" : "❌"}`);
    }

    // Check OrderHandler roles
    if (deployedAddresses.OrderHandler) {
      const ohHasController = await roleStore.hasRole(deployedAddresses.OrderHandler, CONTROLLER_ROLE);
      console.log(`OrderHandler has CONTROLLER: ${ohHasController ? "✅" : "❌"}`);
    }
  }

  // Check DataStore configuration
  console.log("\n=== Checking DataStore Configuration ===\n");

  if (deployedAddresses.DataStore) {
    const dataStore = await ethers.getContractAt("DataStore", deployedAddresses.DataStore);

    // Check for any markets
    try {
      const marketCount = await dataStore.getAddressCount(
        ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MARKET_LIST"))
      );
      console.log(`Number of markets: ${marketCount}`);

      if (marketCount.gt(0)) {
        const markets = await dataStore.getAddressValuesAt(
          ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MARKET_LIST")),
          0,
          marketCount
        );
        console.log("Markets:", markets);
      }
    } catch (_e) {
      console.log("Could not fetch markets");
    }
  }

  // Output frontend config
  console.log("\n=== Frontend Config (copy to nivo-demo/src/config.ts) ===\n");

  console.log(`// GMX Contract Addresses for Localhost (Chain ID 31337)`);
  console.log(`[CHAIN_IDS.HARDHAT_LOCAL]: {`);

  if (deployedAddresses.ExchangeRouter) {
    console.log(`  exchangeRouter: '${deployedAddresses.ExchangeRouter}',`);
  }
  if (deployedAddresses.OrderVault) {
    console.log(`  orderVault: '${deployedAddresses.OrderVault}',`);
  }
  if (deployedAddresses.DataStore) {
    console.log(`  dataStore: '${deployedAddresses.DataStore}',`);
  }
  if (deployedAddresses.Reader) {
    console.log(`  reader: '${deployedAddresses.Reader}',`);
  }
  if (deployedAddresses.MockPriceFeed) {
    console.log(`  mockPriceFeed: '${deployedAddresses.MockPriceFeed}',`);
  }
  console.log(`},`);

  console.log(`\n// USDC Address for Localhost`);
  if (deployedAddresses.USDC) {
    console.log(`[CHAIN_IDS.HARDHAT_LOCAL]: '${deployedAddresses.USDC}',`);
  }

  // Summary
  console.log("\n=== Summary ===\n");

  if (missingContracts.length === 0) {
    console.log("✅ All required contracts are deployed!");
  } else {
    console.log(`❌ Missing ${missingContracts.length} contracts:`);
    missingContracts.forEach((c) => console.log(`   - ${c}`));
    console.log("\nRun the following to deploy missing contracts:");
    console.log("  npm run local:deploy:all");
    console.log("  npm run local:grant-roles");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
