/**
 * Check feature flags and other potential blockers
 */
import { deployments, ethers } from "hardhat";

function hashString(value: string): string {
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(value));
}

function hashData(types: string[], values: any[]): string {
  return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(types, values));
}

async function main() {
  console.log("=== Checking Feature Flags and Configuration ===\n");

  const dataStore = await ethers.getContractAt("DataStore", (await deployments.get("DataStore")).address);
  const orderHandler = await ethers.getContractAt("OrderHandler", (await deployments.get("OrderHandler")).address);

  // Order types
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

  // Feature disabled keys
  const CREATE_ORDER_FEATURE_DISABLED = hashString("CREATE_ORDER_FEATURE_DISABLED");
  const EXECUTE_ORDER_FEATURE_DISABLED = hashString("EXECUTE_ORDER_FEATURE_DISABLED");
  const CREATE_DEPOSIT_FEATURE_DISABLED = hashString("CREATE_DEPOSIT_FEATURE_DISABLED");
  const _EXECUTE_DEPOSIT_FEATURE_DISABLED = hashString("EXECUTE_DEPOSIT_FEATURE_DISABLED");

  console.log("OrderHandler:", orderHandler.address);
  console.log();

  // Check if CREATE_ORDER is disabled for each order type
  console.log("=== Create Order Feature Disabled? ===\n");
  for (const [name, type] of Object.entries(OrderType)) {
    const key = hashData(
      ["bytes32", "address", "uint256"],
      [CREATE_ORDER_FEATURE_DISABLED, orderHandler.address, type]
    );
    const isDisabled = await dataStore.getBool(key);
    console.log(`  ${name} (${type}): ${isDisabled ? "❌ DISABLED" : "✅ Enabled"}`);
  }

  // Check if EXECUTE_ORDER is disabled
  console.log("\n=== Execute Order Feature Disabled? ===\n");
  for (const [name, type] of Object.entries(OrderType)) {
    const key = hashData(
      ["bytes32", "address", "uint256"],
      [EXECUTE_ORDER_FEATURE_DISABLED, orderHandler.address, type]
    );
    const isDisabled = await dataStore.getBool(key);
    console.log(`  ${name} (${type}): ${isDisabled ? "❌ DISABLED" : "✅ Enabled"}`);
  }

  // Check deposit features
  const depositHandler = (await deployments.get("DepositHandler")).address;
  console.log("\n=== Deposit Features ===\n");

  const createDepositKey = hashData(["bytes32", "address"], [CREATE_DEPOSIT_FEATURE_DISABLED, depositHandler]);
  const createDepositDisabled = await dataStore.getBool(createDepositKey);
  console.log(`  CREATE_DEPOSIT: ${createDepositDisabled ? "❌ DISABLED" : "✅ Enabled"}`);

  // Check max callback gas limit
  const MAX_CALLBACK_GAS_LIMIT = hashString("MAX_CALLBACK_GAS_LIMIT");
  const maxCallbackGas = await dataStore.getUint(MAX_CALLBACK_GAS_LIMIT);
  console.log("\n=== Other Settings ===\n");
  console.log("  MAX_CALLBACK_GAS_LIMIT:", maxCallbackGas.toString());

  // Check estimated gas fee base amount
  const ESTIMATED_GAS_FEE_BASE_AMOUNT = hashString("ESTIMATED_GAS_FEE_BASE_AMOUNT");
  const ESTIMATED_GAS_FEE_BASE_AMOUNT_V2_1 = hashString("ESTIMATED_GAS_FEE_BASE_AMOUNT_V2_1");
  const ESTIMATED_GAS_FEE_MULTIPLIER_FACTOR = hashString("ESTIMATED_GAS_FEE_MULTIPLIER_FACTOR");
  const EXECUTION_GAS_FEE_BASE_AMOUNT = hashString("EXECUTION_GAS_FEE_BASE_AMOUNT");
  const EXECUTION_GAS_FEE_BASE_AMOUNT_V2_1 = hashString("EXECUTION_GAS_FEE_BASE_AMOUNT_V2_1");
  const EXECUTION_GAS_FEE_MULTIPLIER_FACTOR = hashString("EXECUTION_GAS_FEE_MULTIPLIER_FACTOR");

  const estGasBase = await dataStore.getUint(ESTIMATED_GAS_FEE_BASE_AMOUNT);
  const estGasBaseV2 = await dataStore.getUint(ESTIMATED_GAS_FEE_BASE_AMOUNT_V2_1);
  const estGasMultiplier = await dataStore.getUint(ESTIMATED_GAS_FEE_MULTIPLIER_FACTOR);
  const execGasBase = await dataStore.getUint(EXECUTION_GAS_FEE_BASE_AMOUNT);
  const execGasBaseV2 = await dataStore.getUint(EXECUTION_GAS_FEE_BASE_AMOUNT_V2_1);
  const execGasMultiplier = await dataStore.getUint(EXECUTION_GAS_FEE_MULTIPLIER_FACTOR);

  console.log("  ESTIMATED_GAS_FEE_BASE_AMOUNT:", estGasBase.toString());
  console.log("  ESTIMATED_GAS_FEE_BASE_AMOUNT_V2_1:", estGasBaseV2.toString());
  console.log("  ESTIMATED_GAS_FEE_MULTIPLIER_FACTOR:", estGasMultiplier.toString());
  console.log("  EXECUTION_GAS_FEE_BASE_AMOUNT:", execGasBase.toString());
  console.log("  EXECUTION_GAS_FEE_BASE_AMOUNT_V2_1:", execGasBaseV2.toString());
  console.log("  EXECUTION_GAS_FEE_MULTIPLIER_FACTOR:", execGasMultiplier.toString());

  // Check SINGLE_SWAP_GAS_LIMIT
  const singleSwapGas = await dataStore.getUint(hashString("SINGLE_SWAP_GAS_LIMIT"));
  const increaseOrderGas = await dataStore.getUint(hashString("INCREASE_ORDER_GAS_LIMIT"));
  const decreaseOrderGas = await dataStore.getUint(hashString("DECREASE_ORDER_GAS_LIMIT"));
  const swapOrderGas = await dataStore.getUint(hashString("SWAP_ORDER_GAS_LIMIT"));

  console.log("\n=== Gas Limits ===\n");
  console.log("  SINGLE_SWAP_GAS_LIMIT:", singleSwapGas.toString());
  console.log("  INCREASE_ORDER_GAS_LIMIT:", increaseOrderGas.toString());
  console.log("  DECREASE_ORDER_GAS_LIMIT:", decreaseOrderGas.toString());
  console.log("  SWAP_ORDER_GAS_LIMIT:", swapOrderGas.toString());

  // Check dataList max length
  const MAX_ORDER_DATA_LIST_LENGTH = hashString("MAX_ORDER_DATA_LIST_LENGTH");
  const maxDataListLength = await dataStore.getUint(MAX_ORDER_DATA_LIST_LENGTH);
  console.log("  MAX_ORDER_DATA_LIST_LENGTH:", maxDataListLength.toString());

  console.log("\n=== Debug Complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
