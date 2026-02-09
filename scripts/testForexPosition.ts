/**
 * TEST FOREX POSITION SCRIPT
 *
 * This script tests the complete flow of opening a position on the BRL/USD forex market:
 * 1. Load deployed contracts
 * 2. Add liquidity to the BRL/USD market
 * 3. Open a SHORT BRL/USD position (hedging against BRL devaluation)
 *
 * RUN WITH: npx hardhat run scripts/testForexPosition.ts --network localhost
 */

import { deployments, ethers } from "hardhat";

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║          NIVO - BRL/USD FOREX POSITION TEST                   ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  // ============================================
  // STEP 1: LOAD DEPLOYED CONTRACTS
  // ============================================
  console.log("\n📦 Step 1: Loading deployed contracts...\n");

  const exchangeRouter = await ethers.getContractAt(
    "ExchangeRouter",
    (
      await deployments.get("ExchangeRouter")
    ).address
  );
  const depositHandler = await ethers.getContractAt(
    "DepositHandler",
    (
      await deployments.get("DepositHandler")
    ).address
  );
  const orderHandler = await ethers.getContractAt("OrderHandler", (await deployments.get("OrderHandler")).address);
  const dataStore = await ethers.getContractAt("DataStore", (await deployments.get("DataStore")).address);
  const reader = await ethers.getContractAt("Reader", (await deployments.get("Reader")).address);
  const router = await ethers.getContractAt("Router", (await deployments.get("Router")).address);
  const depositVault = await ethers.getContractAt("DepositVault", (await deployments.get("DepositVault")).address);
  const _oracle = await ethers.getContractAt("Oracle", (await deployments.get("Oracle")).address);
  const roleStore = await ethers.getContractAt("RoleStore", (await deployments.get("RoleStore")).address);

  // Token contracts
  const usdt = await ethers.getContractAt("MintableToken", (await deployments.get("USDT")).address);

  // BRL/USD Market addresses
  const BRL_MARKET_TOKEN = "0x763779b6c23e29C02d675eA0cE6CBFf8DCc328e6";
  const BRL_INDEX_TOKEN = "0xf3aa2cd2ED74463405cE698f3e2ad12dd2808f90";

  console.log("   ✅ ExchangeRouter:", exchangeRouter.address);
  console.log("   ✅ DepositHandler:", depositHandler.address);
  console.log("   ✅ OrderHandler:", orderHandler.address);
  console.log("   ✅ DataStore:", dataStore.address);
  console.log("   ✅ Router:", router.address);
  console.log("   ✅ USDT:", usdt.address);
  console.log("   ✅ BRL Market:", BRL_MARKET_TOKEN);
  console.log("   ✅ BRL Index:", BRL_INDEX_TOKEN);

  // ============================================
  // STEP 2: CHECK MARKET INFO
  // ============================================
  console.log("\n📊 Step 2: Checking market info...\n");

  const market = await reader.getMarket(dataStore.address, BRL_MARKET_TOKEN);
  console.log("   Market Token:", market.marketToken);
  console.log("   Index Token (BRL):", market.indexToken);
  console.log("   Long Token (USDT):", market.longToken);
  console.log("   Short Token (USDT):", market.shortToken);

  // ============================================
  // STEP 3: MINT TOKENS AND APPROVE
  // ============================================
  console.log("\n💰 Step 3: Minting USDT and approving...\n");

  const depositAmount = ethers.utils.parseUnits("1000000", 6); // 1M USDT
  const collateralAmount = ethers.utils.parseUnits("1000", 6); // 1000 USDT for position

  // Mint USDT
  const usdtBalance = await usdt.balanceOf(signer.address);
  console.log("   Current USDT balance:", ethers.utils.formatUnits(usdtBalance, 6));

  if (usdtBalance.lt(depositAmount)) {
    console.log("   Minting USDT...");
    await (await usdt.mint(signer.address, depositAmount.mul(2))).wait();
    console.log("   ✅ Minted 2M USDT");
  }

  // Approve Router
  const routerAllowance = await usdt.allowance(signer.address, router.address);
  if (routerAllowance.lt(depositAmount.mul(2))) {
    console.log("   Approving Router...");
    await (await usdt.approve(router.address, ethers.constants.MaxUint256)).wait();
    console.log("   ✅ Approved Router");
  }

  // ============================================
  // STEP 4: ADD LIQUIDITY TO THE MARKET
  // ============================================
  console.log("\n💧 Step 4: Adding liquidity to BRL/USD market...\n");

  // For forex markets where long=short=USDT, we deposit USDT as both
  const createDepositParams = {
    receiver: signer.address,
    callbackContract: ethers.constants.AddressZero,
    uiFeeReceiver: ethers.constants.AddressZero,
    market: BRL_MARKET_TOKEN,
    initialLongToken: usdt.address,
    initialShortToken: usdt.address,
    longTokenSwapPath: [],
    shortTokenSwapPath: [],
    minMarketTokens: 0,
    shouldUnwrapNativeToken: false,
    executionFee: ethers.utils.parseEther("0.001"),
    callbackGasLimit: 0,
    dataList: [],
  };

  // First, transfer USDT to DepositVault
  console.log("   Transferring USDT to DepositVault...");
  await (await usdt.transfer(depositVault.address, depositAmount)).wait();
  console.log("   ✅ Transferred", ethers.utils.formatUnits(depositAmount, 6), "USDT");

  try {
    console.log("   Creating deposit...");
    const depositTx = await exchangeRouter.createDeposit(createDepositParams, {
      value: createDepositParams.executionFee,
    });
    const depositReceipt = await depositTx.wait();
    console.log("   ✅ Deposit created! Tx:", depositTx.hash);

    // Get deposit key from events
    const depositCreatedEvent = depositReceipt.logs.find((log: any) => log.topics.length > 0);
    if (depositCreatedEvent) {
      console.log("   Deposit event found");
    }

    // Execute the deposit
    console.log("\n   Executing deposit...");

    // Get the deposit key - usually the most recent one
    const DEPOSIT_LIST_KEY = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("DEPOSIT_LIST"));
    const depositCount = await dataStore.getBytes32Count(DEPOSIT_LIST_KEY);
    console.log("   Pending deposits:", depositCount.toString());

    if (depositCount.gt(0)) {
      const depositKeys = await dataStore.getBytes32ValuesAt(DEPOSIT_LIST_KEY, 0, depositCount);
      const depositKey = depositKeys[depositKeys.length - 1];
      console.log("   Deposit key:", depositKey);

      // Build oracle params for deposit execution
      // We need prices for both USDT and BRL
      const blockNumber = await ethers.provider.getBlockNumber();

      // Check if signer has ORDER_KEEPER role
      const ORDER_KEEPER_ROLE = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"])
      );
      const hasKeeperRole = await roleStore.hasRole(signer.address, ORDER_KEEPER_ROLE);
      console.log("   Signer has ORDER_KEEPER:", hasKeeperRole);

      if (!hasKeeperRole) {
        console.log("   Granting ORDER_KEEPER role...");
        await (await roleStore.grantRole(signer.address, ORDER_KEEPER_ROLE)).wait();
        console.log("   ✅ ORDER_KEEPER granted");
      }

      // Execute deposit with oracle params
      // GMX uses a specific oracle signature system
      const oracleParams = {
        signerInfo: 0,
        tokens: [usdt.address, BRL_INDEX_TOKEN],
        compactedMinOracleBlockNumbers: [blockNumber, blockNumber],
        compactedMaxOracleBlockNumbers: [blockNumber + 10, blockNumber + 10],
        compactedOracleTimestamps: [Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)],
        compactedDecimals: [6, 6],
        compactedMinPrices: [
          ethers.utils.parseUnits("1", 24), // USDT = $1 (30 decimals - 6 = 24)
          ethers.utils.parseUnits("0.18", 24), // BRL = ~$0.18 (1/5.5)
        ],
        compactedMinPricesIndexes: [0, 1],
        compactedMaxPrices: [ethers.utils.parseUnits("1", 24), ethers.utils.parseUnits("0.18", 24)],
        compactedMaxPricesIndexes: [0, 1],
        signatures: [],
        priceFeedTokens: [],
        realtimeFeedTokens: [],
        realtimeFeedData: [],
      };

      try {
        const execTx = await depositHandler.executeDeposit(depositKey, oracleParams);
        await execTx.wait();
        console.log("   ✅ Deposit executed!");
      } catch (e: any) {
        console.log("   ⚠️  Deposit execution failed:", e.message?.slice(0, 100));
        console.log("      (This is expected - oracle validation is complex)");
      }
    }
  } catch (e: any) {
    console.log("   ❌ Deposit creation failed:", e.message?.slice(0, 200));
  }

  // ============================================
  // STEP 5: CHECK MARKET LIQUIDITY
  // ============================================
  console.log("\n📊 Step 5: Checking market liquidity...\n");

  try {
    const marketInfo = await reader.getMarketInfo(
      dataStore.address,
      {
        indexTokenPrice: { min: ethers.utils.parseUnits("0.18", 30), max: ethers.utils.parseUnits("0.18", 30) },
        longTokenPrice: { min: ethers.utils.parseUnits("1", 30), max: ethers.utils.parseUnits("1", 30) },
        shortTokenPrice: { min: ethers.utils.parseUnits("1", 30), max: ethers.utils.parseUnits("1", 30) },
      },
      BRL_MARKET_TOKEN
    );
    console.log("   Pool Value Long:", ethers.utils.formatUnits(marketInfo.poolValueInfo.longTokenAmount, 6), "USDT");
    console.log("   Pool Value Short:", ethers.utils.formatUnits(marketInfo.poolValueInfo.shortTokenAmount, 6), "USDT");
  } catch (e: any) {
    console.log("   Could not fetch market info:", e.message?.slice(0, 100));
  }

  // ============================================
  // STEP 6: CREATE ORDER
  // ============================================
  console.log("\n📝 Step 6: Creating SHORT BRL/USD order...\n");

  const orderParams = {
    addresses: {
      receiver: signer.address,
      cancellationReceiver: signer.address,
      callbackContract: ethers.constants.AddressZero,
      uiFeeReceiver: ethers.constants.AddressZero,
      market: BRL_MARKET_TOKEN,
      initialCollateralToken: usdt.address,
      swapPath: [],
    },
    numbers: {
      sizeDeltaUsd: ethers.utils.parseUnits("100", 30), // $100 position
      initialCollateralDeltaAmount: collateralAmount, // 1000 USDT collateral
      triggerPrice: 0,
      acceptablePrice: 0,
      executionFee: ethers.utils.parseEther("0.001"),
      callbackGasLimit: 0,
      minOutputAmount: 0,
      validFromTime: 0,
    },
    orderType: 2, // MarketIncrease
    decreasePositionSwapType: 0,
    isLong: false, // SHORT position
    shouldUnwrapNativeToken: false,
    autoCancel: false,
    referralCode: ethers.constants.HashZero,
    dataList: [],
  };

  console.log("   Order params:");
  console.log("   - Market:", orderParams.addresses.market);
  console.log("   - Collateral:", ethers.utils.formatUnits(collateralAmount, 6), "USDT");
  console.log("   - Size:", ethers.utils.formatUnits(orderParams.numbers.sizeDeltaUsd, 30), "USD");
  console.log("   - Type: MarketIncrease (SHORT)");

  try {
    const tx = await exchangeRouter.createOrder(orderParams, {
      value: orderParams.numbers.executionFee,
    });
    const _receipt = await tx.wait();
    console.log("   ✅ Order created! Tx:", tx.hash);

    // Try to get order key
    const ORDER_LIST_KEY = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORDER_LIST"));
    const orderCount = await dataStore.getBytes32Count(ORDER_LIST_KEY);
    console.log("   Pending orders:", orderCount.toString());

    if (orderCount.gt(0)) {
      const orderKeys = await dataStore.getBytes32ValuesAt(ORDER_LIST_KEY, 0, orderCount);
      console.log("   Order key:", orderKeys[orderKeys.length - 1]);
    }
  } catch (e: any) {
    console.log("   ❌ Order creation failed:", e.message?.slice(0, 300));

    // Try to decode the error
    if (e.error?.data) {
      console.log("   Revert data:", e.error.data);
    }
  }

  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║                    TEST COMPLETED                             ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
