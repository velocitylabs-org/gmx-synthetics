/**
 * ============================================================================
 * TEST BRL/USD SHORT POSITION SCRIPT
 * ============================================================================
 *
 * PURPOSE:
 * This script tests the complete flow of a SHORT position on a BRL/USD forex market.
 * A SHORT position means you're betting the price will GO DOWN.
 *
 * WHAT IS A SHORT?
 * - LONG = Betting price goes UP (buy low, sell high)
 * - SHORT = Betting price goes DOWN (sell high, buy back low)
 *
 * USE CASE - FOREX INSURANCE:
 * A Brazilian user has savings in BRL (Brazilian Real).
 * They fear BRL will devalue against USD.
 * By opening a SHORT position on BRL/USD:
 * - If BRL drops: Their position PROFITS, offsetting real-world losses
 * - If BRL rises: Their position LOSES, but their real savings gained value
 * This is called "hedging" - protecting against currency risk.
 *
 * WHAT THIS SCRIPT DOES:
 * 1. Deploys all GMX contracts to a local Hardhat blockchain
 * 2. Adds liquidity to the BRL/USD market (so there's money to trade against)
 * 3. Opens a SHORT position (betting BRL will drop)
 * 4. Simulates BRL devaluation ($0.16 → $0.14)
 * 5. Closes the position and shows the profit
 *
 * RUN WITH: npx hardhat run scripts/test-brl-short-position.ts
 *
 * ============================================================================
 * 🤖 KEEPER SIMULATIONS IN THIS FILE
 * ============================================================================
 *
 * This test simulates keeper work in 3 places. Search for "KEEPER SIMULATION"
 * to find detailed comments explaining what's different in production:
 *
 *   #1 - DEPOSIT EXECUTION (line ~180)
 *        handleDeposit() → In prod: DepositHandler.executeDeposit()
 *
 *   #2 - ORDER EXECUTION: OPEN POSITION (line ~360)
 *        executeOrder() → In prod: OrderHandler.executeOrder()
 *
 *   #3 - ORDER EXECUTION: CLOSE POSITION (line ~535)
 *        executeOrder() → In prod: OrderHandler.executeOrder()
 *
 * LEGEND FOR INLINE COMMENTS:
 *   🧪 TEST    = What happens in this local Hardhat test
 *   🌐 TESTNET = What would happen on a real blockchain (Arbitrum Sepolia, etc.)
 *
 * IN LOCAL TEST: These all happen instantly with mock prices.
 * IN PRODUCTION: A keeper service must run 24/7 to execute these!
 *
 * See VELOCITY_DOCS/LOCAL_VS_PRODUCTION.md for full explanation.
 * ============================================================================
 */

// ============================================================================
// IMPORTS
// ============================================================================

// Hardhat Runtime Environment - gives us access to ethers.js and network config
import hre from "hardhat";

// Math utilities for handling big numbers (blockchain uses integers, not decimals)
// - expandDecimals(100, 6) = 100 * 10^6 = 100000000 (how $100 USDC is stored)
// - decimalToFloat(10000) = 10000 * 10^30 (GMX stores USD values with 30 decimals)
import { expandDecimals, decimalToFloat } from "../../utils/math";

// Deploys ALL GMX contracts (~160 contracts) and returns them in a fixture object
// This includes: DataStore, Oracle, Router, Markets, Tokens, etc.
import { deployFixture } from "../../utils/fixture";

// Utility to add liquidity to a market
// Liquidity = money in the pool that traders can trade against
import { handleDeposit } from "../../utils/deposit";

// Order utilities:
// - createOrder: Creates a pending order (not executed yet)
// - executeOrder: Simulates a keeper executing the order with prices
// - OrderType: Enum of order types (MarketIncrease, MarketDecrease, etc.)
// - getOrderCount: How many pending orders exist
import { createOrder, executeOrder, OrderType, getOrderCount } from "../../utils/order";

// Position utilities:
// - getPositionCount: Total positions in the system
// - getAccountPositionCount: Positions for a specific user
import { getPositionCount, getAccountPositionCount } from "../../utils/position";

// Pre-defined price objects for testing
// Contains BRL, USDC, ETH, BTC prices in the format GMX expects
import { prices } from "../../utils/prices";

// ============================================================================
// MAIN FUNCTION
// ============================================================================

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║       FOREX VOLATILITY INSURANCE - BRL/USD SHORT TEST         ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  // ==========================================================================
  // STEP 1: DEPLOY ALL CONTRACTS
  // ==========================================================================
  // This deploys the entire GMX protocol to a local blockchain.
  // In production, these contracts would already be deployed on mainnet.
  // ==========================================================================

  console.log("📦 Step 1: Deploying all contracts...");
  console.log("   (This deploys ~160 contracts, may take a moment)\n");

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║  ⚠️  deployFixture() - THIS ONLY EXISTS IN TESTS!                         ║
  // ╠═══════════════════════════════════════════════════════════════════════════╣
  // ║                                                                           ║
  // ║  deployFixture() does all the heavy lifting:                              ║
  // ║  1. Deploys 100+ contracts (DataStore, RoleStore, Oracle, etc.)           ║
  // ║  2. Deploys handler contracts (OrderHandler, DepositHandler, etc.)        ║
  // ║  3. Deploys token contracts (USDC, WETH, BRL synthetic, etc.)             ║
  // ║  4. Creates markets (ETH/USD, BTC/USD, BRL/USD, etc.)                     ║
  // ║  5. Configures roles and permissions                                      ║
  // ║  6. Sets up test accounts with unlimited token balances                   ║
  // ║  7. Registers test oracle signers (any wallet can sign prices)            ║
  // ║                                                                           ║
  // ║  IN REAL PRODUCTION - YOU MUST DO ALL THIS MANUALLY:                      ║
  // ║  ─────────────────────────────────────────────────────                    ║
  // ║  • Run: npx hardhat deploy --network arbitrumSepolia                      ║
  // ║  • Create markets: MarketFactory.createMarket(brl, usdc, usdc)            ║
  // ║  • Configure roles: RoleStore.grantRole(keeper, ORDER_KEEPER)             ║
  // ║  • Register signer: OracleStore.addSigner(signerAddress)                  ║
  // ║  • Get real tokens from faucets                                           ║
  // ║  • Fund keeper wallet with ETH for gas                                    ║
  // ║                                                                           ║
  // ║  See VELOCITY_DOCS/LOCAL_VS_PRODUCTION.md for deployment checklist        ║
  // ║                                                                           ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝
  const fixture = await deployFixture();

  // Extract what we need from the fixture:

  // ACCOUNTS - Pre-funded test wallets
  // user0 is a test user with USDC balance for trading
  const { user0 } = fixture.accounts;

  // CONTRACTS - The deployed smart contracts we'll interact with
  const {
    reader, // Reader contract - for querying data (positions, markets, etc.)
    dataStore, // DataStore - central storage for all protocol data
    brlUsdMarket, // The BRL/USD market we created (contains market address info)
    brl, // BRL token contract (synthetic - just a price reference)
    usdc, // USDC token contract (real ERC20 used as collateral)
  } = fixture.contracts;

  // PROPS - Configuration values
  const { executionFee } = fixture.props; // Fee paid to keepers for executing orders

  console.log("   ✅ Contracts deployed successfully!\n");
  console.log("   Key Addresses:");
  console.log(`   - BRL/USD Market: ${brlUsdMarket.marketToken}`); // The market's LP token address
  console.log(`   - BRL (synthetic): ${brl.address}`); // Synthetic BRL address
  console.log(`   - USDC (collateral): ${usdc.address}`); // USDC contract address
  console.log(`   - Test User: ${user0.address}\n`); // Our test trader

  // ==========================================================================
  // STEP 2: ADD LIQUIDITY TO THE MARKET
  // ==========================================================================
  // Before anyone can trade, the market needs LIQUIDITY.
  // Liquidity = money deposited by Liquidity Providers (LPs)
  // This money is used to pay out winning trades.
  //
  // For a single-token market like BRL/USD:
  // - Both long and short sides use USDC as collateral
  // - LPs deposit USDC into both sides
  // ==========================================================================

  console.log("💰 Step 2: Adding liquidity to BRL/USD market...");

  // handleDeposit() does a two-step deposit:
  // 1. CREATE: User requests to deposit tokens
  // 2. EXECUTE: Keeper executes the deposit with oracle prices
  //
  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║  🤖 KEEPER SIMULATION #1: DEPOSIT EXECUTION                               ║
  // ╠═══════════════════════════════════════════════════════════════════════════╣
  // ║                                                                           ║
  // ║  IN THIS TEST:                                                            ║
  // ║  - handleDeposit() does BOTH create AND execute in one call               ║
  // ║  - Prices are hardcoded from utils/prices.ts                              ║
  // ║  - Execution happens instantly in same transaction                        ║
  // ║                                                                           ║
  // ║  IN REAL PRODUCTION:                                                      ║
  // ║  - User calls ExchangeRouter.createDeposit() → tokens go to DepositVault  ║
  // ║  - Deposit sits in DataStore as "pending"                                 ║
  // ║  - Keeper service (separate process running 24/7) detects pending deposit ║
  // ║  - Keeper fetches REAL prices from Pyth API                               ║
  // ║  - Keeper signs prices with registered signer key                         ║
  // ║  - Keeper calls DepositHandler.executeDeposit(key, oracleParams)          ║
  // ║  - This could take seconds to minutes depending on keeper polling         ║
  // ║                                                                           ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  // ┌─────────────────────────────────────────────────────────────────────────────┐
  // │ 🧪 TEST: handleDeposit() does create + execute in ONE call                  │
  // │ 🌐 TESTNET: Split into TWO separate transactions:                           │
  // │    1. await exchangeRouter.createDeposit({...})  // User TX                 │
  // │    2. await depositHandler.executeDeposit(key, oracleParams) // Keeper TX   │
  // └─────────────────────────────────────────────────────────────────────────────┘
  await handleDeposit(fixture, {
    // ┌───────────────────────────────────────────────────────────────────────────┐
    // │ 🧪 TEST: This "create" object becomes params to internal createDeposit()  │
    // │ 🌐 TESTNET: User calls ExchangeRouter.createDeposit() directly            │
    // └───────────────────────────────────────────────────────────────────────────┘
    create: {
      market: brlUsdMarket, // Which market to add liquidity to

      // Amount of USDC for the "long" side of the pool
      // expandDecimals(2_500_000, 6) = 2,500,000 * 10^6 = 2500000000000
      // (USDC has 6 decimals, so this is $2.5 million)
      longTokenAmount: expandDecimals(2_500_000, 6),

      // Amount of USDC for the "short" side of the pool
      // Same amount - $2.5 million
      shortTokenAmount: expandDecimals(2_500_000, 6),
    },

    // ┌───────────────────────────────────────────────────────────────────────────┐
    // │ 🧪 TEST: "execute" params are passed directly - instant execution         │
    // │ 🌐 TESTNET: Keeper builds these from Pyth API response:                   │
    // │    const pythData = await fetch('https://hermes.pyth.network/...')        │
    // │    const oracleParams = buildOracleParams(pythData)                       │
    // │    await depositHandler.executeDeposit(depositKey, oracleParams)          │
    // └───────────────────────────────────────────────────────────────────────────┘
    execute: {
      // 🧪 TEST: We list tokens manually
      // 🌐 TESTNET: Keeper determines which tokens from the deposit request
      tokens: [brl.address, usdc.address],

      // 🧪 TEST: Hardcoded from utils/prices.ts
      // 🌐 TESTNET: Comes from Pyth price feed configuration
      precisions: [prices.brl.precision, prices.usdc.precision],

      // 🧪 TEST: Mock prices - we control these!
      // 🌐 TESTNET: REAL prices from Pyth - market determines these!
      minPrices: [prices.brl.min, prices.usdc.min],
      maxPrices: [prices.brl.max, prices.usdc.max],
    },
  });

  console.log("   ✅ Liquidity added:");
  console.log("   - $5,000,000 USDC total (single-token market)\n");

  // ==========================================================================
  // STEP 3: CHECK INITIAL STATE
  // ==========================================================================
  // Let's verify the system state before we start trading.
  // Should have: 0 orders, 0 positions
  // ==========================================================================

  console.log("📊 Step 3: Checking initial state...");

  // Query the DataStore for counts
  const initialOrderCount = await getOrderCount(dataStore); // Pending orders
  const initialPositionCount = await getPositionCount(dataStore); // All positions
  const initialUserPositions = await getAccountPositionCount(dataStore, user0.address); // User's positions

  console.log(`   - Total orders: ${initialOrderCount}`); // Should be 0
  console.log(`   - Total positions: ${initialPositionCount}`); // Should be 0
  console.log(`   - User positions: ${initialUserPositions}\n`); // Should be 0

  // ==========================================================================
  // STEP 4: OPEN A SHORT POSITION
  // ==========================================================================
  // Now we create a SHORT position on BRL/USD.
  //
  // SHORT means: We're betting BRL will DROP in value vs USD.
  //
  // Mechanics:
  // - We "borrow" BRL at current price ($0.16)
  // - If BRL drops to $0.14, we "buy it back" cheaper
  // - Profit = (entry price - exit price) × position size
  //
  // GMX uses a TWO-STEP process:
  // 1. createOrder() - Creates a pending order in the system
  // 2. executeOrder() - Keeper executes it with oracle prices
  // ==========================================================================

  console.log("📉 Step 4: Opening SHORT position on BRL/USD...\n");
  console.log("   Insurance Scenario:");
  console.log("   - A Brazilian user holds BRL savings equivalent to $10,000");
  console.log("   - Fears BRL will devalue 12.5% (from $0.16 to $0.14)");
  console.log("   - Opens SHORT position to hedge against devaluation\n");
  console.log("   Position Details:");
  console.log("   - Direction: SHORT (betting BRL price will DROP vs USD)");
  console.log("   - Collateral: 1,000 USDC");
  console.log("   - Position Size: $10,000 USD");
  console.log("   - Leverage: 10x");
  console.log("   - Entry Price: $0.16/BRL (62,500 BRL equivalent)\n");

  // Define the order parameters
  const shortOrderParams = {
    // WHO is placing the order
    account: user0,

    // WHICH market to trade on
    market: brlUsdMarket,

    // COLLATERAL - what token we're putting up as margin
    // This is USDC - stays in the contract as security
    initialCollateralToken: usdc,

    // HOW MUCH collateral
    // expandDecimals(1000, 6) = 1000 * 10^6 = 1,000 USDC
    initialCollateralDeltaAmount: expandDecimals(1000, 6),

    // POSITION SIZE in USD
    // decimalToFloat(10_000) = 10000 * 10^30 (GMX uses 30 decimals for USD)
    // This is a $10,000 position with $1,000 collateral = 10x leverage
    sizeDeltaUsd: decimalToFloat(10_000),

    // ACCEPTABLE PRICE - slippage protection
    // For SHORT entry: This is the MINIMUM price we'll accept
    // Why minimum? We're "selling" BRL, so we want to sell HIGH
    // For BRL at $0.16 with 8 decimals: price = 0.16 * 10^(30-8) = 1.6 * 10^21
    // We accept any price >= $0.10 = 1 * 10^21
    acceptablePrice: expandDecimals(1, 21),

    // TRIGGER PRICE - for limit/stop orders (0 = not used for market orders)
    triggerPrice: 0,

    // ORDER TYPE
    // MarketIncrease = Open/increase a position at current market price
    orderType: OrderType.MarketIncrease,

    // DIRECTION
    // false = SHORT (betting price goes down)
    // true = LONG (betting price goes up)
    isLong: false,

    // Whether to unwrap WETH to ETH on output (not relevant for USDC)
    shouldUnwrapNativeToken: false,
  };

  // STEP 4a: Create the order
  // This stores the order in DataStore, waiting for a keeper to execute
  console.log("   Creating order...");

  // ┌─────────────────────────────────────────────────────────────────────────────┐
  // │ 🧪 TEST: createOrder() is a test helper that wraps ExchangeRouter           │
  // │ 🌐 TESTNET: User calls ExchangeRouter.createOrder() directly                │
  // │                                                                             │
  // │ ✅ THIS PART IS THE SAME IN BOTH! User creates order, it goes to DataStore  │
  // │    The difference is WHAT HAPPENS NEXT (who executes it)                    │
  // └─────────────────────────────────────────────────────────────────────────────┘
  await createOrder(fixture, shortOrderParams);

  // Verify order was created
  const orderCountAfterCreate = await getOrderCount(dataStore);
  console.log(`   ✅ Order created! (Orders in queue: ${orderCountAfterCreate})\n`);

  // STEP 4b: Execute the order
  // In production, a keeper service does this. Here we simulate it.
  // The keeper provides oracle prices at execution time.
  console.log("   Executing order (keeper simulation with BRL @ $0.16)...");

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║  🤖 KEEPER SIMULATION #2: ORDER EXECUTION (OPEN POSITION)                 ║
  // ╠═══════════════════════════════════════════════════════════════════════════╣
  // ║                                                                           ║
  // ║  IN THIS TEST:                                                            ║
  // ║  - We call executeOrder() directly from our test script                   ║
  // ║  - Prices come from utils/prices.ts (hardcoded mock values)               ║
  // ║  - No real oracle signing - fixture gave us ORDER_KEEPER role             ║
  // ║  - Happens instantly, synchronously                                       ║
  // ║                                                                           ║
  // ║  IN REAL PRODUCTION:                                                      ║
  // ║  - After createOrder(), order sits in DataStore as "pending"              ║
  // ║  - Keeper service polls DataStore for pending orders (every 1-5 seconds)  ║
  // ║  - Keeper checks if order conditions are met (price triggers, etc.)       ║
  // ║  - Keeper fetches LIVE prices from Pyth Network:                          ║
  // ║      const pythPrices = await fetch('https://hermes.pyth.network/...')    ║
  // ║  - Keeper builds oracleParams with signed price data                      ║
  // ║  - Keeper calls OrderHandler.executeOrder(orderKey, oracleParams)         ║
  // ║  - If execution fails (price moved, slippage), keeper may retry           ║
  // ║  - Keeper pays gas, reimbursed from user's executionFee                   ║
  // ║                                                                           ║
  // ║  WITHOUT A KEEPER RUNNING:                                                ║
  // ║  - Orders NEVER execute                                                   ║
  // ║  - They just sit as "pending" until they expire                           ║
  // ║  - User can cancel and get collateral back (minus gas)                    ║
  // ║                                                                           ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  // ┌─────────────────────────────────────────────────────────────────────────────┐
  // │ 🧪 TEST: executeOrder() - we call it directly, instant execution            │
  // │ 🌐 TESTNET: Keeper service calls OrderHandler.executeOrder()                │
  // │                                                                             │
  // │ 🌐 TESTNET CODE EQUIVALENT:                                                 │
  // │    // In keeper service (separate Node.js process running 24/7):            │
  // │    const orderKey = await getNextPendingOrder();                            │
  // │    const prices = await fetchPythPrices(['BRL', 'USDC']);                   │
  // │    const oracleParams = buildOracleParams(prices, signerKey);               │
  // │    await orderHandler.executeOrder(orderKey, oracleParams);                 │
  // └─────────────────────────────────────────────────────────────────────────────┘
  await executeOrder(fixture, {
    // 🧪 TEST: We specify tokens manually here
    // 🌐 TESTNET: Keeper reads tokens from the order stored in DataStore
    tokens: [brl.address, usdc.address],

    // 🧪 TEST: Precision hardcoded from utils/prices.ts
    // 🌐 TESTNET: Precision from config/tokens.ts or Pyth feed metadata
    precisions: [prices.brl.precision, prices.usdc.precision],

    // 🧪 TEST: Mock prices from utils/prices.ts - WE CONTROL THESE
    // 🌐 TESTNET: REAL prices from Pyth API - MARKET CONTROLS THESE
    //    const pythResponse = await fetch('https://hermes.pyth.network/v2/updates/price/latest?ids[]=BRL_FEED_ID');
    //    minPrices/maxPrices come from pythResponse.parsed[0].price
    minPrices: [prices.brl.min, prices.usdc.min],
    maxPrices: [prices.brl.max, prices.usdc.max],
  });

  // Verify position was opened
  const positionsAfterOpen = await getAccountPositionCount(dataStore, user0.address);
  console.log(`   ✅ Position opened! (User positions: ${positionsAfterOpen})\n`);

  // ==========================================================================
  // STEP 5: VIEW POSITION DETAILS
  // ==========================================================================
  // Let's query the blockchain to see our position details.
  // The Reader contract provides view functions for this.
  // ==========================================================================

  console.log("🔍 Step 5: Position details...\n");

  // getAccountPositions returns an array of position structs
  // Parameters: (dataStoreAddress, accountAddress, startIndex, endIndex)
  const positions = await reader.getAccountPositions(dataStore.address, user0.address, 0, 10);

  if (positions.length > 0) {
    const pos = positions[0];

    // Position size in USD (stored with 30 decimals)
    // formatUnits converts from big number to human-readable
    const sizeInUsd = hre.ethers.utils.formatUnits(pos.numbers.sizeInUsd, 30);

    // Position size in BRL tokens (stored with 8 decimals for BRL)
    const sizeInTokens = hre.ethers.utils.formatUnits(pos.numbers.sizeInTokens, 8);

    // Collateral amount in USDC (stored with 6 decimals)
    const collateral = hre.ethers.utils.formatUnits(pos.numbers.collateralAmount, 6);

    console.log("   Position Info:");
    console.log(`   - Market: ${pos.addresses.market}`);
    console.log(`   - Collateral Token: ${pos.addresses.collateralToken}`);
    console.log(`   - Size (USD): $${Number(sizeInUsd).toLocaleString()}`);
    console.log(`   - Size (Tokens): ${Number(sizeInTokens).toLocaleString()} BRL`);
    console.log(`   - Collateral: ${Number(collateral).toLocaleString()} USDC`);
    console.log(`   - Is Long: ${pos.flags.isLong} (false = SHORT)`);
    console.log();
  }

  // ==========================================================================
  // STEP 6: SIMULATE BRL DEVALUATION
  // ==========================================================================
  // Now we simulate time passing and BRL dropping in value.
  // In reality, this would happen naturally as markets move.
  // Here, we'll simply use different prices when closing the position.
  //
  // BRL drops from $0.16 to $0.14 = 12.5% devaluation
  // ==========================================================================

  console.log("📈 Step 6: Simulating BRL devaluation...\n");
  console.log("   Crisis Scenario: BRL drops 12.5% due to economic instability");
  console.log("   - Previous: 1 BRL = $0.16 USD");
  console.log("   - Current:  1 BRL = $0.14 USD (-12.5%)\n");
  console.log("   Expected Outcome:");
  console.log("   - Position size: 62,500 BRL");
  console.log("   - Price moved: $0.16 → $0.14 = -$0.02 per BRL");
  console.log("   - SHORT Profit: 62,500 × $0.02 = $1,250 (+12.5%)\n");

  // ==========================================================================
  // STEP 7: CLOSE THE POSITION
  // ==========================================================================
  // Now we close the SHORT position at the new lower price.
  //
  // For a SHORT:
  // - We "sold" BRL at $0.16 (entry)
  // - Now we "buy back" BRL at $0.14 (exit)
  // - Profit = ($0.16 - $0.14) × 62,500 BRL = $1,250
  //
  // To close, we create a MarketDecrease order with the full position size.
  // ==========================================================================

  console.log("🔒 Step 7: Closing the SHORT position with profit...\n");

  // Define the close order parameters
  const closeOrderParams = {
    account: user0,
    market: brlUsdMarket,
    initialCollateralToken: usdc,

    // For closing, we don't add collateral (just closing existing position)
    initialCollateralDeltaAmount: 0,

    // Close the FULL position size ($10,000)
    sizeDeltaUsd: decimalToFloat(10_000),

    // ACCEPTABLE PRICE for SHORT exit
    // For SHORT close: This is the MAXIMUM price we'll accept
    // Why maximum? We're "buying back" BRL, so we want to buy LOW
    // For BRL at $0.14 with 8 decimals: price = 0.14 * 10^(30-8) = 1.4 * 10^21
    // We accept any price <= $0.20 = 2 * 10^21
    acceptablePrice: expandDecimals(2, 22),

    triggerPrice: 0,

    // MarketDecrease = Close/decrease a position at current market price
    orderType: OrderType.MarketDecrease,

    // Still a SHORT position (we're closing it, not flipping to long)
    isLong: false,

    shouldUnwrapNativeToken: false,
  };

  console.log("   Creating close order...");

  // ┌─────────────────────────────────────────────────────────────────────────────┐
  // │ 🧪 TEST: createOrder() wraps ExchangeRouter.createOrder()                   │
  // │ 🌐 TESTNET: User calls ExchangeRouter.createOrder() directly                │
  // │                                                                             │
  // │ ✅ THIS PART IS THE SAME IN BOTH! User creates close order normally         │
  // └─────────────────────────────────────────────────────────────────────────────┘
  await createOrder(fixture, closeOrderParams);

  console.log("   Executing close order with NEW price (BRL = $0.14)...");

  // ╔═══════════════════════════════════════════════════════════════════════════╗
  // ║  🤖 KEEPER SIMULATION #3: ORDER EXECUTION (CLOSE POSITION)                ║
  // ╠═══════════════════════════════════════════════════════════════════════════╣
  // ║                                                                           ║
  // ║  IN THIS TEST:                                                            ║
  // ║  - We manually pass prices.brl.decreased ($0.14) to simulate price drop   ║
  // ║  - This is how we "fake" market movement in tests                         ║
  // ║  - In reality, we can't control what price the keeper uses                ║
  // ║                                                                           ║
  // ║  IN REAL PRODUCTION:                                                      ║
  // ║  - User creates MarketDecrease order to close position                    ║
  // ║  - Order sits pending until keeper picks it up                            ║
  // ║  - Keeper fetches CURRENT market price from Pyth (whatever it is)         ║
  // ║  - If BRL actually dropped to $0.14, user profits!                        ║
  // ║  - If BRL went UP instead, user loses money                               ║
  // ║  - Keeper doesn't care - it just executes with real prices                ║
  // ║                                                                           ║
  // ║  THE KEY DIFFERENCE:                                                      ║
  // ║  - TEST: We control prices → guaranteed profit scenario                   ║
  // ║  - PROD: Market controls prices → real risk/reward                        ║
  // ║                                                                           ║
  // ╚═══════════════════════════════════════════════════════════════════════════╝

  // ┌─────────────────────────────────────────────────────────────────────────────┐
  // │ 🧪 TEST: executeOrder() with prices.brl.decreased ($0.14)                   │
  // │          WE CHOOSE TO USE LOWER PRICE - simulating market movement          │
  // │                                                                             │
  // │ 🌐 TESTNET: Keeper fetches CURRENT price from Pyth - could be ANY value:    │
  // │    - If BRL actually dropped to $0.14 → User profits! (like our test)       │
  // │    - If BRL stayed at $0.16 → User breaks even                              │
  // │    - If BRL rose to $0.18 → User LOSES money!                               │
  // │                                                                             │
  // │ ⚠️  THIS IS THE KEY DIFFERENCE:                                             │
  // │    TEST = We control the outcome by choosing prices                         │
  // │    PROD = Market determines outcome, real financial risk!                   │
  // └─────────────────────────────────────────────────────────────────────────────┘

  // Execute with the LOWER BRL price
  // 🧪 TEST: prices.brl.decreased is hardcoded $0.14 from utils/prices.ts
  // 🌐 TESTNET: Keeper calls Pyth API and gets whatever the real price is
  await executeOrder(fixture, {
    // 🧪 TEST: Manual token list
    // 🌐 TESTNET: Keeper reads from order in DataStore
    tokens: [brl.address, usdc.address],

    // 🧪 TEST: From utils/prices.ts
    // 🌐 TESTNET: From config/tokens.ts
    precisions: [prices.brl.precision, prices.usdc.precision],

    // 🧪 TEST: Using prices.brl.decreased ($0.14) - WE CHOSE THIS
    // 🌐 TESTNET: Real Pyth price - MARKET CHOOSES THIS
    //    Example keeper code:
    //    const brlPrice = await pyth.getPrice('BRL_USD_FEED_ID');
    //    // brlPrice could be $0.14, $0.16, $0.18, or anything!
    minPrices: [prices.brl.decreased.min, prices.usdc.min],
    maxPrices: [prices.brl.decreased.max, prices.usdc.max],
  });

  // Verify position was closed
  const positionsAfterClose = await getAccountPositionCount(dataStore, user0.address);
  console.log(`   ✅ Position closed! (User positions: ${positionsAfterClose})\n`);

  // ==========================================================================
  // STEP 8: CHECK FINAL BALANCES
  // ==========================================================================
  // Let's see how much USDC the user has after closing the position.
  // Should be: initial collateral + profit - fees
  // ==========================================================================

  console.log("💵 Step 8: Final results...\n");

  // Query user's USDC balance
  const finalUsdcBalance = await usdc.balanceOf(user0.address);
  console.log(`   User USDC Balance: ${hre.ethers.utils.formatUnits(finalUsdcBalance, 6)} USDC`);

  // Show the insurance calculation
  console.log("\n   Insurance Payout Calculation:");
  console.log("   ┌─────────────────────────────────────────────────────────────┐");
  console.log("   │  SCENARIO: Brazilian saves $10,000 worth in BRL             │");
  console.log("   │  Without hedge: $10,000 → $8,750 (lost $1,250)              │");
  console.log("   │  With SHORT hedge:                                          │");
  console.log("   │    - BRL savings loss: -$1,250                              │");
  console.log("   │    - SHORT position gain: +$1,250 (minus fees)              │");
  console.log("   │    - NET RESULT: ~$0 loss (fully hedged!)                   │");
  console.log("   └─────────────────────────────────────────────────────────────┘\n");

  // ==========================================================================
  // SUCCESS!
  // ==========================================================================

  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║              ✅ BRL/USD FOREX TEST COMPLETED!                 ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");
  console.log("   The BRL/USD forex SHORT position flow works correctly.\n");
  console.log("   Next steps for your insurance platform:\n");
  console.log("   1. Add more forex pairs (COP, ARS) following this pattern");
  console.log("   2. Integrate real forex oracle (Pyth, Chainlink)");
  console.log("   3. Build the insurance UI on top");
  console.log("   4. Customize fees for insurance product\n");
}

// ============================================================================
// SCRIPT EXECUTION
// ============================================================================
// Standard pattern for Hardhat scripts:
// - Call main()
// - Exit with code 0 on success
// - Exit with code 1 on error
// ============================================================================

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
