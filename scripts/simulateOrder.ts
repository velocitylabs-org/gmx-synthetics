import { deployments, ethers } from "hardhat";

/**
 * Enhanced order simulation script with comprehensive pre-flight checks.
 * This script validates all requirements before attempting to create an order.
 */
async function main() {
  console.log("=== GMX Order Simulation with Pre-Flight Checks ===\n");

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);
  console.log("Signer ETH balance:", ethers.utils.formatEther(await signer.getBalance()), "ETH\n");

  // =============================================
  // PHASE 1: Load Contract Addresses
  // =============================================
  console.log("=== Phase 1: Loading Contracts ===\n");

  let exchangeRouterAddress: string;
  let orderHandlerAddress: string;
  let orderVaultAddress: string;
  let routerAddress: string;
  let roleStoreAddress: string;
  let dataStoreAddress: string;
  let usdcAddress: string;
  let wethAddress: string;

  try {
    const exchangeRouterDeployment = await deployments.get("ExchangeRouter");
    exchangeRouterAddress = exchangeRouterDeployment.address;
    console.log("✅ ExchangeRouter:", exchangeRouterAddress);
  } catch {
    console.log("❌ ExchangeRouter NOT DEPLOYED");
    console.log("   Run: npm run local:deploy:all");
    process.exit(1);
  }

  try {
    const orderHandlerDeployment = await deployments.get("OrderHandler");
    orderHandlerAddress = orderHandlerDeployment.address;
    console.log("✅ OrderHandler:", orderHandlerAddress);
  } catch {
    console.log("❌ OrderHandler NOT DEPLOYED");
    process.exit(1);
  }

  try {
    const orderVaultDeployment = await deployments.get("OrderVault");
    orderVaultAddress = orderVaultDeployment.address;
    console.log("✅ OrderVault:", orderVaultAddress);
  } catch {
    console.log("❌ OrderVault NOT DEPLOYED");
    process.exit(1);
  }

  try {
    const routerDeployment = await deployments.get("Router");
    routerAddress = routerDeployment.address;
    console.log("✅ Router:", routerAddress);
  } catch {
    console.log("❌ Router NOT DEPLOYED");
    process.exit(1);
  }

  try {
    const roleStoreDeployment = await deployments.get("RoleStore");
    roleStoreAddress = roleStoreDeployment.address;
    console.log("✅ RoleStore:", roleStoreAddress);
  } catch {
    console.log("❌ RoleStore NOT DEPLOYED");
    process.exit(1);
  }

  try {
    const dataStoreDeployment = await deployments.get("DataStore");
    dataStoreAddress = dataStoreDeployment.address;
    console.log("✅ DataStore:", dataStoreAddress);
  } catch {
    console.log("❌ DataStore NOT DEPLOYED");
    process.exit(1);
  }

  // For forex markets, we use USDT as collateral
  let usdtAddress: string;
  try {
    const usdtDeployment = await deployments.get("USDT");
    usdtAddress = usdtDeployment.address;
    console.log("✅ USDT:", usdtAddress);
  } catch {
    console.log("❌ USDT NOT DEPLOYED");
    process.exit(1);
  }

  try {
    const usdcDeployment = await deployments.get("USDC");
    usdcAddress = usdcDeployment.address;
    console.log("✅ USDC:", usdcAddress);
  } catch {
    console.log("❌ USDC NOT DEPLOYED");
    process.exit(1);
  }

  try {
    try {
      const wethDeployment = await deployments.get("WETH");
      wethAddress = wethDeployment.address;
    } catch {
      const wntDeployment = await deployments.get("WNT");
      wethAddress = wntDeployment.address;
    }
    console.log("✅ WETH/WNT:", wethAddress);
  } catch {
    console.log("❌ WETH/WNT NOT DEPLOYED");
    process.exit(1);
  }

  // =============================================
  // PHASE 2: Check Roles
  // =============================================
  console.log("\n=== Phase 2: Checking Roles ===\n");

  const roleStore = await ethers.getContractAt("RoleStore", roleStoreAddress);
  const CONTROLLER_ROLE = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["CONTROLLER"]));
  const ROUTER_PLUGIN_ROLE = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ROUTER_PLUGIN"]));

  // Check ExchangeRouter has CONTROLLER
  const erHasController = await roleStore.hasRole(exchangeRouterAddress, CONTROLLER_ROLE);
  if (erHasController) {
    console.log("✅ ExchangeRouter has CONTROLLER role");
  } else {
    console.log("❌ ExchangeRouter MISSING CONTROLLER role");
    console.log("   This is the main cause of 'Gas estimation failed' errors!");
    console.log("   Run: npm run local:grant-roles");
  }

  // Check ExchangeRouter has ROUTER_PLUGIN
  const erHasRouterPlugin = await roleStore.hasRole(exchangeRouterAddress, ROUTER_PLUGIN_ROLE);
  if (erHasRouterPlugin) {
    console.log("✅ ExchangeRouter has ROUTER_PLUGIN role");
  } else {
    console.log("❌ ExchangeRouter MISSING ROUTER_PLUGIN role");
    console.log("   Run: npm run local:grant-roles");
  }

  // Check OrderHandler has CONTROLLER
  const ohHasController = await roleStore.hasRole(orderHandlerAddress, CONTROLLER_ROLE);
  if (ohHasController) {
    console.log("✅ OrderHandler has CONTROLLER role");
  } else {
    console.log("❌ OrderHandler MISSING CONTROLLER role");
    console.log("   Run: npm run local:grant-roles");
  }

  // =============================================
  // PHASE 3: Check USDT Balance and Allowance (for forex markets)
  // =============================================
  console.log("\n=== Phase 3: Checking USDT Balance/Allowance ===\n");

  const usdt = await ethers.getContractAt("IERC20Metadata", usdtAddress);
  const amount = ethers.utils.parseUnits("100", 6); // 100 USDT

  const balance = await usdt.balanceOf(signer.address);
  console.log("USDT Balance:", ethers.utils.formatUnits(balance, 6), "USDT");

  if (balance.lt(amount)) {
    console.log("⚠️  Insufficient USDT balance. Need 100 USDT.");
    console.log("   Minting test tokens...");

    // Try to mint USDT (test tokens should have mint function)
    try {
      const usdtMintable = await ethers.getContractAt(
        ["function mint(address to, uint256 amount) external"],
        usdtAddress
      );
      const mintTx = await usdtMintable.mint(signer.address, ethers.utils.parseUnits("10000", 6));
      await mintTx.wait();
      console.log("✅ Minted 10,000 USDT");
    } catch (e: any) {
      console.log("❌ Could not mint USDT:", e.message?.slice(0, 50));
    }
  } else {
    console.log("✅ Sufficient USDT balance");
  }

  // Check/Set allowance for Router (not ExchangeRouter - Router does the transfer)
  const currentAllowance = await usdt.allowance(signer.address, routerAddress);
  console.log("USDT Allowance for Router:", ethers.utils.formatUnits(currentAllowance, 6), "USDT");

  if (currentAllowance.lt(amount)) {
    console.log("Setting USDT approval for Router...");
    const approveTx = await usdt.approve(routerAddress, ethers.constants.MaxUint256);
    await approveTx.wait();
    console.log("✅ Approved Router to spend USDT");
  } else {
    console.log("✅ Sufficient allowance");
  }

  // =============================================
  // PHASE 4: Check Market Configuration
  // =============================================
  console.log("\n=== Phase 4: Checking Market Configuration ===\n");

  const _dataStore = await ethers.getContractAt("DataStore", dataStoreAddress);

  // Use the BRL/USD forex market (uses USDT as collateral)
  // Created by deployAndConfigureMarkets.ts from config/markets.ts
  const marketAddress = "0x763779b6c23e29C02d675eA0cE6CBFf8DCc328e6"; // BRL/USD market
  console.log("Using BRL/USD market at:", marketAddress);

  // Get market count via Reader
  const readerDeployment = await deployments.get("Reader");
  const reader = await ethers.getContractAt("Reader", readerDeployment.address);
  const markets = await reader.getMarkets(dataStoreAddress, 0, 100);
  console.log("Total markets:", markets.length);

  // =============================================
  // PHASE 5: Prepare and Execute Order
  // =============================================
  console.log("\n=== Phase 5: Creating Order ===\n");

  const executionFee = ethers.utils.parseUnits("0.01", 18); // 0.01 ETH - higher for safety
  const sizeDeltaUsd = ethers.utils.parseUnits("100", 30); // $100 position

  const exchangeRouter = await ethers.getContractAt("ExchangeRouter", exchangeRouterAddress);

  const params = {
    addresses: {
      receiver: signer.address,
      cancellationReceiver: signer.address,
      callbackContract: ethers.constants.AddressZero,
      uiFeeReceiver: ethers.constants.AddressZero,
      market: marketAddress,
      initialCollateralToken: usdtAddress, // USDT for forex markets
      swapPath: [],
    },
    numbers: {
      sizeDeltaUsd: sizeDeltaUsd,
      initialCollateralDeltaAmount: amount,
      triggerPrice: 0,
      acceptablePrice: 0, // For market orders, 0 means any price
      executionFee: executionFee,
      callbackGasLimit: 0,
      minOutputAmount: 0,
      validFromTime: 0,
    },
    orderType: 2, // MarketIncrease
    decreasePositionSwapType: 0, // NoSwap
    isLong: false, // Short position
    shouldUnwrapNativeToken: false,
    autoCancel: false,
    referralCode: ethers.constants.HashZero,
    dataList: [],
  };

  console.log("Order Parameters:");
  console.log("  Market:", params.addresses.market, "(BRL/USD)");
  console.log("  Collateral:", params.addresses.initialCollateralToken, "(USDT)");
  console.log("  Size (USD):", ethers.utils.formatUnits(params.numbers.sizeDeltaUsd, 30));
  console.log("  Collateral Amount:", ethers.utils.formatUnits(params.numbers.initialCollateralDeltaAmount, 6), "USDT");
  console.log("  Order Type:", params.orderType, "(MarketIncrease)");
  console.log("  Is Long:", params.isLong, "(Short BRL/USD position)");
  console.log("  Execution Fee:", ethers.utils.formatEther(params.numbers.executionFee), "ETH");

  // The GMX flow requires:
  // 1. Transfer collateral to OrderVault first (via sendTokens)
  // 2. Transfer execution fee as WETH (via sendWnt with ETH value)
  // 3. Then call createOrder (no value needed)
  // These are typically done in a multicall

  console.log("\nStep 1: Sending collateral to OrderVault via sendTokens...");
  try {
    const sendTokensTx = await exchangeRouter.sendTokens(usdtAddress, orderVaultAddress, amount);
    await sendTokensTx.wait();
    console.log("✅ Collateral sent to OrderVault");
  } catch (e: any) {
    console.log("❌ Failed to send tokens:", e.message?.slice(0, 100));
    throw e;
  }

  console.log("\nStep 2: Sending execution fee (WETH) to OrderVault via sendWnt...");
  try {
    const sendWntTx = await exchangeRouter.sendWnt(orderVaultAddress, executionFee, {
      value: executionFee,
      gasLimit: 500000, // Override gas limit to see actual error
    });
    await sendWntTx.wait();
    console.log("✅ Execution fee (WETH) sent to OrderVault");
  } catch (e: any) {
    console.log("❌ Failed to send WNT:", e.message?.slice(0, 200));
    console.log("Error data:", e.error?.data || e.data);
    throw e;
  }

  console.log("\nStep 3: Creating order...");

  try {
    const tx = await exchangeRouter.createOrder(params);
    console.log("Tx hash:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Order created in block:", receipt.blockNumber);
    console.log("   Gas used:", receipt.gasUsed.toString());

    // Look for OrderCreated event
    console.log("\nTransaction events:");
    for (const log of receipt.logs) {
      console.log("  Log:", log.address, log.topics[0]?.slice(0, 10));
    }
  } catch (error: any) {
    console.log("\n❌ ORDER CREATION FAILED\n");
    console.log("=== Error Details ===");

    if (error.reason) {
      console.log("Reason:", error.reason);
    }

    if (error.error?.message) {
      console.log("Error message:", error.error.message);
    }

    if (error.message) {
      // Parse common error patterns
      const msg = error.message;

      if (msg.includes("Unauthorized")) {
        console.log("\n🔑 DIAGNOSIS: Missing role permission");
        console.log("   The ExchangeRouter or OrderHandler is missing CONTROLLER role.");
        console.log("   FIX: Run 'npm run local:grant-roles'");
      } else if (msg.includes("EmptyMarket")) {
        console.log("\n📊 DIAGNOSIS: Invalid market");
        console.log("   The market address is not configured in DataStore.");
        console.log("   FIX: Run 'npm run local:create-market'");
      } else if (msg.includes("InsufficientBalance")) {
        console.log("\n💰 DIAGNOSIS: Insufficient collateral");
        console.log("   The signer doesn't have enough USDC.");
      } else if (msg.includes("InsufficientAllowance")) {
        console.log("\n🔓 DIAGNOSIS: Insufficient allowance");
        console.log("   USDC approval for Router is insufficient.");
      } else {
        console.log("\nFull error message:");
        console.log(msg.slice(0, 500));
      }
    }

    // Try to decode revert data
    if (error.data) {
      console.log("\nRevert data:", error.data);
    }
  }

  console.log("\n=== Simulation Complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
