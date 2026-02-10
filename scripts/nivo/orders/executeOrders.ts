/**
 * Execute Pending Orders
 *
 * In GMX, createOrder() creates a pending order. A keeper must call
 * executeOrder() to actually open/close positions. This script acts as
 * a keeper for local development.
 *
 * Uses ChainlinkPriceFeedProvider to read prices from the configured
 * price feeds without requiring oracle signatures.
 *
 * Usage: npm run local:execute-orders
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
  console.log("║              EXECUTE PENDING ORDERS                           ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  const [signer] = await ethers.getSigners();
  console.log("Executor (Keeper):", signer.address);

  // Get contract deployments
  const dataStoreDeployment = await deployments.get("DataStore");
  const orderHandlerDeployment = await deployments.get("OrderHandler");
  const readerDeployment = await deployments.get("Reader");
  const chainlinkPriceFeedProviderDeployment = await deployments.get("ChainlinkPriceFeedProvider");
  const roleStoreDeployment = await deployments.get("RoleStore");

  const dataStore = await ethers.getContractAt("DataStore", dataStoreDeployment.address);
  const orderHandler = await ethers.getContractAt("OrderHandler", orderHandlerDeployment.address);
  const reader = await ethers.getContractAt("Reader", readerDeployment.address);
  const roleStore = await ethers.getContractAt("RoleStore", roleStoreDeployment.address);

  console.log("DataStore:", dataStoreDeployment.address);
  console.log("OrderHandler:", orderHandlerDeployment.address);
  console.log("Reader:", readerDeployment.address);

  // Check/Grant ORDER_KEEPER role
  const ORDER_KEEPER = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"]));
  const hasKeeperRole = await roleStore.hasRole(signer.address, ORDER_KEEPER);
  if (!hasKeeperRole) {
    console.log("\n⚠️ Granting ORDER_KEEPER role to executor...");
    const tx = await roleStore.grantRole(signer.address, ORDER_KEEPER);
    await tx.wait();
    console.log("✅ ORDER_KEEPER role granted");
  }

  // Get order count
  const ORDER_LIST = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_LIST"]));
  const orderCount = await dataStore.getBytes32Count(ORDER_LIST);
  console.log("\nTotal orders in system:", orderCount.toString());

  if (orderCount.eq(0)) {
    console.log("No pending orders to execute.");
    return;
  }

  // Get all order keys
  const orderKeys = await dataStore.getBytes32ValuesAt(ORDER_LIST, 0, orderCount);
  console.log("Order keys found:", orderKeys.length);

  console.log("\n=== Executing Orders ===\n");

  let executedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < orderKeys.length; i++) {
    const orderKey = orderKeys[i];
    console.log(`\nOrder ${i + 1}/${orderKeys.length}`);
    console.log("Key:", orderKey);

    try {
      // Get order info using the Reader contract
      const orderInfo = await reader.getOrder(dataStoreDeployment.address, orderKey);

      const marketAddress = orderInfo.addresses.market;
      const account = orderInfo.addresses.account;
      const collateralToken = orderInfo.addresses.initialCollateralToken;
      const orderType = toNumber(orderInfo.numbers.orderType);
      const isLong = orderInfo.flags.isLong;

      console.log("  Market:", marketAddress);
      console.log("  Account:", account);
      console.log("  Collateral Token:", collateralToken);
      console.log("  Order Type:", ORDER_TYPE_NAMES[orderType] || `Unknown (${orderType})`);
      console.log("  Size:", formatUnits(orderInfo.numbers.sizeDeltaUsd, 30), "USD");
      console.log("  Collateral:", formatUnits(orderInfo.numbers.initialCollateralDeltaAmount, 6), "USDT");
      console.log("  Direction:", isLong ? "Long" : "Short");

      // Get market info
      const marketInfo = await reader.getMarket(dataStoreDeployment.address, marketAddress);
      const indexToken = marketInfo.indexToken;
      console.log("  Index Token:", indexToken);

      console.log("  Attempting execution with ChainlinkPriceFeedProvider...");

      try {
        // Build oracle params
        const tokens = [indexToken, collateralToken];
        const uniqueTokens = indexToken.toLowerCase() === collateralToken.toLowerCase() ? [indexToken] : tokens;

        const oracleParams = {
          tokens: uniqueTokens,
          providers: uniqueTokens.map(() => chainlinkPriceFeedProviderDeployment.address),
          data: uniqueTokens.map(() => "0x"),
        };

        console.log("  Tokens:", uniqueTokens);
        console.log("  Provider:", chainlinkPriceFeedProviderDeployment.address);

        const tx = await orderHandler.executeOrder(orderKey, oracleParams, {
          gasLimit: 15000000,
        });

        const receipt = await tx.wait();
        console.log("  Gas used:", receipt.gasUsed.toString());

        // Parse EventEmitter logs to check for success/cancellation
        const eventEmitter = await ethers.getContractAt(
          "EventEmitter",
          (
            await deployments.get("EventEmitter")
          ).address
        );

        let orderCancelled = false;
        let orderExecuted = false;
        let cancellationReasonBytes = "";

        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== eventEmitter.address.toLowerCase()) continue;

          try {
            const parsed = eventEmitter.interface.parseLog(log);
            const eventName = parsed.args[1];

            if (eventName === "OrderCancelled") {
              orderCancelled = true;
              const eventData = parsed.args[parsed.args.length - 1];
              if (eventData.bytesItems?.items) {
                for (const item of eventData.bytesItems.items) {
                  if (item.key === "reasonBytes") {
                    cancellationReasonBytes = item.value;
                  }
                }
              }
            }

            if (eventName === "OrderExecuted") {
              orderExecuted = true;
            }
          } catch {
            // Not parseable, skip
          }
        }

        if (orderExecuted) {
          console.log("  ✅ Order executed successfully!");
          executedCount++;
        } else if (orderCancelled) {
          console.log("  ⚠️ Order was CANCELLED during execution!");

          if (cancellationReasonBytes && cancellationReasonBytes !== "0x") {
            try {
              const { parseError, formatParsedError } = await import("../../../utils/error");
              const decodedError = parseError(cancellationReasonBytes, false);
              if (decodedError) {
                console.log("  Error:", formatParsedError(decodedError));
              }
            } catch {
              console.log("  Reason bytes:", `${cancellationReasonBytes.slice(0, 66)}...`);
            }
          }
          failedCount++;
        } else {
          console.log("  ⚠️ Unknown outcome - check logs manually");
          failedCount++;
        }
      } catch (execError: any) {
        const errorMsg = execError.reason || execError.message || "";
        console.log("  ❌ Execution failed:", errorMsg.slice(0, 300));

        // Provide helpful hints based on error
        if (errorMsg.includes("EmptyPrimaryPrice")) {
          console.log("  Hint: Price feed not configured for one of the tokens");
          console.log("  Fix: Run npm run local:configure-markets");
        } else if (errorMsg.includes("MaxCollateralSumExceeded")) {
          console.log("  Hint: MAX_COLLATERAL_SUM not set for this market");
          console.log("  Fix: Run npm run local:configure-markets");
        } else if (errorMsg.includes("OracleTimestamps")) {
          console.log("  Hint: Order is too old - cancel and create a new one");
          console.log("  Fix: Run npm run local:cancel-all-orders");
        } else if (errorMsg.includes("InsufficientPoolAmount") || errorMsg.includes("InsufficientReserve")) {
          console.log("  Hint: Not enough liquidity in the pool");
          console.log("  Fix: Run npm run local:add-liquidity && npm run local:execute-deposits");
        }
        failedCount++;
      }
    } catch (error: any) {
      console.log("  ❌ Error reading order:", error.message?.slice(0, 100));
      failedCount++;
    }
  }

  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log(
    `${`║  Executed: ${executedCount}  |  Failed: ${failedCount}  |  Total: ${orderKeys.length}`.padEnd(63)}║`
  );
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  if (executedCount > 0) {
    console.log("✅ Orders executed successfully!");
    console.log("Positions have been opened/modified on-chain.");
  }

  if (failedCount > 0) {
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("NOTE: Some orders failed to execute.");
    console.log("Common reasons:");
    console.log("  - Price feed not configured: npm run local:configure-markets");
    console.log("  - Order too old: npm run local:cancel-all-orders");
    console.log("  - Insufficient liquidity: npm run local:add-liquidity");
    console.log("═══════════════════════════════════════════════════════════════");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
