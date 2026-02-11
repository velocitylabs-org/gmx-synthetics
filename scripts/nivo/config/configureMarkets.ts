/**
 * Configure Forex Markets
 *
 * Applies ALL market configuration needed for local development to the DataStore.
 * This is the single "configure everything" script for Nivo on localhost.
 *
 * It handles:
 *   1. Deploying MockPriceFeed contracts for each token (if missing)
 *   2. Setting price feed addresses, multipliers, and heartbeat in DataStore
 *   3. Enabling ChainlinkPriceFeedProvider as oracle provider for tokens
 *   4. Setting pool limits (MAX_POOL_USD_FOR_DEPOSIT, MAX_POOL_AMOUNT, etc.)
 *   5. Setting collateral and open interest limits
 *
 * On testnet/mainnet, most of this is handled by deployment scripts.
 * On localhost, this script ensures all config is applied after deployment.
 *
 * Usage: npm run local:configure-markets
 */
import { deployments, ethers } from "hardhat";
import { hashData, hashString } from "../../../utils/hash";

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║           CONFIGURE FOREX MARKETS                             ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  // Get contracts
  const dataStoreDeployment = await deployments.get("DataStore");
  const readerDeployment = await deployments.get("Reader");

  const dataStore = await ethers.getContractAt("DataStore", dataStoreDeployment.address);
  const reader = await ethers.getContractAt("Reader", readerDeployment.address);

  console.log("DataStore:", dataStoreDeployment.address);
  console.log("Reader:", readerDeployment.address);

  // Get all markets up front (needed by multiple steps)
  const markets = await reader.getMarkets(dataStoreDeployment.address, 0, 100);
  console.log(`Found ${markets.length} markets`);

  // Collect all unique token addresses across all markets
  const allTokens = new Set<string>();
  for (const market of markets) {
    for (const token of [market.indexToken, market.longToken, market.shortToken]) {
      if (token !== ethers.constants.AddressZero) {
        allTokens.add(token);
      }
    }
  }
  console.log(`Unique tokens across markets: ${allTokens.size}`);

  // =============================================
  // STEP 1: Deploy price feeds for tokens that don't have them
  // =============================================
  console.log("\n=== Step 1: Deploy & Configure Price Feeds ===\n");

  const PRICE_FEED = hashString("PRICE_FEED");
  const PRICE_FEED_MULTIPLIER = hashString("PRICE_FEED_MULTIPLIER");
  const PRICE_FEED_HEARTBEAT_DURATION = hashString("PRICE_FEED_HEARTBEAT_DURATION");

  const MockPriceFeedFactory = await ethers.getContractFactory("MockPriceFeed");

  for (const tokenAddr of allTokens) {
    const priceFeedKeyHash = hashData(["bytes32", "address"], [PRICE_FEED, tokenAddr]);
    const currentFeed = await dataStore.getAddress(priceFeedKeyHash);

    if (currentFeed !== ethers.constants.AddressZero) {
      console.log(`  ✅ Price feed already set for ${tokenAddr}: ${currentFeed}`);
      continue;
    }

    // Get token decimals to determine price and multiplier
    const tokenContract = await ethers.getContractAt("MintableToken", tokenAddr);
    let tokenDecimals: number;
    try {
      tokenDecimals = await tokenContract.decimals();
    } catch {
      tokenDecimals = 18; // default for synthetic tokens
    }

    // Stablecoins (6 decimals) get $1.00, forex/synthetic tokens (18 decimals) get ~$0.18
    const priceFeedDecimals = 8;
    const initPrice = tokenDecimals === 6 ? "100000000" : "18000000";

    console.log(`  Deploying MockPriceFeed for ${tokenAddr} (decimals: ${tokenDecimals})...`);
    const feed = await MockPriceFeedFactory.deploy();
    await feed.deployed();
    await (await feed.setAnswer(initPrice)).wait();
    console.log(`    Feed deployed at: ${feed.address} (initPrice: ${initPrice})`);

    // Set price feed address in DataStore
    await (await dataStore.setAddress(priceFeedKeyHash, feed.address)).wait();

    // Set multiplier: 10^(60 - priceFeedDecimals - tokenDecimals)
    const multiplierKeyHash = hashData(["bytes32", "address"], [PRICE_FEED_MULTIPLIER, tokenAddr]);
    const multiplier = ethers.BigNumber.from(10).pow(60 - priceFeedDecimals - tokenDecimals);
    await (await dataStore.setUint(multiplierKeyHash, multiplier)).wait();

    // Set heartbeat duration: 24 hours
    const heartbeatKeyHash = hashData(["bytes32", "address"], [PRICE_FEED_HEARTBEAT_DURATION, tokenAddr]);
    await (await dataStore.setUint(heartbeatKeyHash, 86400)).wait();

    console.log(
      `    ✅ Price feed configured (multiplier: 10^${60 - priceFeedDecimals - tokenDecimals}, heartbeat: 86400s)`
    );
  }

  // =============================================
  // STEP 2: Enable ChainlinkPriceFeedProvider for all forex tokens
  // =============================================
  console.log("\n=== Step 2: Configure Oracle Providers ===\n");

  let chainlinkPriceFeedProviderAddress: string;
  try {
    const chainlinkPriceFeedProviderDeployment = await deployments.get("ChainlinkPriceFeedProvider");
    chainlinkPriceFeedProviderAddress = chainlinkPriceFeedProviderDeployment.address;
    console.log("ChainlinkPriceFeedProvider:", chainlinkPriceFeedProviderAddress);
  } catch {
    console.log("⚠️ ChainlinkPriceFeedProvider not deployed. Skipping oracle provider config.");
    console.log("   This is expected if Oracle deployment hasn't run yet.");
    return;
  }

  // Get the Oracle contract address - needed for the provider key
  const oracleDeployment = await deployments.get("Oracle");
  console.log("Oracle:", oracleDeployment.address);

  // Enable ChainlinkPriceFeedProvider in the Oracle
  const IS_ORACLE_PROVIDER_ENABLED = hashString("IS_ORACLE_PROVIDER_ENABLED");
  const isEnabledKey = hashData(
    ["bytes32", "address"],
    [IS_ORACLE_PROVIDER_ENABLED, chainlinkPriceFeedProviderAddress]
  );

  const isEnabled = await dataStore.getBool(isEnabledKey);
  if (!isEnabled) {
    console.log("Enabling ChainlinkPriceFeedProvider...");
    await (await dataStore.setBool(isEnabledKey, true)).wait();
    console.log("✅ ChainlinkPriceFeedProvider enabled");
  } else {
    console.log("✅ ChainlinkPriceFeedProvider already enabled");
  }

  // Set oracle provider for each token in each market
  const ORACLE_PROVIDER_FOR_TOKEN = hashString("ORACLE_PROVIDER_FOR_TOKEN");
  const configuredTokens = new Set<string>();

  for (const market of markets) {
    const tokens = [market.indexToken, market.longToken, market.shortToken];

    for (const token of tokens) {
      if (token === ethers.constants.AddressZero || configuredTokens.has(token.toLowerCase())) {
        continue;
      }

      // Key must include Oracle address: hash(ORACLE_PROVIDER_FOR_TOKEN, oracleAddr, tokenAddr)
      // This matches the Solidity: Keys.oracleProviderForTokenKey(address(this), token)
      const providerKey = hashData(
        ["bytes32", "address", "address"],
        [ORACLE_PROVIDER_FOR_TOKEN, oracleDeployment.address, token]
      );
      const currentProvider = await dataStore.getAddress(providerKey);

      if (currentProvider.toLowerCase() !== chainlinkPriceFeedProviderAddress.toLowerCase()) {
        console.log(`  Setting oracle provider for ${token} (Oracle: ${oracleDeployment.address})...`);
        await (await dataStore.setAddress(providerKey, chainlinkPriceFeedProviderAddress)).wait();
        console.log(`  ✅ Oracle provider set`);
      } else {
        console.log(`  ✅ Oracle provider already set for ${token}`);
      }

      configuredTokens.add(token.toLowerCase());
    }
  }

  // =============================================
  // STEP 3: Set market configuration values
  // =============================================
  console.log("\n=== Step 3: Set Market Configuration ===\n");

  // Check REQUEST_EXPIRATION_TIME
  const REQUEST_EXPIRATION_TIME = hashString("REQUEST_EXPIRATION_TIME");
  const requestExpiration = await dataStore.getUint(REQUEST_EXPIRATION_TIME);
  console.log("REQUEST_EXPIRATION_TIME:", requestExpiration.toString(), "seconds");

  // For local development, use a very long expiration (24 hours) so requests
  // don't expire while debugging. On testnet/mainnet this would be much shorter.
  const targetExpiration = 86400; // 24 hours
  if (requestExpiration.lt(targetExpiration)) {
    console.log(`  ⚠️ REQUEST_EXPIRATION_TIME is ${requestExpiration.toString()}s - too short for local dev`);
    console.log(`  Setting to ${targetExpiration} seconds (24 hours)...`);
    await (await dataStore.setUint(REQUEST_EXPIRATION_TIME, targetExpiration)).wait();
    console.log(`  ✅ Set to ${targetExpiration} seconds`);
  }

  // Market config values from config/markets.ts nivoBaseMarketConfig
  // These must be set in DataStore for deposits, withdrawals, and orders to work
  const MAX_POOL_USD_FOR_DEPOSIT = hashString("MAX_POOL_USD_FOR_DEPOSIT");
  const MAX_POOL_AMOUNT = hashString("MAX_POOL_AMOUNT");
  const MAX_COLLATERAL_SUM = hashString("MAX_COLLATERAL_SUM");
  const MAX_OPEN_INTEREST = hashString("MAX_OPEN_INTEREST");
  const RESERVE_FACTOR = hashString("RESERVE_FACTOR");
  const OPEN_INTEREST_RESERVE_FACTOR = hashString("OPEN_INTEREST_RESERVE_FACTOR");

  // Values matching config/markets.ts nivoBaseMarketConfig
  const maxPoolUsdForDeposit = ethers.utils.parseUnits("6000000", 30); // $6M USD (30 decimals)
  const maxPoolAmount = ethers.utils.parseUnits("5000000", 6); // 5M USDT (6 decimals)
  const maxCollateralSum = ethers.utils.parseUnits("10000000", 6); // 10M USDT (6 decimals)
  const maxOpenInterest = ethers.utils.parseUnits("2000000", 30); // $2M USD (30 decimals)
  // Reserve factors: fraction of pool that can be reserved (30-decimal float)
  // 90% = 9 * 10^29, 80% = 8 * 10^29
  const reserveFactor = ethers.BigNumber.from(9).mul(ethers.BigNumber.from(10).pow(29)); // 90%
  const openInterestReserveFactor = ethers.BigNumber.from(8).mul(ethers.BigNumber.from(10).pow(29)); // 80%

  for (const market of markets) {
    console.log(`\nConfiguring market: ${market.marketToken}`);
    const tokenSet = new Set<string>();
    for (const token of [market.longToken, market.shortToken]) {
      if (token === ethers.constants.AddressZero || tokenSet.has(token.toLowerCase())) continue;
      tokenSet.add(token.toLowerCase());

      // MAX_POOL_USD_FOR_DEPOSIT
      const maxPoolUsdKey = hashData(
        ["bytes32", "address", "address"],
        [MAX_POOL_USD_FOR_DEPOSIT, market.marketToken, token]
      );
      const currentMaxPoolUsd = await dataStore.getUint(maxPoolUsdKey);
      if (currentMaxPoolUsd.eq(0)) {
        console.log(`  Setting MAX_POOL_USD_FOR_DEPOSIT for ${token}...`);
        await (await dataStore.setUint(maxPoolUsdKey, maxPoolUsdForDeposit)).wait();
        console.log(`  ✅ Set to $6,000,000`);
      } else {
        console.log(
          `  ✅ MAX_POOL_USD_FOR_DEPOSIT already set: ${ethers.utils.formatUnits(currentMaxPoolUsd, 30)} USD`
        );
      }

      // MAX_POOL_AMOUNT
      const maxPoolAmountKey = hashData(
        ["bytes32", "address", "address"],
        [MAX_POOL_AMOUNT, market.marketToken, token]
      );
      const currentMaxPoolAmount = await dataStore.getUint(maxPoolAmountKey);
      if (currentMaxPoolAmount.eq(0)) {
        console.log(`  Setting MAX_POOL_AMOUNT for ${token}...`);
        await (await dataStore.setUint(maxPoolAmountKey, maxPoolAmount)).wait();
        console.log(`  ✅ Set to 5,000,000 USDT`);
      } else {
        console.log(`  ✅ MAX_POOL_AMOUNT already set: ${ethers.utils.formatUnits(currentMaxPoolAmount, 6)} USDT`);
      }

      // MAX_COLLATERAL_SUM (for both long and short sides)
      for (const isLong of [true, false]) {
        const maxCollKey = hashData(
          ["bytes32", "address", "address", "bool"],
          [MAX_COLLATERAL_SUM, market.marketToken, token, isLong]
        );
        const currentMaxColl = await dataStore.getUint(maxCollKey);
        if (currentMaxColl.eq(0)) {
          console.log(`  Setting MAX_COLLATERAL_SUM (${isLong ? "long" : "short"} side) for ${token}...`);
          await (await dataStore.setUint(maxCollKey, maxCollateralSum)).wait();
          console.log(`  ✅ Set to 10,000,000 USDT`);
        } else {
          console.log(
            `  ✅ MAX_COLLATERAL_SUM (${isLong ? "long" : "short"}) already set: ${ethers.utils.formatUnits(
              currentMaxColl,
              6
            )} USDT`
          );
        }
      }
    }

    // MAX_OPEN_INTEREST (per side: long and short)
    for (const isLong of [true, false]) {
      const maxOIKey = hashData(["bytes32", "address", "bool"], [MAX_OPEN_INTEREST, market.marketToken, isLong]);
      const currentMaxOI = await dataStore.getUint(maxOIKey);
      if (currentMaxOI.eq(0)) {
        console.log(`  Setting MAX_OPEN_INTEREST (${isLong ? "long" : "short"})...`);
        await (await dataStore.setUint(maxOIKey, maxOpenInterest)).wait();
        console.log(`  ✅ Set to $2,000,000`);
      } else {
        console.log(
          `  ✅ MAX_OPEN_INTEREST (${isLong ? "long" : "short"}) already set: ${ethers.utils.formatUnits(
            currentMaxOI,
            30
          )} USD`
        );
      }
    }

    // RESERVE_FACTOR (per side: long and short)
    for (const isLong of [true, false]) {
      const rfKey = hashData(["bytes32", "address", "bool"], [RESERVE_FACTOR, market.marketToken, isLong]);
      const currentRF = await dataStore.getUint(rfKey);
      if (currentRF.eq(0)) {
        console.log(`  Setting RESERVE_FACTOR (${isLong ? "long" : "short"})...`);
        await (await dataStore.setUint(rfKey, reserveFactor)).wait();
        console.log(`  ✅ Set to 90%`);
      } else {
        console.log(`  ✅ RESERVE_FACTOR (${isLong ? "long" : "short"}) already set`);
      }
    }

    // OPEN_INTEREST_RESERVE_FACTOR (per side: long and short)
    for (const isLong of [true, false]) {
      const oirfKey = hashData(
        ["bytes32", "address", "bool"],
        [OPEN_INTEREST_RESERVE_FACTOR, market.marketToken, isLong]
      );
      const currentOIRF = await dataStore.getUint(oirfKey);
      if (currentOIRF.eq(0)) {
        console.log(`  Setting OPEN_INTEREST_RESERVE_FACTOR (${isLong ? "long" : "short"})...`);
        await (await dataStore.setUint(oirfKey, openInterestReserveFactor)).wait();
        console.log(`  ✅ Set to 80%`);
      } else {
        console.log(`  ✅ OPEN_INTEREST_RESERVE_FACTOR (${isLong ? "long" : "short"}) already set`);
      }
    }
  }

  // =============================================
  // STEP 4: Set TOKEN_TRANSFER_GAS_LIMIT for market tokens
  // =============================================
  // The WithdrawalHandler (and other handlers) need a gas limit configured
  // in the DataStore for every token they transfer. Market tokens (GM tokens)
  // are created during market deployment but don't get this config automatically.
  // Without it, executeWithdrawal reverts with EmptyTokenTranferGasLimit.
  console.log("\n=== Step 4: Set Token Transfer Gas Limits ===\n");

  const TOKEN_TRANSFER_GAS_LIMIT = hashString("TOKEN_TRANSFER_GAS_LIMIT");
  const transferGasLimit = 200_000; // Standard value from config/general.ts

  for (const market of markets) {
    const gasLimitKey = hashData(["bytes32", "address"], [TOKEN_TRANSFER_GAS_LIMIT, market.marketToken]);
    const currentGasLimit = await dataStore.getUint(gasLimitKey);
    if (currentGasLimit.eq(0)) {
      console.log(`  Setting TOKEN_TRANSFER_GAS_LIMIT for market token ${market.marketToken}...`);
      await (await dataStore.setUint(gasLimitKey, transferGasLimit)).wait();
      console.log(`  ✅ Set to ${transferGasLimit}`);
    } else {
      console.log(`  ✅ TOKEN_TRANSFER_GAS_LIMIT already set for ${market.marketToken}: ${currentGasLimit}`);
    }
  }

  // =============================================
  // STEP 5: Set MAX_PNL_FACTOR for withdrawals, deposits, and traders
  // =============================================
  // GMX checks the PnL-to-pool ratio before allowing withdrawals/deposits.
  // If MAX_PNL_FACTOR_FOR_WITHDRAWALS is 0, any non-zero PnL blocks withdrawals
  // with error: PnlFactorExceededForShorts(pnlToPoolFactor=X, maxPnlFactor=0)
  console.log("\n=== Step 5: Set PnL Factor Limits ===\n");

  const MAX_PNL_FACTOR = hashString("MAX_PNL_FACTOR");
  const MAX_PNL_FACTOR_FOR_WITHDRAWALS = hashString("MAX_PNL_FACTOR_FOR_WITHDRAWALS");
  const MAX_PNL_FACTOR_FOR_DEPOSITS = hashString("MAX_PNL_FACTOR_FOR_DEPOSITS");
  const MAX_PNL_FACTOR_FOR_TRADERS = hashString("MAX_PNL_FACTOR_FOR_TRADERS");

  // 70% = 7 * 10^29 (30-decimal float) — standard GMX value
  const maxPnlForWithdrawals = ethers.BigNumber.from(7).mul(ethers.BigNumber.from(10).pow(29));
  // 90% for deposits
  const maxPnlForDeposits = ethers.BigNumber.from(9).mul(ethers.BigNumber.from(10).pow(29));
  // 90% for traders
  const maxPnlForTraders = ethers.BigNumber.from(9).mul(ethers.BigNumber.from(10).pow(29));

  const pnlConfigs = [
    {
      label: "MAX_PNL_FACTOR_FOR_WITHDRAWALS",
      typeHash: MAX_PNL_FACTOR_FOR_WITHDRAWALS,
      value: maxPnlForWithdrawals,
      pct: "70%",
    },
    {
      label: "MAX_PNL_FACTOR_FOR_DEPOSITS",
      typeHash: MAX_PNL_FACTOR_FOR_DEPOSITS,
      value: maxPnlForDeposits,
      pct: "90%",
    },
    { label: "MAX_PNL_FACTOR_FOR_TRADERS", typeHash: MAX_PNL_FACTOR_FOR_TRADERS, value: maxPnlForTraders, pct: "90%" },
  ];

  for (const market of markets) {
    for (const isLong of [true, false]) {
      for (const cfg of pnlConfigs) {
        const key = hashData(
          ["bytes32", "bytes32", "address", "bool"],
          [MAX_PNL_FACTOR, cfg.typeHash, market.marketToken, isLong]
        );
        const current = await dataStore.getUint(key);
        if (current.eq(0)) {
          await (await dataStore.setUint(key, cfg.value)).wait();
          console.log(`  ✅ ${cfg.label} (${isLong ? "long" : "short"}) set to ${cfg.pct} for ${market.marketToken}`);
        } else {
          console.log(`  ✅ ${cfg.label} (${isLong ? "long" : "short"}) already set for ${market.marketToken}`);
        }
      }
    }
  }

  // =============================================
  // STEP 6: Verify configuration
  // =============================================
  console.log("\n=== Step 6: Verify Configuration ===\n");

  if (markets.length > 0) {
    const sampleMarket = markets[0];
    console.log(`Sample market: ${sampleMarket.marketToken}`);

    const verifyMaxPoolUsdKey = hashData(
      ["bytes32", "address", "address"],
      [MAX_POOL_USD_FOR_DEPOSIT, sampleMarket.marketToken, sampleMarket.longToken]
    );
    const verifyMaxPoolUsd = await dataStore.getUint(verifyMaxPoolUsdKey);
    console.log("  MAX_POOL_USD_FOR_DEPOSIT:", ethers.utils.formatUnits(verifyMaxPoolUsd, 30), "USD");

    const verifyMaxPoolAmountKey = hashData(
      ["bytes32", "address", "address"],
      [MAX_POOL_AMOUNT, sampleMarket.marketToken, sampleMarket.longToken]
    );
    const verifyMaxPoolAmount = await dataStore.getUint(verifyMaxPoolAmountKey);
    console.log("  MAX_POOL_AMOUNT:", ethers.utils.formatUnits(verifyMaxPoolAmount, 6), "USDT");

    const verifyMaxCollKey = hashData(
      ["bytes32", "address", "address", "bool"],
      [MAX_COLLATERAL_SUM, sampleMarket.marketToken, sampleMarket.longToken, true]
    );
    const verifyMaxColl = await dataStore.getUint(verifyMaxCollKey);
    console.log("  MAX_COLLATERAL_SUM (long):", ethers.utils.formatUnits(verifyMaxColl, 6), "USDT");

    const verifyMaxOIKey = hashData(
      ["bytes32", "address", "bool"],
      [MAX_OPEN_INTEREST, sampleMarket.marketToken, true]
    );
    const verifyMaxOI = await dataStore.getUint(verifyMaxOIKey);
    console.log("  MAX_OPEN_INTEREST (long):", ethers.utils.formatUnits(verifyMaxOI, 30), "USD");

    const providerKey = hashData(
      ["bytes32", "address", "address"],
      [ORACLE_PROVIDER_FOR_TOKEN, oracleDeployment.address, sampleMarket.longToken]
    );
    const provider = await dataStore.getAddress(providerKey);
    console.log("  Oracle provider for long token:", provider);

    const verifyPriceFeedKey = hashData(["bytes32", "address"], [PRICE_FEED, sampleMarket.longToken]);
    const verifyPriceFeed = await dataStore.getAddress(verifyPriceFeedKey);
    console.log("  Price feed for long token:", verifyPriceFeed);

    const verifyIndexPriceFeedKey = hashData(["bytes32", "address"], [PRICE_FEED, sampleMarket.indexToken]);
    const verifyIndexPriceFeed = await dataStore.getAddress(verifyIndexPriceFeedKey);
    console.log("  Price feed for index token:", verifyIndexPriceFeed);
  }

  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║           CONFIGURATION COMPLETE                              ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  console.log("Next steps:");
  console.log("1. Add liquidity:    npm run local:add-liquidity");
  console.log("2. Execute deposits: npm run local:execute-deposits");
  console.log("3. Create orders via the frontend or: npm run local:simulate-order");
  console.log("4. Execute orders:   npm run local:execute-orders");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
