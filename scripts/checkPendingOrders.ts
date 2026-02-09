/**
 * Check Pending Orders
 *
 * Lists all pending orders in the system with their details.
 */
import { deployments, ethers } from "hardhat";

// Order type names
const ORDER_TYPE_NAMES: Record<number, string> = {
  0: "MarketSwap",
  1: "LimitSwap",
  2: "MarketIncrease",
  3: "LimitIncrease",
  4: "MarketDecrease",
  5: "LimitDecrease",
  6: "StopLossDecrease",
  7: "Liquidation",
};

// Helper to safely convert BigNumber or BigInt to number
function toNumber(value: any): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (value._isBigNumber) return value.toNumber();
  if (value.toNumber) return value.toNumber();
  return Number(value);
}

// Helper to format units safely
function formatUnits(value: any, decimals: number): string {
  if (value === undefined || value === null) return "0";
  try {
    return ethers.utils.formatUnits(value, decimals);
  } catch {
    return String(value);
  }
}

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║              CHECK PENDING ORDERS                             ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  const [signer] = await ethers.getSigners();
  console.log("Signer:", signer.address);

  // Get contract deployments
  const dataStoreDeployment = await deployments.get("DataStore");
  const readerDeployment = await deployments.get("Reader");

  const dataStore = await ethers.getContractAt("DataStore", dataStoreDeployment.address);
  const reader = await ethers.getContractAt("Reader", readerDeployment.address);

  console.log("DataStore:", dataStoreDeployment.address);
  console.log("Reader:", readerDeployment.address);

  // Get order count using the ORDER_LIST key
  const ORDER_LIST = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_LIST"]));
  const orderCount = await dataStore.getBytes32Count(ORDER_LIST);
  console.log("\n=== Order Summary ===");
  console.log("Total orders in system:", orderCount.toString());

  if (orderCount.eq(0)) {
    console.log("\nNo pending orders found.");
    return;
  }

  // Get all order keys
  const orderKeys = await dataStore.getBytes32ValuesAt(ORDER_LIST, 0, orderCount);

  console.log("\n=== Order Details ===\n");

  for (let i = 0; i < orderKeys.length; i++) {
    const orderKey = orderKeys[i];
    console.log(`Order ${i + 1}/${orderKeys.length}`);
    console.log("─".repeat(50));
    console.log("Key:", orderKey);

    try {
      // Use Reader.getOrder to get order details
      const orderInfo = await reader.getOrder(dataStoreDeployment.address, orderKey);

      const account = orderInfo.addresses.account;
      const market = orderInfo.addresses.market;
      const collateralToken = orderInfo.addresses.initialCollateralToken;
      const orderType = toNumber(orderInfo.numbers.orderType);
      const sizeDeltaUsd = orderInfo.numbers.sizeDeltaUsd;
      const collateralAmount = orderInfo.numbers.initialCollateralDeltaAmount;
      const executionFee = orderInfo.numbers.executionFee;
      const isLong = orderInfo.flags.isLong;
      const isFrozen = orderInfo.flags.isFrozen;

      console.log("Account:", account);
      console.log("Market:", market);
      console.log("Collateral Token:", collateralToken);
      console.log("Order Type:", ORDER_TYPE_NAMES[orderType] || `Unknown (${orderType})`);
      console.log("Size (USD):", formatUnits(sizeDeltaUsd, 30));
      console.log("Collateral:", formatUnits(collateralAmount, 6), "USDT");
      console.log("Execution Fee:", formatUnits(executionFee, 18), "ETH");
      console.log("Direction:", isLong ? "Long" : "Short");
      console.log("Frozen:", isFrozen ? "Yes" : "No");
    } catch (error: any) {
      console.log("Error reading order:", error.message?.slice(0, 100));
    }

    console.log("");
  }

  // Get account-specific orders using direct DataStore query
  console.log("\n=== Orders by Account ===\n");

  try {
    // Calculate account order list key
    const ACCOUNT_ORDER_LIST = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(["string"], ["ACCOUNT_ORDER_LIST"])
    );

    const accountOrderListKey = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [ACCOUNT_ORDER_LIST, signer.address])
    );

    const accountOrderCount = await dataStore.getBytes32Count(accountOrderListKey);
    console.log(`Orders for ${signer.address}: ${accountOrderCount.toString()}`);

    if (accountOrderCount.gt(0)) {
      const accountOrderKeys = await dataStore.getBytes32ValuesAt(accountOrderListKey, 0, accountOrderCount);

      for (let i = 0; i < accountOrderKeys.length; i++) {
        const orderKey = accountOrderKeys[i];
        console.log(`\n  Order ${i + 1}:`);
        console.log(`    Key: ${orderKey}`);

        try {
          const orderInfo = await reader.getOrder(dataStoreDeployment.address, orderKey);
          console.log(`    Market: ${orderInfo.addresses.market}`);

          const orderType = toNumber(orderInfo.numbers.orderType);
          console.log(`    Type: ${ORDER_TYPE_NAMES[orderType] || orderType}`);
          console.log(`    Size: $${formatUnits(orderInfo.numbers.sizeDeltaUsd, 30)}`);
          console.log(`    Collateral: ${formatUnits(orderInfo.numbers.initialCollateralDeltaAmount, 6)} USDT`);
          console.log(`    Direction: ${orderInfo.flags.isLong ? "Long" : "Short"}`);
        } catch (e: any) {
          console.log(`    Error: ${e.message?.slice(0, 50)}`);
        }
      }
    }
  } catch (error: any) {
    console.log("Error fetching account orders:", error.message?.slice(0, 100));
  }

  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║              CHECK COMPLETE                                   ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
