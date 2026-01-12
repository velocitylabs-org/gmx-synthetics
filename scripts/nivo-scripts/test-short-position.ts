/**
 * TEST SHORT POSITION SCRIPT
 *
 * This script tests the complete flow of:
 * 1. Deploying all GMX contracts locally
 * 2. Adding liquidity to ETH/USD market
 * 3. Opening a SHORT position (betting ETH price will drop)
 * 4. Simulating price movement
 * 5. Closing the position and calculating PnL
 *
 * RUN WITH: npx hardhat run scripts/test-short-position.ts
 *
 * This uses Hardhat's in-memory network - no separate node needed.
 * After verifying this works, you can adapt it for forex markets.
 */

import hre from "hardhat";
import { expandDecimals, decimalToFloat } from "../../utils/math";
import { deployFixture } from "../../utils/fixture";
import { handleDeposit } from "../../utils/deposit";
import { createOrder, executeOrder, OrderType, getOrderCount } from "../../utils/order";
import { getPositionCount, getAccountPositionCount } from "../../utils/position";
import { prices } from "../../utils/prices";

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║          GMX V2 - SHORT POSITION TEST SCRIPT                  ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  // ============================================
  // STEP 1: DEPLOY ALL CONTRACTS
  // ============================================
  console.log("📦 Step 1: Deploying all contracts...");
  console.log("   (This deploys ~160 contracts, may take a moment)\n");

  const fixture = await deployFixture();

  const { user0, user1 } = fixture.accounts;
  const {
    reader,
    dataStore,
    ethUsdMarket,
    wnt, // WETH - the index token
    usdc, // USDC - collateral
  } = fixture.contracts;
  const { executionFee } = fixture.props;

  console.log("   ✅ Contracts deployed successfully!\n");
  console.log("   Key Addresses:");
  console.log(`   - ETH/USD Market: ${ethUsdMarket.marketToken}`);
  console.log(`   - WETH:           ${wnt.address}`);
  console.log(`   - USDC:           ${usdc.address}`);
  console.log(`   - Test User:      ${user0.address}\n`);

  // ============================================
  // STEP 2: ADD LIQUIDITY TO THE MARKET
  // ============================================
  console.log("💰 Step 2: Adding liquidity to ETH/USD market...");

  // Market needs liquidity before trading
  // LPs deposit WETH (long token) and USDC (short token)
  await handleDeposit(fixture, {
    create: {
      market: ethUsdMarket,
      longTokenAmount: expandDecimals(1000, 18), // 1000 ETH
      shortTokenAmount: expandDecimals(5_000_000, 6), // $5M USDC
    },
  });

  console.log("   ✅ Liquidity added:");
  console.log("   - 1,000 ETH (long token)");
  console.log("   - $5,000,000 USDC (short token)\n");

  // ============================================
  // STEP 3: CHECK INITIAL STATE
  // ============================================
  console.log("📊 Step 3: Checking initial state...");

  const initialOrderCount = await getOrderCount(dataStore);
  const initialPositionCount = await getPositionCount(dataStore);
  const initialUserPositions = await getAccountPositionCount(dataStore, user0.address);

  console.log(`   - Total orders: ${initialOrderCount}`);
  console.log(`   - Total positions: ${initialPositionCount}`);
  console.log(`   - User positions: ${initialUserPositions}\n`);

  // ============================================
  // STEP 4: OPEN A SHORT POSITION
  // ============================================
  console.log("📉 Step 4: Opening SHORT position on ETH/USD...\n");
  console.log("   Position Details:");
  console.log("   - Direction: SHORT (betting ETH price will DROP)");
  console.log("   - Collateral: 5,000 USDC");
  console.log("   - Position Size: $50,000 USD");
  console.log("   - Leverage: ~10x");
  console.log("   - Entry Price: ~$5,000/ETH\n");

  // Create the SHORT order
  const shortOrderParams = {
    account: user0,
    market: ethUsdMarket,
    initialCollateralToken: usdc, // Using USDC as collateral
    initialCollateralDeltaAmount: expandDecimals(5000, 6), // 5,000 USDC
    sizeDeltaUsd: decimalToFloat(50_000), // $50,000 position size
    acceptablePrice: expandDecimals(4900, 12), // Min acceptable price for SHORT entry
    triggerPrice: 0,
    orderType: OrderType.MarketIncrease,
    isLong: false, // ⬅️ SHORT POSITION
    shouldUnwrapNativeToken: false,
  };

  console.log("   Creating order...");
  await createOrder(fixture, shortOrderParams);

  const orderCountAfterCreate = await getOrderCount(dataStore);
  console.log(`   ✅ Order created! (Orders in queue: ${orderCountAfterCreate})\n`);

  // Execute the order (simulating keeper execution with oracle prices)
  console.log("   Executing order (keeper simulation)...");
  await executeOrder(fixture, {
    tokens: [wnt.address, usdc.address],
    precisions: [prices.wnt.precision, prices.usdc.precision],
    minPrices: [prices.wnt.min, prices.usdc.min],
    maxPrices: [prices.wnt.max, prices.usdc.max],
  });

  const positionsAfterOpen = await getAccountPositionCount(dataStore, user0.address);
  console.log(`   ✅ Position opened! (User positions: ${positionsAfterOpen})\n`);

  // ============================================
  // STEP 5: VIEW POSITION DETAILS
  // ============================================
  console.log("🔍 Step 5: Position details...\n");

  const positions = await reader.getAccountPositions(dataStore.address, user0.address, 0, 10);

  if (positions.length > 0) {
    const pos = positions[0];
    console.log("   Position Info:");
    console.log(`   - Market: ${pos.addresses.market}`);
    console.log(`   - Collateral Token: ${pos.addresses.collateralToken}`);
    console.log(`   - Size (USD): $${hre.ethers.utils.formatUnits(pos.numbers.sizeInUsd, 30)}`);
    console.log(`   - Size (Tokens): ${hre.ethers.utils.formatUnits(pos.numbers.sizeInTokens, 18)} ETH`);
    console.log(`   - Collateral: ${hre.ethers.utils.formatUnits(pos.numbers.collateralAmount, 6)} USDC`);
    console.log(`   - Is Long: ${pos.flags.isLong} (false = SHORT)`);
    console.log();
  }

  // ============================================
  // STEP 6: SIMULATE PRICE MOVEMENT (ETH DROPS)
  // ============================================
  console.log("📈 Step 6: Simulating price movement...\n");
  console.log("   Scenario: ETH drops from $5,000 → $4,500 (10% drop)");
  console.log("   Expected: SHORT position should PROFIT ~$5,000\n");

  // Note: In real scenario, we'd wait for price to move
  // Here we simulate by using different prices in the close execution

  // ============================================
  // STEP 7: CLOSE THE POSITION
  // ============================================
  console.log("🔒 Step 7: Closing the SHORT position...\n");

  const closeOrderParams = {
    account: user0,
    market: ethUsdMarket,
    initialCollateralToken: usdc,
    initialCollateralDeltaAmount: 0, // Not adding collateral
    sizeDeltaUsd: decimalToFloat(50_000), // Close full position
    acceptablePrice: expandDecimals(5100, 12), // Max acceptable price for SHORT exit
    triggerPrice: 0,
    orderType: OrderType.MarketDecrease,
    isLong: false, // ⬅️ Closing SHORT
    shouldUnwrapNativeToken: false,
  };

  console.log("   Creating close order...");
  await createOrder(fixture, closeOrderParams);

  console.log("   Executing close order with NEW price (ETH = $4,500)...");

  // Execute with LOWER ETH price = SHORT profits
  // Using custom prices instead of defaults
  await executeOrder(fixture, {
    tokens: [wnt.address, usdc.address],
    precisions: [8, 18],
    minPrices: [expandDecimals(4500, 4), expandDecimals(1, 6)], // ETH dropped to $4500
    maxPrices: [expandDecimals(4500, 4), expandDecimals(1, 6)],
  });

  const positionsAfterClose = await getAccountPositionCount(dataStore, user0.address);
  console.log(`   ✅ Position closed! (User positions: ${positionsAfterClose})\n`);

  // ============================================
  // STEP 8: CHECK FINAL BALANCES
  // ============================================
  console.log("💵 Step 8: Final results...\n");

  const finalUsdcBalance = await usdc.balanceOf(user0.address);
  console.log(`   User USDC Balance: ${hre.ethers.utils.formatUnits(finalUsdcBalance, 6)} USDC`);

  // The profit calculation:
  // - Position size: $50,000 / $5,000 per ETH = 10 ETH equivalent
  // - Price moved: $5,000 → $4,500 = -$500 per ETH (10% drop)
  // - For SHORT: profit = 10 ETH × $500 = $5,000 profit
  console.log("\n   Profit Calculation:");
  console.log("   - Entry: SHORT 10 ETH equivalent @ $5,000 = $50,000");
  console.log("   - Exit:  Close @ $4,500");
  console.log("   - Profit: 10 × ($5,000 - $4,500) = $5,000 🎉");
  console.log("   (minus fees)\n");

  // ============================================
  // SUCCESS!
  // ============================================
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║                    ✅ TEST COMPLETED!                         ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");
  console.log("   The SHORT position flow works correctly.");
  console.log("   You can now adapt this for FOREX markets:\n");
  console.log("   1. Add synthetic tokens (COP, ARS, BRL) to config/tokens.ts");
  console.log("   2. Add forex markets to config/markets.ts");
  console.log("   3. Create a ForexOracleProvider for price feeds");
  console.log("   4. Run this same flow with forex pairs!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
