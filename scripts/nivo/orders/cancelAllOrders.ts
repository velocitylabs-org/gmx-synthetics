/**
 * Cancel All Pending Orders
 *
 * This script cancels all pending orders in the system. Useful for
 * cleaning up the local development environment.
 *
 * Usage: npm run local:cancel-all-orders
 */
import { deployments, ethers } from "hardhat";

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

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║              CANCEL ALL PENDING ORDERS                        ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  const [signer] = await ethers.getSigners();
  console.log("Cancellation Account:", signer.address);

  // Get contract deployments
  const dataStoreDeployment = await deployments.get("DataStore");
  const exchangeRouterDeployment = await deployments.get("ExchangeRouter");
  const readerDeployment = await deployments.get("Reader");

  const dataStore = await ethers.getContractAt("DataStore", dataStoreDeployment.address);
  const exchangeRouter = await ethers.getContractAt("ExchangeRouter", exchangeRouterDeployment.address);
  const reader = await ethers.getContractAt("Reader", readerDeployment.address);

  console.log("DataStore:", dataStoreDeployment.address);
  console.log("ExchangeRouter:", exchangeRouterDeployment.address);
  console.log("Reader:", readerDeployment.address);

  // Get order count
  const ORDER_LIST = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_LIST"]));
  const orderCount = await dataStore.getBytes32Count(ORDER_LIST);
  console.log("\nTotal orders in system:", orderCount.toString());

  if (orderCount.eq(0)) {
    console.log("No pending orders to cancel.");
    return;
  }

  // Get all order keys
  const orderKeys = await dataStore.getBytes32ValuesAt(ORDER_LIST, 0, orderCount);
  console.log("Order keys found:", orderKeys.length);

  console.log("\n=== Cancelling Orders ===\n");

  let cancelledCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < orderKeys.length; i++) {
    const orderKey = orderKeys[i];
    console.log(`\nOrder ${i + 1}/${orderKeys.length}`);
    console.log("Key:", orderKey);

    try {
      // Get order info using the Reader contract
      const orderInfo = await reader.getOrder(dataStoreDeployment.address, orderKey);

      const orderAccount = orderInfo.addresses.account;
      const orderType = toNumber(orderInfo.numbers.orderType);

      console.log("  Account:", orderAccount);
      console.log("  Order Type:", ORDER_TYPE_NAMES[orderType] || `Unknown (${orderType})`);
      console.log("  Size:", formatUnits(orderInfo.numbers.sizeDeltaUsd, 30), "USD");
      console.log("  Collateral:", formatUnits(orderInfo.numbers.initialCollateralDeltaAmount, 6), "USDT");

      // Check if we own this order
      if (orderAccount.toLowerCase() !== signer.address.toLowerCase()) {
        console.log("  ⏭️ Skipping - not owned by current account");
        skippedCount++;
        continue;
      }

      // Cancel the order
      console.log("  Cancelling order...");

      try {
        const tx = await exchangeRouter.cancelOrder(orderKey, {
          gasLimit: 15000000,
        });

        const receipt = await tx.wait();
        console.log("  ✅ Order cancelled! Gas used:", receipt.gasUsed.toString());
        cancelledCount++;
      } catch (cancelError: any) {
        console.log("  ❌ Cancellation failed:", cancelError.reason || cancelError.message?.slice(0, 100));
        failedCount++;
      }
    } catch (error: any) {
      console.log("  ❌ Error reading order:", error.message?.slice(0, 100));
      failedCount++;
    }
  }

  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log(
    `${`║  Cancelled: ${cancelledCount}  |  Skipped: ${skippedCount}  |  Failed: ${failedCount}  |  Total: ${orderKeys.length}`.padEnd(
      63
    )}║`
  );
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  if (skippedCount > 0) {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`Skipped ${skippedCount} orders not owned by current account.`);
    console.log("To cancel those, switch to the account that created them.");
    console.log("═══════════════════════════════════════════════════════════════");
  }

  // Verify remaining orders
  const remainingCount = await dataStore.getBytes32Count(ORDER_LIST);
  console.log("\nRemaining orders in system:", remainingCount.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
