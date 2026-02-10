/**
 * NIVO KEEPER - COMPREHENSIVE END-TO-END TEST
 *
 * Single-file test that validates the complete keeper flow on localhost Hardhat.
 * Includes oracle configuration so no separate setup scripts are needed.
 *
 * PHASE 1: SETUP
 *   - Configure oracle provider (ChainlinkDataStreamProvider) for all tokens
 *   - Set Data Stream Feed IDs and multipliers
 *   - Grant keeper roles (ORDER_KEEPER, LIQUIDATION_KEEPER, etc.)
 *
 * PHASE 2: LIQUIDITY
 *   - Create GM deposit (add liquidity) → keeper executes
 *   - Create GM withdrawal (remove liquidity) → keeper executes
 *
 * PHASE 3: OPEN POSITIONS
 *   - Open LONG position (MarketIncrease) → keeper executes
 *   - Open SHORT position (MarketIncrease) → keeper executes
 *
 * PHASE 4: POSITION UPDATES
 *   - Increase LONG position size → keeper executes
 *   - Increase SHORT position size → keeper executes
 *
 * PHASE 5: CLOSE POSITIONS
 *   - Close LONG position (MarketDecrease) → keeper executes
 *   - Close SHORT position (MarketDecrease) → keeper executes
 *   - Verify PnL
 *
 * PHASE 6: LIQUIDATION
 *   - Create real position through normal flow → keeper executes
 *   - Reduce collateral in DataStore to make position underwater
 *   - Verify positionMonitor detects and liquidates
 *
 * Prerequisites:
 *   - Hardhat node running with contracts deployed: `npx hardhat node`
 *   - Keeper running: `cd nivo-keeper && npm run setup-local && npm run dev`
 *
 * Usage:
 *   npx hardhat run scripts/nivo-scripts/keeper-test/fullE2ETest.ts --network localhost
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { expandDecimals } from "../../../utils/math";

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEPLOYMENT_DIR = path.join(__dirname, "../../../deployments/localhost");
const KEEPER_TIMEOUT_MS = 60000; // 60 seconds max wait for keeper
const POLL_INTERVAL_MS = 2000; // Check every 2 seconds

// Colors for terminal output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

// Read address from deployment file
function getAddress(contractName: string): string {
  const filePath = path.join(DEPLOYMENT_DIR, `${contractName}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Deployment not found: ${contractName}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8")).address;
}

// DataStore keys
const encodeKey = (name: string) => ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], [name]));

const DATASTORE_KEYS = {
  ORDER_LIST: encodeKey("ORDER_LIST"),
  DEPOSIT_LIST: encodeKey("DEPOSIT_LIST"),
  WITHDRAWAL_LIST: encodeKey("WITHDRAWAL_LIST"),
  POSITION_LIST: encodeKey("POSITION_LIST"),
  ACCOUNT_POSITION_LIST: encodeKey("ACCOUNT_POSITION_LIST"),
};

// Role keys
const ROLES = {
  ORDER_KEEPER: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ORDER_KEEPER")),
  LIQUIDATION_KEEPER: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LIQUIDATION_KEEPER")),
  ADL_KEEPER: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADL_KEEPER")),
  CONTROLLER: ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CONTROLLER")),
};

const OrderType = {
  MarketSwap: 0,
  LimitSwap: 1,
  MarketIncrease: 2,
  LimitIncrease: 3,
  MarketDecrease: 4,
  LimitDecrease: 5,
  StopLossDecrease: 6,
  Liquidation: 7,
  StopIncrease: 8,
};

// ============================================================================
// ORACLE CONFIGURATION
// ============================================================================

// Chainlink Data Streams Feed IDs (from Chainlink testnet)
const FEED_IDS: Record<string, { feedId: string; decimals: number }> = {
  EUR: { feedId: "0x0008a5f1391bcc93839075abbbd2b10eaf17cbc278996e843a2e38352f60a7a5", decimals: 8 },
  GBP: { feedId: "0x00080ca16a0bd5d3f0cc24e02fbc06efe330310ea08ba116a419d8ae09fc2047", decimals: 8 },
  USDC: { feedId: "0x0003dc85e8b01946bf9dfd8b0db860129181eb6105a8c8981d9f28e00b6f60d9", decimals: 18 },
  USDT: { feedId: "0x0003e5db714c2d3b0e0b544e6b47f5e0e72c2c77d15e38da5f52f7012ef3b8b1", decimals: 18 },
};

// Required by MockDataStreamVerifier - hardcoded fee token check
const MOCK_FEE_TOKEN = "0x99bbA657f2BbC93c02D617f8bA121cB8Fc104Acf";

const LOCALHOST_CHAIN_ID = 31337;
const SYNTHETIC_SYMBOLS = ["EUR", "GBP", "BRL", "MXN", "COP", "IDR", "PHP", "PEN", "NGN", "KES", "ZAR", "THB"];

function getSyntheticTokenAddress(chainId: number, tokenSymbol: string): string {
  const encoded = ethers.utils.defaultAbiCoder.encode(["uint256", "string"], [chainId, tokenSymbol]);
  return "0x" + ethers.utils.keccak256(encoded).slice(-40);
}

// DataStore key builders for oracle config (matches Keys.sol)
function oracleProviderForTokenKey(oracleAddress: string, tokenAddress: string): string {
  const BASE = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ORACLE_PROVIDER_FOR_TOKEN"]));
  return ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["bytes32", "address", "address"], [BASE, oracleAddress, tokenAddress])
  );
}

function dataStreamIdKey(tokenAddress: string): string {
  const BASE = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["DATA_STREAM_ID"]));
  return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [BASE, tokenAddress]));
}

function dataStreamMultiplierKey(tokenAddress: string): string {
  const BASE = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["DATA_STREAM_MULTIPLIER"]));
  return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [BASE, tokenAddress]));
}

async function configureOracle(dataStore: any, roleStore: any, deployer: any) {
  const oracleAddress = getAddress("Oracle");
  const chainlinkProvider = getAddress("ChainlinkDataStreamProvider");
  const usdcAddress = getAddress("USDC");
  const usdtAddress = getAddress("USDT");

  log("Oracle", `Oracle: ${oracleAddress}`);
  log("Oracle", `ChainlinkProvider: ${chainlinkProvider}`);

  // Grant CONTROLLER role if needed
  const CONTROLLER = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("CONTROLLER"));
  if (!(await roleStore.hasRole(deployer.address, CONTROLLER))) {
    await roleStore.grantRole(deployer.address, CONTROLLER);
  }

  // Set CHAINLINK_PAYMENT_TOKEN (required by MockDataStreamVerifier)
  const PAYMENT_TOKEN_KEY = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["string"], ["CHAINLINK_PAYMENT_TOKEN"])
  );
  const currentPaymentToken = await dataStore.getAddress(PAYMENT_TOKEN_KEY);
  if (currentPaymentToken.toLowerCase() !== MOCK_FEE_TOKEN.toLowerCase()) {
    await dataStore.setAddress(PAYMENT_TOKEN_KEY, MOCK_FEE_TOKEN);
    log("Oracle", `Set CHAINLINK_PAYMENT_TOKEN`, "success");
  }

  // Build token list: collateral tokens + synthetic tokens
  const tokensToConfig = [
    { symbol: "USDC", address: usdcAddress, decimals: 6 },
    { symbol: "USDT", address: usdtAddress, decimals: 6 },
    ...SYNTHETIC_SYMBOLS.map((s) => ({
      symbol: s,
      address: getSyntheticTokenAddress(LOCALHOST_CHAIN_ID, s),
      decimals: 18,
    })),
  ];

  // Configure oracle provider for each token
  let providerCount = 0;
  for (const token of tokensToConfig) {
    const key = oracleProviderForTokenKey(oracleAddress, token.address);
    const currentProvider = await dataStore.getAddress(key);
    if (currentProvider.toLowerCase() !== chainlinkProvider.toLowerCase()) {
      await dataStore.setAddress(key, chainlinkProvider);
      providerCount++;
    }
  }
  log("Oracle", `Oracle provider configured for ${tokensToConfig.length} tokens (${providerCount} updated)`, "success");

  // Configure Data Stream Feed IDs and multipliers
  let feedCount = 0;
  for (const token of tokensToConfig) {
    const feedConfig = FEED_IDS[token.symbol];
    if (!feedConfig) continue;

    await dataStore.setBytes32(dataStreamIdKey(token.address), feedConfig.feedId);
    const multiplier = expandDecimals(1, 60 - token.decimals - feedConfig.decimals);
    await dataStore.setUint(dataStreamMultiplierKey(token.address), multiplier);
    feedCount++;
  }
  log("Oracle", `Feed IDs configured for ${feedCount} tokens`, "success");
}

// Position storage field keys (from PositionStoreUtils.sol)
const encodeField = (field: string) => ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], [field]));

const POSITION_FIELDS = {
  ACCOUNT: encodeField("ACCOUNT"),
  MARKET: encodeField("MARKET"),
  COLLATERAL_TOKEN: encodeField("COLLATERAL_TOKEN"),
  SIZE_IN_USD: encodeField("SIZE_IN_USD"),
  SIZE_IN_TOKENS: encodeField("SIZE_IN_TOKENS"),
  COLLATERAL_AMOUNT: encodeField("COLLATERAL_AMOUNT"),
  BORROWING_FACTOR: encodeField("BORROWING_FACTOR"),
  FUNDING_FEE_AMOUNT_PER_SIZE: encodeField("FUNDING_FEE_AMOUNT_PER_SIZE"),
  LONG_TOKEN_CLAIMABLE_FUNDING_AMOUNT_PER_SIZE: encodeField("LONG_TOKEN_CLAIMABLE_FUNDING_AMOUNT_PER_SIZE"),
  SHORT_TOKEN_CLAIMABLE_FUNDING_AMOUNT_PER_SIZE: encodeField("SHORT_TOKEN_CLAIMABLE_FUNDING_AMOUNT_PER_SIZE"),
  INCREASED_AT_TIME: encodeField("INCREASED_AT_TIME"),
  DECREASED_AT_TIME: encodeField("DECREASED_AT_TIME"),
  IS_LONG: encodeField("IS_LONG"),
};

// ============================================================================
// HELPERS
// ============================================================================

function log(phase: string, message: string, status?: "success" | "error" | "info" | "warn") {
  const statusColors = {
    success: colors.green,
    error: colors.red,
    info: colors.blue,
    warn: colors.yellow,
  };
  const color = status ? statusColors[status] : colors.reset;
  console.log(`${color}[${phase}]${colors.reset} ${message}`);
}

function header(title: string) {
  console.log("\n" + colors.bold + colors.cyan + "═".repeat(80));
  console.log("  " + title);
  console.log("═".repeat(80) + colors.reset + "\n");
}

function subheader(title: string) {
  console.log("\n" + colors.yellow + "─".repeat(60));
  console.log("  " + title);
  console.log("─".repeat(60) + colors.reset);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface WaitResult {
  success: boolean;
  initialCount: number;
  finalCount: number;
  executedCount: number;
}

async function waitForKeeperExecution(
  dataStore: any,
  listKey: string,
  expectedExecutions: number,
  timeoutMs: number = KEEPER_TIMEOUT_MS
): Promise<WaitResult> {
  const initialCount = (await dataStore.getBytes32Count(listKey)).toNumber();
  const targetCount = initialCount - expectedExecutions;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const currentCount = (await dataStore.getBytes32Count(listKey)).toNumber();
    if (currentCount <= targetCount) {
      return {
        success: true,
        initialCount,
        finalCount: currentCount,
        executedCount: initialCount - currentCount,
      };
    }
    log("Wait", `Pending: ${currentCount} (target: ${targetCount})`, "info");
    await sleep(POLL_INTERVAL_MS);
  }

  const finalCount = (await dataStore.getBytes32Count(listKey)).toNumber();
  return {
    success: false,
    initialCount,
    finalCount,
    executedCount: initialCount - finalCount,
  };
}

// Test result tracking
interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const testResults: TestResult[] = [];

function recordTest(name: string, passed: boolean, details?: string) {
  testResults.push({ name, passed, details });
  if (passed) {
    log("TEST", `✅ ${name}`, "success");
  } else {
    log("TEST", `❌ ${name}${details ? ": " + details : ""}`, "error");
  }
}

// ============================================================================
// MAIN TEST
// ============================================================================

async function main() {
  header("NIVO KEEPER - COMPREHENSIVE END-TO-END TEST");
  const startTime = Date.now();

  // Get signers
  const [deployer, longUser, shortUser, liquidationUser] = await ethers.getSigners();
  log("Setup", `Deployer: ${deployer.address}`);
  log("Setup", `Long User: ${longUser.address}`);
  log("Setup", `Short User: ${shortUser.address}`);
  log("Setup", `Liquidation User: ${liquidationUser.address}`);

  // Load contract addresses dynamically
  const addresses = {
    dataStore: getAddress("DataStore"),
    roleStore: getAddress("RoleStore"),
    reader: getAddress("Reader"),
    depositHandler: getAddress("DepositHandler"),
    withdrawalHandler: getAddress("WithdrawalHandler"),
    orderHandler: getAddress("OrderHandler"),
    depositVault: getAddress("DepositVault"),
    withdrawalVault: getAddress("WithdrawalVault"),
    orderVault: getAddress("OrderVault"),
    usdc: getAddress("USDC"),
    wnt: getAddress("WETH"),
  };

  log("Setup", `DataStore: ${addresses.dataStore}`);
  log("Setup", `OrderHandler: ${addresses.orderHandler}`);

  // Load contracts
  const dataStore = await ethers.getContractAt("DataStore", addresses.dataStore);
  const roleStore = await ethers.getContractAt("RoleStore", addresses.roleStore);
  const reader = await ethers.getContractAt("Reader", addresses.reader);
  const depositHandler = await ethers.getContractAt("DepositHandler", addresses.depositHandler);
  const withdrawalHandler = await ethers.getContractAt("WithdrawalHandler", addresses.withdrawalHandler);
  const orderHandler = await ethers.getContractAt("OrderHandler", addresses.orderHandler);
  const usdc = await ethers.getContractAt("MintableToken", addresses.usdc);
  const wnt = await ethers.getContractAt("MintableToken", addresses.wnt);

  // Find the GBP market (or first available)
  const markets = await reader.getMarkets(addresses.dataStore, 0, 10);
  if (markets.length === 0) {
    throw new Error("No markets found! Deploy markets first.");
  }
  const market = markets[0];
  const marketToken = await ethers.getContractAt("MarketToken", market.marketToken);

  log("Setup", `Market: ${market.marketToken}`);
  log("Setup", `  Index: ${market.indexToken}`);
  log("Setup", `  Long: ${market.longToken}`);
  log("Setup", `  Short: ${market.shortToken}`);

  // =========================================================================
  // PHASE 1: SETUP - Oracle Configuration + Roles
  // =========================================================================
  header("PHASE 1: SETUP");

  subheader("Configure Oracle Provider");
  await configureOracle(dataStore, roleStore, deployer);

  subheader("Grant Keeper Roles");

  // Grant all necessary roles
  for (const [name, roleKey] of Object.entries(ROLES)) {
    if (!(await roleStore.hasRole(deployer.address, roleKey))) {
      await roleStore.grantRole(deployer.address, roleKey);
      log("Roles", `Granted ${name} to deployer`, "success");
    } else {
      log("Roles", `${name} already granted`, "info");
    }
  }

  // =========================================================================
  // PHASE 2: LIQUIDITY MANAGEMENT
  // =========================================================================
  header("PHASE 2: LIQUIDITY MANAGEMENT");

  // Track initial balances
  const initialLongUserUsdc = await usdc.balanceOf(longUser.address);
  log("Balance", `Long User initial USDC: ${ethers.utils.formatUnits(initialLongUserUsdc, 6)}`);

  // ----- 2A: Add Liquidity (GM Deposit) -----
  subheader("2A: Add Liquidity (GM Deposit)");

  const depositAmount = expandDecimals(100000, 6); // 100,000 USDC
  const depositExecutionFee = expandDecimals(1, 16); // 0.01 ETH

  // Mint tokens to deposit vault
  await usdc.mint(addresses.depositVault, depositAmount);
  await wnt.mint(addresses.depositVault, depositExecutionFee);
  log("Deposit", `Minted ${ethers.utils.formatUnits(depositAmount, 6)} USDC to vault`);

  // Create deposit
  const depositParams = {
    addresses: {
      receiver: longUser.address,
      callbackContract: ethers.constants.AddressZero,
      uiFeeReceiver: ethers.constants.AddressZero,
      market: market.marketToken,
      initialLongToken: market.longToken,
      initialShortToken: market.shortToken,
      longTokenSwapPath: [],
      shortTokenSwapPath: [],
    },
    minMarketTokens: 0,
    shouldUnwrapNativeToken: false,
    executionFee: depositExecutionFee,
    callbackGasLimit: 0,
    dataList: [],
  };

  await depositHandler.createDeposit(longUser.address, 0, depositParams);
  log("Deposit", "Created deposit request");

  // Wait for keeper
  log("Deposit", "Waiting for keeper to execute deposit...");
  const depositResult = await waitForKeeperExecution(dataStore, DATASTORE_KEYS.DEPOSIT_LIST, 1);

  if (depositResult.success) {
    const lpBalance = await marketToken.balanceOf(longUser.address);
    log("Deposit", `LP tokens received: ${ethers.utils.formatEther(lpBalance)}`, "success");
    recordTest("GM Deposit Execution", true);
  } else {
    log("Deposit", `TIMEOUT - Executed ${depositResult.executedCount}/${1}`, "error");
    recordTest("GM Deposit Execution", false, "Timeout waiting for keeper");
  }

  // ----- 2B: Remove Liquidity (GM Withdrawal) -----
  subheader("2B: Remove Liquidity (GM Withdrawal)");

  const lpBalance = await marketToken.balanceOf(longUser.address);
  if (lpBalance.gt(0)) {
    const withdrawAmount = lpBalance.div(4); // Withdraw 25%
    const withdrawalExecutionFee = expandDecimals(1, 16);

    // Transfer LP tokens to withdrawal vault
    await marketToken.connect(longUser).transfer(addresses.withdrawalVault, withdrawAmount);
    await wnt.mint(addresses.withdrawalVault, withdrawalExecutionFee);
    log("Withdrawal", `Transferring ${ethers.utils.formatEther(withdrawAmount)} LP to vault`);

    const withdrawalParams = {
      addresses: {
        receiver: longUser.address,
        callbackContract: ethers.constants.AddressZero,
        uiFeeReceiver: ethers.constants.AddressZero,
        market: market.marketToken,
        longTokenSwapPath: [],
        shortTokenSwapPath: [],
      },
      minLongTokenAmount: 0,
      minShortTokenAmount: 0,
      shouldUnwrapNativeToken: false,
      executionFee: withdrawalExecutionFee,
      callbackGasLimit: 0,
      dataList: [],
    };

    await withdrawalHandler.createWithdrawal(longUser.address, 0, withdrawalParams);
    log("Withdrawal", "Created withdrawal request");

    // Wait for keeper
    log("Withdrawal", "Waiting for keeper to execute withdrawal...");
    const withdrawalResult = await waitForKeeperExecution(dataStore, DATASTORE_KEYS.WITHDRAWAL_LIST, 1);

    if (withdrawalResult.success) {
      const usdcBalance = await usdc.balanceOf(longUser.address);
      log("Withdrawal", `USDC received: ${ethers.utils.formatUnits(usdcBalance, 6)}`, "success");
      recordTest("GM Withdrawal Execution", true);
    } else {
      log("Withdrawal", `TIMEOUT - Executed ${withdrawalResult.executedCount}/${1}`, "error");
      recordTest("GM Withdrawal Execution", false, "Timeout waiting for keeper");
    }
  } else {
    log("Withdrawal", "SKIPPED - No LP tokens to withdraw", "warn");
    recordTest("GM Withdrawal Execution", false, "No LP tokens available");
  }

  // =========================================================================
  // PHASE 3: OPEN POSITIONS
  // =========================================================================
  header("PHASE 3: OPEN POSITIONS");

  const orderCollateral = expandDecimals(1000, 6); // 1,000 USDC
  const orderSize = expandDecimals(5000, 30); // $5,000 position
  const orderExecutionFee = expandDecimals(2, 16); // 0.02 ETH

  // ----- 3A: Open LONG Position -----
  subheader("3A: Open LONG Position");

  await usdc.mint(addresses.orderVault, orderCollateral);
  await wnt.mint(addresses.orderVault, orderExecutionFee);
  log("Long", `Minted ${ethers.utils.formatUnits(orderCollateral, 6)} USDC collateral`);

  const longOrderParams = {
    addresses: {
      receiver: longUser.address,
      cancellationReceiver: longUser.address,
      callbackContract: ethers.constants.AddressZero,
      uiFeeReceiver: ethers.constants.AddressZero,
      market: market.marketToken,
      initialCollateralToken: usdc.address,
      swapPath: [],
    },
    numbers: {
      sizeDeltaUsd: orderSize,
      initialCollateralDeltaAmount: orderCollateral,
      acceptablePrice: expandDecimals(200, 28), // Very high acceptable price for long
      triggerPrice: 0,
      executionFee: orderExecutionFee,
      callbackGasLimit: 0,
      minOutputAmount: 0,
      validFromTime: 0,
    },
    orderType: OrderType.MarketIncrease,
    decreasePositionSwapType: 0,
    isLong: true,
    shouldUnwrapNativeToken: false,
    autoCancel: false,
    referralCode: ethers.constants.HashZero,
    dataList: [],
  };

  await orderHandler.createOrder(longUser.address, 0, longOrderParams, false);
  log("Long", "Created MarketIncrease order (LONG)");

  // ----- 3B: Open SHORT Position -----
  subheader("3B: Open SHORT Position");

  await usdc.mint(addresses.orderVault, orderCollateral);
  await wnt.mint(addresses.orderVault, orderExecutionFee);
  log("Short", `Minted ${ethers.utils.formatUnits(orderCollateral, 6)} USDC collateral`);

  const shortOrderParams = {
    ...longOrderParams,
    addresses: {
      ...longOrderParams.addresses,
      receiver: shortUser.address,
      cancellationReceiver: shortUser.address,
    },
    numbers: {
      ...longOrderParams.numbers,
      acceptablePrice: expandDecimals(1, 28), // Very low acceptable price for short
    },
    isLong: false,
  };

  await orderHandler.createOrder(shortUser.address, 0, shortOrderParams, false);
  log("Short", "Created MarketIncrease order (SHORT)");

  // Wait for both orders to execute
  log("Orders", "Waiting for keeper to execute both orders...");
  const orderResult = await waitForKeeperExecution(dataStore, DATASTORE_KEYS.ORDER_LIST, 2);

  const positionCountAfterOpen = await dataStore.getBytes32Count(DATASTORE_KEYS.POSITION_LIST);
  log("Positions", `Open positions: ${positionCountAfterOpen}`);

  if (orderResult.success && positionCountAfterOpen.gte(2)) {
    recordTest("Open LONG Position", true);
    recordTest("Open SHORT Position", true);
  } else {
    recordTest("Open LONG Position", orderResult.executedCount >= 1, `Executed ${orderResult.executedCount}/2`);
    recordTest("Open SHORT Position", orderResult.executedCount >= 2, `Executed ${orderResult.executedCount}/2`);
  }

  // List positions
  if (positionCountAfterOpen.gt(0)) {
    const positionKeys = await dataStore.getBytes32ValuesAt(DATASTORE_KEYS.POSITION_LIST, 0, positionCountAfterOpen);
    for (let i = 0; i < positionKeys.length; i++) {
      const position = await reader.getPosition(addresses.dataStore, positionKeys[i]);
      const side = position.flags.isLong ? "LONG" : "SHORT";
      log(
        "Position",
        `${side}: $${ethers.utils.formatUnits(position.numbers.sizeInUsd, 30)} size, ${ethers.utils.formatUnits(
          position.numbers.collateralAmount,
          6
        )} USDC collateral`
      );
    }
  }

  // =========================================================================
  // PHASE 4: UPDATE POSITIONS (Increase Size)
  // =========================================================================
  header("PHASE 4: UPDATE POSITIONS");

  if (positionCountAfterOpen.gte(2)) {
    const additionalCollateral = expandDecimals(500, 6); // Add 500 USDC
    const additionalSize = expandDecimals(2500, 30); // Add $2,500 to position

    // ----- 4A: Increase LONG Position -----
    subheader("4A: Increase LONG Position");

    await usdc.mint(addresses.orderVault, additionalCollateral);
    await wnt.mint(addresses.orderVault, orderExecutionFee);

    const increaseLongParams = {
      ...longOrderParams,
      numbers: {
        ...longOrderParams.numbers,
        sizeDeltaUsd: additionalSize,
        initialCollateralDeltaAmount: additionalCollateral,
      },
    };

    await orderHandler.createOrder(longUser.address, 0, increaseLongParams, false);
    log("Long", "Created MarketIncrease order (add to LONG)");

    // ----- 4B: Increase SHORT Position -----
    subheader("4B: Increase SHORT Position");

    await usdc.mint(addresses.orderVault, additionalCollateral);
    await wnt.mint(addresses.orderVault, orderExecutionFee);

    const increaseShortParams = {
      ...shortOrderParams,
      numbers: {
        ...shortOrderParams.numbers,
        sizeDeltaUsd: additionalSize,
        initialCollateralDeltaAmount: additionalCollateral,
      },
    };

    await orderHandler.createOrder(shortUser.address, 0, increaseShortParams, false);
    log("Short", "Created MarketIncrease order (add to SHORT)");

    // Wait for updates
    log("Update", "Waiting for keeper to execute position updates...");
    const updateResult = await waitForKeeperExecution(dataStore, DATASTORE_KEYS.ORDER_LIST, 2);

    if (updateResult.success) {
      recordTest("Update LONG Position", true);
      recordTest("Update SHORT Position", true);
    } else {
      recordTest("Update LONG Position", updateResult.executedCount >= 1);
      recordTest("Update SHORT Position", updateResult.executedCount >= 2);
    }

    // Show updated positions
    const positionKeys = await dataStore.getBytes32ValuesAt(DATASTORE_KEYS.POSITION_LIST, 0, positionCountAfterOpen);
    for (let i = 0; i < positionKeys.length; i++) {
      const position = await reader.getPosition(addresses.dataStore, positionKeys[i]);
      const side = position.flags.isLong ? "LONG" : "SHORT";
      log("Updated", `${side}: $${ethers.utils.formatUnits(position.numbers.sizeInUsd, 30)} size (expected ~$7,500)`);
    }
  } else {
    log("Update", "SKIPPED - No positions to update", "warn");
  }

  // =========================================================================
  // PHASE 5: CLOSE POSITIONS
  // =========================================================================
  header("PHASE 5: CLOSE POSITIONS");

  const positionCountBeforeClose = await dataStore.getBytes32Count(DATASTORE_KEYS.POSITION_LIST);

  if (positionCountBeforeClose.gt(0)) {
    const positionKeys = await dataStore.getBytes32ValuesAt(DATASTORE_KEYS.POSITION_LIST, 0, positionCountBeforeClose);

    // Track balances before closing
    const longUserUsdcBefore = await usdc.balanceOf(longUser.address);
    const shortUserUsdcBefore = await usdc.balanceOf(shortUser.address);

    for (let i = 0; i < positionKeys.length; i++) {
      const position = await reader.getPosition(addresses.dataStore, positionKeys[i]);
      const side = position.flags.isLong ? "LONG" : "SHORT";
      const user = position.addresses.account;

      subheader(`5${String.fromCharCode(65 + i)}: Close ${side} Position`);

      await wnt.mint(addresses.orderVault, orderExecutionFee);

      const closeParams = {
        addresses: {
          receiver: user,
          cancellationReceiver: user,
          callbackContract: ethers.constants.AddressZero,
          uiFeeReceiver: ethers.constants.AddressZero,
          market: market.marketToken,
          initialCollateralToken: position.addresses.collateralToken,
          swapPath: [],
        },
        numbers: {
          sizeDeltaUsd: position.numbers.sizeInUsd, // Close full position
          initialCollateralDeltaAmount: 0,
          acceptablePrice: position.flags.isLong ? 0 : expandDecimals(999999, 28), // Any price OK
          triggerPrice: 0,
          executionFee: orderExecutionFee,
          callbackGasLimit: 0,
          minOutputAmount: 0,
          validFromTime: 0,
        },
        orderType: OrderType.MarketDecrease,
        decreasePositionSwapType: 0,
        isLong: position.flags.isLong,
        shouldUnwrapNativeToken: false,
        autoCancel: false,
        referralCode: ethers.constants.HashZero,
        dataList: [],
      };

      await orderHandler.createOrder(user, 0, closeParams, false);
      log(side, `Created MarketDecrease order to close`);
    }

    // Wait for close orders
    log("Close", "Waiting for keeper to execute close orders...");
    const closeResult = await waitForKeeperExecution(
      dataStore,
      DATASTORE_KEYS.ORDER_LIST,
      positionCountBeforeClose.toNumber()
    );

    const finalPositionCount = await dataStore.getBytes32Count(DATASTORE_KEYS.POSITION_LIST);
    log("Close", `Remaining positions: ${finalPositionCount}`);

    // Calculate PnL
    const longUserUsdcAfter = await usdc.balanceOf(longUser.address);
    const shortUserUsdcAfter = await usdc.balanceOf(shortUser.address);

    const longPnL = longUserUsdcAfter.sub(longUserUsdcBefore);
    const shortPnL = shortUserUsdcAfter.sub(shortUserUsdcBefore);

    log("PnL", `LONG User: ${ethers.utils.formatUnits(longPnL, 6)} USDC`, longPnL.gte(0) ? "success" : "warn");
    log("PnL", `SHORT User: ${ethers.utils.formatUnits(shortPnL, 6)} USDC`, shortPnL.gte(0) ? "success" : "warn");

    recordTest("Close LONG Position", closeResult.success && finalPositionCount.lt(positionCountBeforeClose));
    recordTest("Close SHORT Position", closeResult.success && finalPositionCount.eq(0));
  } else {
    log("Close", "SKIPPED - No positions to close", "warn");
  }

  // =========================================================================
  // PHASE 6: LIQUIDATION TEST
  // =========================================================================
  header("PHASE 6: LIQUIDATION TEST");

  subheader("6A: Create Position for Liquidation");

  // Step 1: Create a real position through the normal GMX flow (keeper executes it)
  const liqCollateral = expandDecimals(1000, 6); // 1,000 USDC
  const liqSize = expandDecimals(5000, 30); // $5,000 position
  const liqExecutionFee = expandDecimals(2, 16); // 0.02 ETH

  await usdc.mint(addresses.orderVault, liqCollateral);
  await wnt.mint(addresses.orderVault, liqExecutionFee);
  log("Liquidation", `Minted ${ethers.utils.formatUnits(liqCollateral, 6)} USDC collateral for liquidation user`);

  const liqOrderParams = {
    addresses: {
      receiver: liquidationUser.address,
      cancellationReceiver: liquidationUser.address,
      callbackContract: ethers.constants.AddressZero,
      uiFeeReceiver: ethers.constants.AddressZero,
      market: market.marketToken,
      initialCollateralToken: usdc.address,
      swapPath: [],
    },
    numbers: {
      sizeDeltaUsd: liqSize,
      initialCollateralDeltaAmount: liqCollateral,
      acceptablePrice: expandDecimals(200, 28),
      triggerPrice: 0,
      executionFee: liqExecutionFee,
      callbackGasLimit: 0,
      minOutputAmount: 0,
      validFromTime: 0,
    },
    orderType: OrderType.MarketIncrease,
    decreasePositionSwapType: 0,
    isLong: true,
    shouldUnwrapNativeToken: false,
    autoCancel: false,
    referralCode: ethers.constants.HashZero,
    dataList: [],
  };

  await orderHandler.createOrder(liquidationUser.address, 0, liqOrderParams, false);
  log("Liquidation", "Created MarketIncrease order (LONG)");

  // Wait for keeper to execute
  log("Liquidation", "Waiting for keeper to execute position order...");
  const liqOrderResult = await waitForKeeperExecution(dataStore, DATASTORE_KEYS.ORDER_LIST, 1);
  if (!liqOrderResult.success) {
    log("Liquidation", "TIMEOUT - Order not executed", "error");
    recordTest("Liquidation Detection & Execution", false, "Position order not executed");
  } else {
    // Verify position was created
    const liqPositionKey = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "address", "bool"],
        [liquidationUser.address, market.marketToken, usdc.address, true]
      )
    );
    log("Liquidation", `Position key: ${liqPositionKey.slice(0, 18)}...`);

    const posCountBefore = await dataStore.getBytes32Count(DATASTORE_KEYS.POSITION_LIST);
    log("Liquidation", `Position created. Total positions: ${posCountBefore}`, "success");

    // Step 2: Make the position underwater by reducing collateral to near-zero
    subheader("6B: Make Position Underwater");

    const storageKey = (posKey: string, field: string) => {
      const encoded = ethers.utils.defaultAbiCoder.encode(["bytes32", "bytes32"], [posKey, field]);
      return ethers.utils.keccak256(encoded);
    };

    // Reduce collateral to just 1 USDC (position has $5000 size -> 5000x leverage = liquidatable)
    const tinyCollateral = expandDecimals(1, 6); // 1 USDC
    await dataStore.setUint(storageKey(liqPositionKey, POSITION_FIELDS.COLLATERAL_AMOUNT), tinyCollateral);

    // Also update the market-level collateralSum to match
    const COLLATERAL_SUM = encodeKey("COLLATERAL_SUM");
    const collateralSumKey = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "address", "address", "bool"],
        [COLLATERAL_SUM, market.marketToken, usdc.address, true]
      )
    );
    await dataStore.setUint(collateralSumKey, tinyCollateral);

    log(
      "Liquidation",
      `Reduced collateral to $${ethers.utils.formatUnits(tinyCollateral, 6)} (5000x leverage)`,
      "success"
    );

    // Step 3: Wait for position monitor to detect and liquidate
    log("Liquidation", "Waiting for keeper positionMonitor to detect liquidation...");
    await sleep(15000);

    const posCountAfter = await dataStore.getBytes32Count(DATASTORE_KEYS.POSITION_LIST);
    const positionLiquidated = posCountAfter.lt(posCountBefore);

    if (positionLiquidated) {
      log("Liquidation", "Position was liquidated!", "success");
      recordTest("Liquidation Detection & Execution", true);
    } else {
      log("Liquidation", "Position not yet liquidated - check keeper logs", "warn");
      recordTest("Liquidation Detection & Execution", false, "Position not liquidated within timeout");
    }
  }

  // =========================================================================
  // FINAL SUMMARY
  // =========================================================================
  header("TEST SUMMARY");

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const passed = testResults.filter((t) => t.passed).length;
  const failed = testResults.filter((t) => !t.passed).length;

  console.log(`\n  Duration: ${elapsed}s`);
  console.log(`  Total Tests: ${testResults.length}`);
  console.log(`  ${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed: ${failed}${colors.reset}\n`);

  console.log("  Test Results:");
  console.log("  " + "─".repeat(50));
  for (const result of testResults) {
    const icon = result.passed ? `${colors.green}✅${colors.reset}` : `${colors.red}❌${colors.reset}`;
    const details = result.details ? ` (${result.details})` : "";
    console.log(`  ${icon} ${result.name}${details}`);
  }
  console.log("  " + "─".repeat(50));

  // Final state
  console.log("\n  Final State:");
  const finalDeposits = await dataStore.getBytes32Count(DATASTORE_KEYS.DEPOSIT_LIST);
  const finalOrders = await dataStore.getBytes32Count(DATASTORE_KEYS.ORDER_LIST);
  const finalWithdrawals = await dataStore.getBytes32Count(DATASTORE_KEYS.WITHDRAWAL_LIST);
  const finalPositions = await dataStore.getBytes32Count(DATASTORE_KEYS.POSITION_LIST);
  const finalLpBalance = await marketToken.balanceOf(longUser.address);
  const finalLongUsdc = await usdc.balanceOf(longUser.address);
  const finalShortUsdc = await usdc.balanceOf(shortUser.address);

  console.log(`  ├── Pending Deposits:    ${finalDeposits}`);
  console.log(`  ├── Pending Orders:      ${finalOrders}`);
  console.log(`  ├── Pending Withdrawals: ${finalWithdrawals}`);
  console.log(`  ├── Open Positions:      ${finalPositions}`);
  console.log(`  ├── Long User LP:        ${ethers.utils.formatEther(finalLpBalance)}`);
  console.log(`  ├── Long User USDC:      ${ethers.utils.formatUnits(finalLongUsdc, 6)}`);
  console.log(`  └── Short User USDC:     ${ethers.utils.formatUnits(finalShortUsdc, 6)}`);

  console.log("\n");

  if (failed === 0) {
    console.log(`  ${colors.green}${colors.bold}🎉 ALL TESTS PASSED!${colors.reset}\n`);
  } else {
    console.log(`  ${colors.yellow}⚠️  Some tests failed - check keeper logs for errors${colors.reset}\n`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
