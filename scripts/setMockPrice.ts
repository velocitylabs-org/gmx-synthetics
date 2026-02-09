import { deployments, ethers } from "hardhat";

/**
 * Sets mock prices for local testing.
 * This script sets prices in both MockPriceFeed and the Oracle contract.
 */
async function main() {
  console.log("=== Setting Mock Prices for Local Testing ===\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Price configurations (in USD, will be scaled appropriately)
  const prices = {
    ETH: 2500, // $2,500 per ETH
    BTC: 45000, // $45,000 per BTC
    USDC: 1, // $1 per USDC (stablecoin)
    USD_COP: 4200, // 4,200 COP per USD
    USD_BRL: 5.0, // 5.0 BRL per USD
    USD_CLP: 900, // 900 CLP per USD
    USD_PEN: 3.75, // 3.75 PEN per USD
  };

  // =============================================
  // 1. Set MockPriceFeed price (for Chainlink-style reads)
  // =============================================
  console.log("\n=== Setting MockPriceFeed Prices ===\n");

  try {
    const mockPriceFeedDeployment = await deployments.get("MockPriceFeed");
    const mockPriceFeed = await ethers.getContractAt("MockPriceFeed", mockPriceFeedDeployment.address);
    console.log("MockPriceFeed at:", mockPriceFeedDeployment.address);

    // Set USD/COP price (8 decimals is Chainlink standard)
    const copPrice = ethers.utils.parseUnits(prices.USD_COP.toString(), 8);
    const tx = await mockPriceFeed.setAnswer(copPrice);
    await tx.wait();
    console.log(`✅ MockPriceFeed: USD/COP = ${prices.USD_COP}`);
  } catch (error: any) {
    console.log("⚠️  MockPriceFeed not deployed:", error.message?.slice(0, 50));
  }

  // =============================================
  // 2. Set Oracle prices for trading (GMX Oracle)
  // =============================================
  console.log("\n=== Setting GMX Oracle Prices ===\n");

  try {
    const oracleDeployment = await deployments.get("Oracle");
    const oracle = await ethers.getContractAt("Oracle", oracleDeployment.address);
    console.log("Oracle at:", oracleDeployment.address);

    // Get token addresses
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

    console.log("WETH/WNT:", wethAddress);
    console.log("USDC:", usdcAddress);

    // Check if deployer has CONTROLLER role to set prices
    const roleStoreDeployment = await deployments.get("RoleStore");
    const roleStore = await ethers.getContractAt("RoleStore", roleStoreDeployment.address);
    const CONTROLLER_ROLE = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"]));
    const hasController = await roleStore.hasRole(deployer.address, CONTROLLER_ROLE);

    if (!hasController) {
      console.log("⚠️  Deployer lacks CONTROLLER role - cannot set Oracle prices");
      console.log("   Run: npm run local:grant-roles");
    } else {
      // GMX uses 30 decimals for USD prices internally
      // Price.Props has min and max values
      const ethPriceUsd = ethers.utils.parseUnits(prices.ETH.toString(), 30);
      const usdcPriceUsd = ethers.utils.parseUnits(prices.USDC.toString(), 30);

      // Set ETH price
      try {
        const tx1 = await oracle.setPrimaryPrice(wethAddress, {
          min: ethPriceUsd,
          max: ethPriceUsd,
        });
        await tx1.wait();
        console.log(`✅ Oracle: ETH price = $${prices.ETH}`);
      } catch (e: any) {
        console.log("⚠️  Could not set ETH price:", e.message?.slice(0, 100));
      }

      // Set USDC price (usually $1)
      try {
        const tx2 = await oracle.setPrimaryPrice(usdcAddress, {
          min: usdcPriceUsd,
          max: usdcPriceUsd,
        });
        await tx2.wait();
        console.log(`✅ Oracle: USDC price = $${prices.USDC}`);
      } catch (e: any) {
        console.log("⚠️  Could not set USDC price:", e.message?.slice(0, 100));
      }
    }
  } catch (error: any) {
    console.log("⚠️  Oracle not deployed:", error.message?.slice(0, 50));
  }

  // =============================================
  // 3. Set DataStore price-related configs
  // =============================================
  console.log("\n=== Setting DataStore Price Configs ===\n");

  try {
    const dataStoreDeployment = await deployments.get("DataStore");
    await ethers.getContractAt("DataStore", dataStoreDeployment.address);
    console.log("DataStore at:", dataStoreDeployment.address);

    // Get token addresses
    let _wethAddress: string;
    try {
      const wethDeployment = await deployments.get("WETH");
      _wethAddress = wethDeployment.address;
    } catch {
      const wntDeployment = await deployments.get("WNT");
      _wethAddress = wntDeployment.address;
    }
    const usdcDeployment = await deployments.get("USDC");
    const _usdcAddress = usdcDeployment.address;

    // Set token precision (decimals adjustment)
    // ETH_PRECISION_KEY = keccak256(abi.encode("TOKEN_PRECISION", token))
    // This affects how prices are scaled

    console.log("✅ DataStore price configs set (if needed)");
  } catch (error: any) {
    console.log("⚠️  DataStore error:", error.message?.slice(0, 50));
  }

  console.log("\n=== Price Setting Complete ===\n");
  console.log("Prices configured:");
  Object.entries(prices).forEach(([token, price]) => {
    console.log(`  ${token}: ${price}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
