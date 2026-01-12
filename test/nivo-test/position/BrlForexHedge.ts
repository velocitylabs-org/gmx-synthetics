/**
 * ============================================================================
 * BRL/USD FOREX HEDGING TESTS
 * ============================================================================
 *
 * These tests validate hedging scenarios for the BRL/USD forex market:
 *
 * SCENARIO 1: SHORT BRL/USD - Hedge against BRL DEVALUATION
 *   - Use case: Brazilian user with BRL savings fears currency crash
 *   - Action: Open SHORT position on BRL/USD
 *   - If BRL drops: Position profits, offsetting real-world savings loss
 *
 * SCENARIO 2: LONG BRL/USD - Hedge against BRL APPRECIATION
 *   - Use case: US company with future BRL payments fears BRL getting stronger
 *   - Action: Open LONG position on BRL/USD
 *   - If BRL rises: Position profits, offsetting increased payment cost
 *
 * ============================================================================
 */

import { expect } from "chai";
import { deployFixture } from "../../../utils/fixture";
import { handleDeposit } from "../../../utils/deposit";
import { createOrder, executeOrder, OrderType, getOrderCount } from "../../../utils/order";
import { getPositionCount, getAccountPositionCount } from "../../../utils/position";
import { expandDecimals, decimalToFloat } from "../../../utils/math";
import { prices } from "../../../utils/prices";
import hre from "hardhat";

describe("BRL/USD Forex Hedging", () => {
  let fixture;
  let dataStore, reader, brlUsdMarket, brl, usdc;
  let user0, user1;

  beforeEach(async () => {
    fixture = await deployFixture();
    ({ dataStore, reader, brlUsdMarket, brl, usdc } = fixture.contracts);
    ({ user0, user1 } = fixture.accounts);

    // Seed liquidity into BRL/USD market
    // $5M total liquidity for trading
    await handleDeposit(fixture, {
      create: {
        market: brlUsdMarket,
        longTokenAmount: expandDecimals(2_500_000, 6), // 2.5M USDC
        shortTokenAmount: expandDecimals(2_500_000, 6), // 2.5M USDC
      },
      execute: {
        tokens: [brl.address, usdc.address],
        precisions: [prices.brl.precision, prices.usdc.precision],
        minPrices: [prices.brl.min, prices.usdc.min],
        maxPrices: [prices.brl.max, prices.usdc.max],
      },
    });
  });

  // ============================================================================
  // SCENARIO 1: SHORT BRL/USD - Hedge against BRL Devaluation
  // ============================================================================
  describe("SHORT BRL/USD - Hedge against BRL Devaluation", () => {
    /**
     * SCENARIO:
     * - Brazilian user has savings worth $10,000 in BRL
     * - Current rate: 1 BRL = $0.16 USD (62,500 BRL)
     * - Fears BRL will devalue to $0.14 (12.5% drop)
     * - Opens SHORT position to hedge
     *
     * EXPECTED OUTCOME:
     * - If BRL drops 12.5%: Real savings lose ~$1,250
     * - SHORT position gains ~$1,250
     * - Net effect: Hedged (protected from loss)
     */
    it("should profit from SHORT when BRL devalues", async () => {
      // Initial state
      const initialPositionCount = await getAccountPositionCount(dataStore, user0.address);
      expect(initialPositionCount).to.equal(0);

      // Open SHORT position
      // - Collateral: 1,000 USDC
      // - Size: $10,000 (10x leverage)
      // - Direction: SHORT (betting BRL drops)
      await createOrder(fixture, {
        account: user0,
        market: brlUsdMarket,
        initialCollateralToken: usdc,
        initialCollateralDeltaAmount: expandDecimals(1000, 6), // 1,000 USDC
        sizeDeltaUsd: decimalToFloat(10_000), // $10,000 position
        acceptablePrice: expandDecimals(1, 21), // Min price for SHORT entry
        triggerPrice: 0,
        orderType: OrderType.MarketIncrease,
        isLong: false, // SHORT
        shouldUnwrapNativeToken: false,
      });

      // Execute order at BRL = $0.16
      await executeOrder(fixture, {
        tokens: [brl.address, usdc.address],
        precisions: [prices.brl.precision, prices.usdc.precision],
        minPrices: [prices.brl.min, prices.usdc.min],
        maxPrices: [prices.brl.max, prices.usdc.max],
      });

      // Verify position opened
      const positionCountAfterOpen = await getAccountPositionCount(dataStore, user0.address);
      expect(positionCountAfterOpen).to.equal(1);

      // Read position details
      const positions = await reader.getAccountPositions(dataStore.address, user0.address, 0, 10);
      expect(positions.length).to.equal(1);

      const position = positions[0];
      expect(position.flags.isLong).to.equal(false); // Confirm SHORT

      // Position size should be ~$10,000
      const sizeInUsd = hre.ethers.utils.formatUnits(position.numbers.sizeInUsd, 30);
      expect(Number(sizeInUsd)).to.be.closeTo(10000, 100); // Allow small variance for fees

      // Now simulate BRL devaluation: $0.16 → $0.14 (12.5% drop)
      // Close position at new lower price
      await createOrder(fixture, {
        account: user0,
        market: brlUsdMarket,
        initialCollateralToken: usdc,
        initialCollateralDeltaAmount: 0,
        sizeDeltaUsd: decimalToFloat(10_000), // Close full position
        acceptablePrice: expandDecimals(2, 22), // Max price for SHORT exit
        triggerPrice: 0,
        orderType: OrderType.MarketDecrease,
        isLong: false,
        shouldUnwrapNativeToken: false,
      });

      // Get user balance before close
      const balanceBeforeClose = await usdc.balanceOf(user0.address);

      // Execute close at BRL = $0.14 (decreased price)
      await executeOrder(fixture, {
        tokens: [brl.address, usdc.address],
        precisions: [prices.brl.precision, prices.usdc.precision],
        minPrices: [prices.brl.decreased.min, prices.usdc.min],
        maxPrices: [prices.brl.decreased.max, prices.usdc.max],
      });

      // Verify position closed
      const positionCountAfterClose = await getAccountPositionCount(dataStore, user0.address);
      expect(positionCountAfterClose).to.equal(0);

      // Get user balance after close
      const balanceAfterClose = await usdc.balanceOf(user0.address);

      // Calculate profit
      const profit = balanceAfterClose.sub(balanceBeforeClose);
      const profitUsd = Number(hre.ethers.utils.formatUnits(profit, 6));

      console.log("\n=== SHORT BRL/USD Hedge Results ===");
      console.log(`Entry Price: $0.16/BRL`);
      console.log(`Exit Price: $0.14/BRL (-12.5%)`);
      console.log(`Position Size: $10,000`);
      console.log(`Profit: $${profitUsd.toFixed(2)} USDC`);

      // Expected profit calculation:
      // Position size in BRL = $10,000 / $0.16 = 62,500 BRL
      // Price change = $0.16 - $0.14 = $0.02 per BRL
      // Profit = 62,500 × $0.02 = $1,250 (minus fees)
      // Should be profitable (greater than collateral returned)
      expect(profitUsd).to.be.greaterThan(1000); // At least collateral back + some profit
    });

    it("should lose from SHORT when BRL appreciates", async () => {
      // Open SHORT position with MORE collateral to avoid liquidation
      // With 10x leverage, a 12.5% adverse move can exceed collateral
      // Use 5x leverage instead (2000 collateral, 10000 size)
      await createOrder(fixture, {
        account: user0,
        market: brlUsdMarket,
        initialCollateralToken: usdc,
        initialCollateralDeltaAmount: expandDecimals(2000, 6), // 2x more collateral
        sizeDeltaUsd: decimalToFloat(10_000),
        acceptablePrice: expandDecimals(1, 21),
        triggerPrice: 0,
        orderType: OrderType.MarketIncrease,
        isLong: false,
        shouldUnwrapNativeToken: false,
      });

      // Execute at BRL = $0.16
      await executeOrder(fixture, {
        tokens: [brl.address, usdc.address],
        precisions: [prices.brl.precision, prices.usdc.precision],
        minPrices: [prices.brl.min, prices.usdc.min],
        maxPrices: [prices.brl.max, prices.usdc.max],
      });

      // Close position when BRL INCREASES to $0.18
      await createOrder(fixture, {
        account: user0,
        market: brlUsdMarket,
        initialCollateralToken: usdc,
        initialCollateralDeltaAmount: 0,
        sizeDeltaUsd: decimalToFloat(10_000),
        acceptablePrice: expandDecimals(3, 22), // Higher max price for loss scenario
        triggerPrice: 0,
        orderType: OrderType.MarketDecrease,
        isLong: false,
        shouldUnwrapNativeToken: false,
      });

      const balanceBeforeClose = await usdc.balanceOf(user0.address);

      // Execute close at BRL = $0.18 (increased price - bad for SHORT)
      await executeOrder(fixture, {
        tokens: [brl.address, usdc.address],
        precisions: [prices.brl.precision, prices.usdc.precision],
        minPrices: [prices.brl.increased.min, prices.usdc.min],
        maxPrices: [prices.brl.increased.max, prices.usdc.max],
      });

      const balanceAfterClose = await usdc.balanceOf(user0.address);
      const pnl = balanceAfterClose.sub(balanceBeforeClose);
      const pnlUsd = Number(hre.ethers.utils.formatUnits(pnl, 6));

      console.log("\n=== SHORT BRL/USD Loss Scenario ===");
      console.log(`Entry Price: $0.16/BRL`);
      console.log(`Exit Price: $0.18/BRL (+12.5%)`);
      console.log(`PnL: $${pnlUsd.toFixed(2)} USDC`);

      // SHORT loses when price goes UP
      // Position size in BRL = $10,000 / $0.16 = 62,500 BRL
      // Price change = $0.18 - $0.16 = $0.02 per BRL (against us)
      // Loss = 62,500 × $0.02 = $1,250
      // Returned amount (collateral - loss) should be less than initial collateral
      expect(pnlUsd).to.be.lessThan(2000); // Less than original 2000 collateral
      expect(pnlUsd).to.be.greaterThan(500); // But should get some back
    });
  });

  // ============================================================================
  // SCENARIO 2: LONG BRL/USD - Hedge against BRL Appreciation
  // ============================================================================
  describe("LONG BRL/USD - Hedge against BRL Appreciation", () => {
    /**
     * SCENARIO:
     * - US company needs to pay Brazilian supplier in 3 months
     * - Payment: 62,500 BRL (currently ~$10,000 at $0.16/BRL)
     * - Fears BRL will strengthen to $0.18 (payment becomes $11,250)
     * - Opens LONG position to hedge
     *
     * EXPECTED OUTCOME:
     * - If BRL rises 12.5%: Payment cost increases by ~$1,250
     * - LONG position gains ~$1,250
     * - Net effect: Hedged (locked in current cost)
     */
    it("should profit from LONG when BRL appreciates", async () => {
      const initialPositionCount = await getAccountPositionCount(dataStore, user1.address);
      expect(initialPositionCount).to.equal(0);

      // Open LONG position
      // - Collateral: 1,000 USDC
      // - Size: $10,000 (10x leverage)
      // - Direction: LONG (betting BRL rises)
      await createOrder(fixture, {
        account: user1,
        market: brlUsdMarket,
        initialCollateralToken: usdc,
        initialCollateralDeltaAmount: expandDecimals(1000, 6),
        sizeDeltaUsd: decimalToFloat(10_000),
        acceptablePrice: expandDecimals(3, 22), // Max price for LONG entry
        triggerPrice: 0,
        orderType: OrderType.MarketIncrease,
        isLong: true, // LONG
        shouldUnwrapNativeToken: false,
      });

      // Execute order at BRL = $0.16
      await executeOrder(fixture, {
        tokens: [brl.address, usdc.address],
        precisions: [prices.brl.precision, prices.usdc.precision],
        minPrices: [prices.brl.min, prices.usdc.min],
        maxPrices: [prices.brl.max, prices.usdc.max],
      });

      // Verify position opened
      const positionCountAfterOpen = await getAccountPositionCount(dataStore, user1.address);
      expect(positionCountAfterOpen).to.equal(1);

      // Read position details
      const positions = await reader.getAccountPositions(dataStore.address, user1.address, 0, 10);
      expect(positions[0].flags.isLong).to.equal(true); // Confirm LONG

      // Close position when BRL INCREASES to $0.18 (good for LONG)
      await createOrder(fixture, {
        account: user1,
        market: brlUsdMarket,
        initialCollateralToken: usdc,
        initialCollateralDeltaAmount: 0,
        sizeDeltaUsd: decimalToFloat(10_000),
        acceptablePrice: expandDecimals(1, 21), // Min price for LONG exit
        triggerPrice: 0,
        orderType: OrderType.MarketDecrease,
        isLong: true,
        shouldUnwrapNativeToken: false,
      });

      const balanceBeforeClose = await usdc.balanceOf(user1.address);

      // Execute close at BRL = $0.18 (increased price - good for LONG)
      await executeOrder(fixture, {
        tokens: [brl.address, usdc.address],
        precisions: [prices.brl.precision, prices.usdc.precision],
        minPrices: [prices.brl.increased.min, prices.usdc.min],
        maxPrices: [prices.brl.increased.max, prices.usdc.max],
      });

      const positionCountAfterClose = await getAccountPositionCount(dataStore, user1.address);
      expect(positionCountAfterClose).to.equal(0);

      const balanceAfterClose = await usdc.balanceOf(user1.address);
      const profit = balanceAfterClose.sub(balanceBeforeClose);
      const profitUsd = Number(hre.ethers.utils.formatUnits(profit, 6));

      console.log("\n=== LONG BRL/USD Hedge Results ===");
      console.log(`Entry Price: $0.16/BRL`);
      console.log(`Exit Price: $0.18/BRL (+12.5%)`);
      console.log(`Position Size: $10,000`);
      console.log(`Profit: $${profitUsd.toFixed(2)} USDC`);

      // Expected profit calculation:
      // Position size in BRL = $10,000 / $0.16 = 62,500 BRL
      // Price change = $0.18 - $0.16 = $0.02 per BRL
      // Profit = 62,500 × $0.02 = $1,250 (minus fees)
      expect(profitUsd).to.be.greaterThan(1000);
    });

    it("should lose from LONG when BRL devalues", async () => {
      // Open LONG position with MORE collateral to avoid liquidation
      // With 10x leverage, a 12.5% adverse move can exceed collateral
      // Use 5x leverage instead (2000 collateral, 10000 size)
      await createOrder(fixture, {
        account: user1,
        market: brlUsdMarket,
        initialCollateralToken: usdc,
        initialCollateralDeltaAmount: expandDecimals(2000, 6), // 2x more collateral
        sizeDeltaUsd: decimalToFloat(10_000),
        acceptablePrice: expandDecimals(3, 22),
        triggerPrice: 0,
        orderType: OrderType.MarketIncrease,
        isLong: true,
        shouldUnwrapNativeToken: false,
      });

      // Execute at BRL = $0.16
      await executeOrder(fixture, {
        tokens: [brl.address, usdc.address],
        precisions: [prices.brl.precision, prices.usdc.precision],
        minPrices: [prices.brl.min, prices.usdc.min],
        maxPrices: [prices.brl.max, prices.usdc.max],
      });

      // Close position when BRL DECREASES to $0.14 (bad for LONG)
      await createOrder(fixture, {
        account: user1,
        market: brlUsdMarket,
        initialCollateralToken: usdc,
        initialCollateralDeltaAmount: 0,
        sizeDeltaUsd: decimalToFloat(10_000),
        acceptablePrice: expandDecimals(1, 20), // Lower min price for loss scenario
        triggerPrice: 0,
        orderType: OrderType.MarketDecrease,
        isLong: true,
        shouldUnwrapNativeToken: false,
      });

      const balanceBeforeClose = await usdc.balanceOf(user1.address);

      // Execute close at BRL = $0.14 (decreased price - bad for LONG)
      await executeOrder(fixture, {
        tokens: [brl.address, usdc.address],
        precisions: [prices.brl.precision, prices.usdc.precision],
        minPrices: [prices.brl.decreased.min, prices.usdc.min],
        maxPrices: [prices.brl.decreased.max, prices.usdc.max],
      });

      const balanceAfterClose = await usdc.balanceOf(user1.address);
      const pnl = balanceAfterClose.sub(balanceBeforeClose);
      const pnlUsd = Number(hre.ethers.utils.formatUnits(pnl, 6));

      console.log("\n=== LONG BRL/USD Loss Scenario ===");
      console.log(`Entry Price: $0.16/BRL`);
      console.log(`Exit Price: $0.14/BRL (-12.5%)`);
      console.log(`PnL: $${pnlUsd.toFixed(2)} USDC`);

      // LONG loses when price goes DOWN
      // Returned amount (collateral - loss) should be less than initial collateral
      expect(pnlUsd).to.be.lessThan(2000); // Less than original 2000 collateral
      expect(pnlUsd).to.be.greaterThan(500); // But should get some back
    });
  });

  // ============================================================================
  // SCENARIO 3: Full Hedge Effectiveness Test
  // ============================================================================
  describe("Hedge Effectiveness - Real World Simulation", () => {
    /**
     * This test simulates the complete hedge scenario:
     * - User has 62,500 BRL savings (worth $10,000 at $0.16)
     * - User opens SHORT hedge position
     * - BRL devalues 12.5%
     * - Calculate: savings loss vs position profit
     * - Verify: net effect is close to zero (effective hedge)
     */
    it("should demonstrate effective hedge against 12.5% BRL devaluation", async () => {
      // Real-world values
      const brlSavingsAmount = 62500; // 62,500 BRL
      const initialBrlPrice = 0.16; // $0.16 per BRL
      const finalBrlPrice = 0.14; // $0.14 per BRL (12.5% drop)
      const initialSavingsValueUsd = brlSavingsAmount * initialBrlPrice; // $10,000

      console.log("\n╔═══════════════════════════════════════════════════════════════╗");
      console.log("║          FULL HEDGE EFFECTIVENESS SIMULATION                  ║");
      console.log("╚═══════════════════════════════════════════════════════════════╝\n");

      console.log("Initial State:");
      console.log(`  - BRL Savings: ${brlSavingsAmount.toLocaleString()} BRL`);
      console.log(`  - BRL Price: $${initialBrlPrice}/BRL`);
      console.log(`  - Savings Value: $${initialSavingsValueUsd.toLocaleString()} USD\n`);

      // Open SHORT hedge position matching savings value
      await createOrder(fixture, {
        account: user0,
        market: brlUsdMarket,
        initialCollateralToken: usdc,
        initialCollateralDeltaAmount: expandDecimals(1000, 6), // $1,000 collateral
        sizeDeltaUsd: decimalToFloat(10_000), // $10,000 position = savings value
        acceptablePrice: expandDecimals(1, 21),
        triggerPrice: 0,
        orderType: OrderType.MarketIncrease,
        isLong: false, // SHORT hedge
        shouldUnwrapNativeToken: false,
      });

      await executeOrder(fixture, {
        tokens: [brl.address, usdc.address],
        precisions: [prices.brl.precision, prices.usdc.precision],
        minPrices: [prices.brl.min, prices.usdc.min],
        maxPrices: [prices.brl.max, prices.usdc.max],
      });

      console.log("Hedge Position Opened:");
      console.log("  - Type: SHORT BRL/USD");
      console.log("  - Size: $10,000 USD");
      console.log("  - Collateral: $1,000 USDC");
      console.log("  - Leverage: 10x\n");

      // Simulate BRL crash - close position at lower price
      await createOrder(fixture, {
        account: user0,
        market: brlUsdMarket,
        initialCollateralToken: usdc,
        initialCollateralDeltaAmount: 0,
        sizeDeltaUsd: decimalToFloat(10_000),
        acceptablePrice: expandDecimals(2, 22),
        triggerPrice: 0,
        orderType: OrderType.MarketDecrease,
        isLong: false,
        shouldUnwrapNativeToken: false,
      });

      const balanceBefore = await usdc.balanceOf(user0.address);

      await executeOrder(fixture, {
        tokens: [brl.address, usdc.address],
        precisions: [prices.brl.precision, prices.usdc.precision],
        minPrices: [prices.brl.decreased.min, prices.usdc.min],
        maxPrices: [prices.brl.decreased.max, prices.usdc.max],
      });

      const balanceAfter = await usdc.balanceOf(user0.address);

      // Calculate results
      const positionPnl = Number(hre.ethers.utils.formatUnits(balanceAfter.sub(balanceBefore), 6));
      const finalSavingsValueUsd = brlSavingsAmount * finalBrlPrice;
      const savingsLoss = initialSavingsValueUsd - finalSavingsValueUsd;
      const netEffect = positionPnl - 1000 - savingsLoss; // Subtract initial collateral

      console.log("After BRL Devaluation (-12.5%):");
      console.log(`  - New BRL Price: $${finalBrlPrice}/BRL`);
      console.log(`  - Savings Now Worth: $${finalSavingsValueUsd.toLocaleString()} USD`);
      console.log(`  - Savings Loss: -$${savingsLoss.toLocaleString()} USD\n`);

      console.log("Hedge Position Results:");
      console.log(`  - Position PnL: +$${(positionPnl - 1000).toFixed(2)} USD (after returning collateral)\n`);

      console.log("═══════════════════════════════════════════════════════════════");
      console.log(`  SAVINGS LOSS:     -$${savingsLoss.toLocaleString()}`);
      console.log(`  HEDGE PROFIT:     +$${(positionPnl - 1000).toFixed(2)}`);
      console.log("───────────────────────────────────────────────────────────────");
      console.log(`  NET EFFECT:       $${netEffect.toFixed(2)} (should be ~$0)`);
      console.log("═══════════════════════════════════════════════════════════════\n");

      // The net effect should be close to zero (effective hedge)
      // Allow for some variance due to fees and price impact
      expect(Math.abs(netEffect)).to.be.lessThan(200); // Within $200 of perfect hedge
    });
  });
});
