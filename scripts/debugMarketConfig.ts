/**
 * Debug script to inspect market configuration in DataStore
 */
import { deployments, ethers } from "hardhat";

// Key hash functions from GMX
function hashString(value: string): string {
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(value));
}

function hashData(types: string[], values: any[]): string {
  return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(types, values));
}

async function main() {
  console.log("=== Market Configuration Debug ===\n");

  const dataStore = await ethers.getContractAt("DataStore", (await deployments.get("DataStore")).address);
  const reader = await ethers.getContractAt("Reader", (await deployments.get("Reader")).address);

  const BRL_MARKET = "0x763779b6c23e29C02d675eA0cE6CBFf8DCc328e6";
  const BRL_INDEX = "0xf3aa2cd2ED74463405cE698f3e2ad12dd2808f90";
  const USDT = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

  console.log("Checking market:", BRL_MARKET);
  console.log("Index token:", BRL_INDEX);
  console.log("Collateral token:", USDT);
  console.log();

  // Key base strings
  const IS_MARKET_DISABLED = hashString("IS_MARKET_DISABLED");
  const MAX_POOL_AMOUNT = hashString("MAX_POOL_AMOUNT");
  const MAX_OPEN_INTEREST = hashString("MAX_OPEN_INTEREST");
  const _MIN_COLLATERAL_USD = hashString("MIN_COLLATERAL_USD");
  const _MIN_POSITION_SIZE_USD = hashString("MIN_POSITION_SIZE_USD");
  const RESERVE_FACTOR = hashString("RESERVE_FACTOR");
  const _OPEN_INTEREST_RESERVE_FACTOR = hashString("OPEN_INTEREST_RESERVE_FACTOR");
  const _MAX_PNL_FACTOR = hashString("MAX_PNL_FACTOR");
  const _MAX_PNL_FACTOR_FOR_TRADERS = hashString("MAX_PNL_FACTOR_FOR_TRADERS");
  const _POSITION_IMPACT_FACTOR = hashString("POSITION_IMPACT_FACTOR");
  const _POSITION_IMPACT_EXPONENT = hashString("POSITION_IMPACT_EXPONENT");
  const _SWAP_IMPACT_FACTOR = hashString("SWAP_IMPACT_FACTOR");
  const POSITION_FEE_FACTOR = hashString("POSITION_FEE_FACTOR");
  const _SWAP_FEE_FACTOR = hashString("SWAP_FEE_FACTOR");
  const _FUNDING_FACTOR = hashString("FUNDING_FACTOR");
  const _BORROWING_FACTOR = hashString("BORROWING_FACTOR");

  // Check basic market config
  console.log("=== Basic Configuration ===\n");

  // Is market disabled
  const isDisabledKey = hashData(["bytes32", "address"], [IS_MARKET_DISABLED, BRL_MARKET]);
  const isDisabled = await dataStore.getBool(isDisabledKey);
  console.log("Is Market Disabled:", isDisabled);

  // Max pool amount for USDT
  const maxPoolKey = hashData(["bytes32", "address", "address"], [MAX_POOL_AMOUNT, BRL_MARKET, USDT]);
  const maxPool = await dataStore.getUint(maxPoolKey);
  console.log("Max Pool Amount (USDT):", ethers.utils.formatUnits(maxPool, 6), "USDT");

  // Max open interest for longs
  const maxOILongKey = hashData(["bytes32", "address", "bool"], [MAX_OPEN_INTEREST, BRL_MARKET, true]);
  const maxOILong = await dataStore.getUint(maxOILongKey);
  console.log("Max OI Long:", ethers.utils.formatUnits(maxOILong, 30), "USD");

  // Max open interest for shorts
  const maxOIShortKey = hashData(["bytes32", "address", "bool"], [MAX_OPEN_INTEREST, BRL_MARKET, false]);
  const maxOIShort = await dataStore.getUint(maxOIShortKey);
  console.log("Max OI Short:", ethers.utils.formatUnits(maxOIShort, 30), "USD");

  console.log("\n=== Position Configuration ===\n");

  // Min collateral
  const minCollateralKey = hashString("MIN_COLLATERAL_USD");
  const minCollateral = await dataStore.getUint(minCollateralKey);
  console.log("Min Collateral (global):", ethers.utils.formatUnits(minCollateral, 30), "USD");

  // Min position size
  const minPosSizeKey = hashString("MIN_POSITION_SIZE_USD");
  const minPosSize = await dataStore.getUint(minPosSizeKey);
  console.log("Min Position Size (global):", ethers.utils.formatUnits(minPosSize, 30), "USD");

  console.log("\n=== Fee Configuration ===\n");

  // Position fee factor
  const posFeeLongKey = hashData(["bytes32", "address", "bool"], [POSITION_FEE_FACTOR, BRL_MARKET, true]);
  const posFeeLong = await dataStore.getUint(posFeeLongKey);
  console.log("Position Fee (Long):", posFeeLong.toString());

  const posFeeShortKey = hashData(["bytes32", "address", "bool"], [POSITION_FEE_FACTOR, BRL_MARKET, false]);
  const posFeeShort = await dataStore.getUint(posFeeShortKey);
  console.log("Position Fee (Short):", posFeeShort.toString());

  console.log("\n=== Reserve Factors ===\n");

  // Reserve factor
  const reserveFactorLongKey = hashData(["bytes32", "address", "bool"], [RESERVE_FACTOR, BRL_MARKET, true]);
  const reserveFactorLong = await dataStore.getUint(reserveFactorLongKey);
  console.log("Reserve Factor (Long):", reserveFactorLong.toString());

  const reserveFactorShortKey = hashData(["bytes32", "address", "bool"], [RESERVE_FACTOR, BRL_MARKET, false]);
  const reserveFactorShort = await dataStore.getUint(reserveFactorShortKey);
  console.log("Reserve Factor (Short):", reserveFactorShort.toString());

  console.log("\n=== Oracle Configuration ===\n");

  // Check price feed configuration
  const PRICE_FEED = hashString("PRICE_FEED");
  const priceFeedKeyBRL = hashData(["bytes32", "address"], [PRICE_FEED, BRL_INDEX]);
  const priceFeedBRL = await dataStore.getAddress(priceFeedKeyBRL);
  console.log("BRL Price Feed:", priceFeedBRL);

  const priceFeedKeyUSDT = hashData(["bytes32", "address"], [PRICE_FEED, USDT]);
  const priceFeedUSDT = await dataStore.getAddress(priceFeedKeyUSDT);
  console.log("USDT Price Feed:", priceFeedUSDT);

  // Check if token is enabled
  const TOKEN_TRANSFER_GAS_LIMIT = hashString("TOKEN_TRANSFER_GAS_LIMIT");
  const gasLimitKey = hashData(["bytes32", "address"], [TOKEN_TRANSFER_GAS_LIMIT, USDT]);
  const gasLimit = await dataStore.getUint(gasLimitKey);
  console.log("USDT Transfer Gas Limit:", gasLimit.toString());

  console.log("\n=== Reader Market Info ===\n");

  try {
    const markets = await reader.getMarkets(dataStore.address, 0, 20);
    console.log("Total markets:", markets.length);

    const brlMarket = markets.find((m: any) => m.marketToken.toLowerCase() === BRL_MARKET.toLowerCase());
    if (brlMarket) {
      console.log("\nBRL Market found in list:");
      console.log("  marketToken:", brlMarket.marketToken);
      console.log("  indexToken:", brlMarket.indexToken);
      console.log("  longToken:", brlMarket.longToken);
      console.log("  shortToken:", brlMarket.shortToken);
    }
  } catch (e: any) {
    console.log("Error reading markets:", e.message?.slice(0, 100));
  }

  // Check if the ExchangeRouter can interact with the market
  console.log("\n=== ExchangeRouter Validation ===\n");

  const exchangeRouter = await ethers.getContractAt(
    "ExchangeRouter",
    (
      await deployments.get("ExchangeRouter")
    ).address
  );

  // Check if sendWnt works
  console.log("ExchangeRouter address:", exchangeRouter.address);

  // Check OrderVault
  const orderVault = await ethers.getContractAt("OrderVault", (await deployments.get("OrderVault")).address);
  console.log("OrderVault address:", orderVault.address);

  console.log("\n=== Debug Complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
