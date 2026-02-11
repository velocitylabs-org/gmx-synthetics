/**
 * Execute Pending Withdrawals
 *
 * In GMX, createWithdrawal() creates a pending withdrawal. A keeper must call
 * executeWithdrawal() to actually burn market tokens and return the underlying
 * tokens. This script acts as a keeper for local development.
 *
 * Uses ChainlinkPriceFeedProvider to read prices from the configured
 * price feeds without requiring oracle signatures.
 *
 * Usage: npm run local:execute-withdrawals
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

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║             EXECUTE PENDING WITHDRAWALS                       ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  const [signer] = await ethers.getSigners();
  console.log("Executor (Keeper):", signer.address);

  // Get contract deployments
  const dataStoreDeployment = await deployments.get("DataStore");
  const withdrawalHandlerDeployment = await deployments.get("WithdrawalHandler");
  const readerDeployment = await deployments.get("Reader");
  const chainlinkPriceFeedProviderDeployment = await deployments.get("ChainlinkPriceFeedProvider");
  const roleStoreDeployment = await deployments.get("RoleStore");
  const oracleDeployment = await deployments.get("Oracle");

  const dataStore = await ethers.getContractAt("DataStore", dataStoreDeployment.address);
  const withdrawalHandler = await ethers.getContractAt("WithdrawalHandler", withdrawalHandlerDeployment.address);
  const reader = await ethers.getContractAt("Reader", readerDeployment.address);
  const roleStore = await ethers.getContractAt("RoleStore", roleStoreDeployment.address);
  const oracle = await ethers.getContractAt("Oracle", oracleDeployment.address);

  console.log("DataStore:", dataStoreDeployment.address);
  console.log("WithdrawalHandler:", withdrawalHandlerDeployment.address);
  console.log("Reader:", readerDeployment.address);
  console.log("ChainlinkPriceFeedProvider:", chainlinkPriceFeedProviderDeployment.address);

  // Check/Grant ORDER_KEEPER role (needed for execution)
  const ORDER_KEEPER = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"]));
  const hasKeeperRole = await roleStore.hasRole(signer.address, ORDER_KEEPER);
  if (!hasKeeperRole) {
    console.log("\n⚠️ Granting ORDER_KEEPER role to executor...");
    const tx = await roleStore.grantRole(signer.address, ORDER_KEEPER);
    await tx.wait();
    console.log("✅ ORDER_KEEPER role granted");
  }

  // Clear any stale prices left in the Oracle from previous failed executions
  try {
    const tokensWithPricesCount = await oracle.getTokensWithPricesCount();
    if (tokensWithPricesCount.gt(0)) {
      console.log(`\n⚠️ Oracle has ${tokensWithPricesCount} stale token prices. Clearing...`);
      const clearTx = await oracle.clearAllPrices();
      await clearTx.wait();
      console.log("✅ Stale oracle prices cleared");
    }
  } catch (clearError: any) {
    console.log("⚠️ Could not check/clear oracle prices:", clearError.message?.slice(0, 100));
  }

  // Get withdrawal count
  const WITHDRAWAL_LIST = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["WITHDRAWAL_LIST"]));
  const withdrawalCount = await dataStore.getBytes32Count(WITHDRAWAL_LIST);
  console.log("\nTotal withdrawals in system:", withdrawalCount.toString());

  if (withdrawalCount.eq(0)) {
    console.log("No pending withdrawals to execute.");
    return;
  }

  // Get all withdrawal keys
  const withdrawalKeys = await dataStore.getBytes32ValuesAt(WITHDRAWAL_LIST, 0, withdrawalCount);
  console.log("Withdrawal keys found:", withdrawalKeys.length);

  console.log("\n=== Executing Withdrawals ===\n");

  let executedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < withdrawalKeys.length; i++) {
    const withdrawalKey = withdrawalKeys[i];
    console.log(`\nWithdrawal ${i + 1}/${withdrawalKeys.length}`);
    console.log("Key:", withdrawalKey);

    try {
      // Get withdrawal info using the Reader contract
      const withdrawalInfo = await reader.getWithdrawal(dataStoreDeployment.address, withdrawalKey);

      const marketAddress = withdrawalInfo.addresses.market;
      const account = withdrawalInfo.addresses.account;
      const receiver = withdrawalInfo.addresses.receiver;

      console.log("  Market:", marketAddress);
      console.log("  Account:", account);
      console.log("  Receiver:", receiver);

      const marketTokenAmount = withdrawalInfo.numbers.marketTokenAmount;
      const updatedAtTime = toNumber(withdrawalInfo.numbers.updatedAtTime);

      console.log("  Market Token Amount:", formatUnits(marketTokenAmount, 18), "LP tokens");
      console.log("  Created At:", new Date(updatedAtTime * 1000).toISOString());

      // Get market info
      const marketInfo = await reader.getMarket(dataStoreDeployment.address, marketAddress);
      const indexToken = marketInfo.indexToken;
      const longToken = marketInfo.longToken;
      const shortToken = marketInfo.shortToken;

      console.log("  Index Token:", indexToken);
      console.log("  Long Token:", longToken);

      console.log("  Attempting execution with ChainlinkPriceFeedProvider...");

      try {
        // Build SetPricesParams for executeWithdrawal
        // Same pattern as executeDeposits.ts -- the ChainlinkPriceFeedProvider
        // reads prices from the DataStore's configured price feeds
        const tokens = [indexToken, longToken];

        // If longToken == shortToken (forex markets), don't duplicate
        const uniqueTokens = longToken.toLowerCase() === shortToken.toLowerCase() ? tokens : [...tokens, shortToken];

        // ChainlinkPriceFeedProvider for all tokens
        const providers = uniqueTokens.map(() => chainlinkPriceFeedProviderDeployment.address);

        // Empty data -- ChainlinkPriceFeedProvider reads from DataStore
        const data = uniqueTokens.map(() => "0x");

        const oracleParams = {
          tokens: uniqueTokens,
          providers: providers,
          data: data,
        };

        console.log("  Tokens:", uniqueTokens);
        console.log("  Provider:", chainlinkPriceFeedProviderDeployment.address);

        const tx = await withdrawalHandler.executeWithdrawal(withdrawalKey, oracleParams, {
          gasLimit: 10000000,
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

        let withdrawalCancelled = false;
        let withdrawalExecuted = false;
        let cancellationReasonBytes = "";

        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== eventEmitter.address.toLowerCase()) continue;

          try {
            const parsed = eventEmitter.interface.parseLog(log);
            const eventName = parsed.args[1];

            if (eventName === "WithdrawalCancelled") {
              withdrawalCancelled = true;
              const eventData = parsed.args[parsed.args.length - 1];
              if (eventData.bytesItems?.items) {
                for (const item of eventData.bytesItems.items) {
                  if (item.key === "reasonBytes") {
                    cancellationReasonBytes = item.value;
                  }
                }
              }
            }

            if (eventName === "WithdrawalExecuted") {
              withdrawalExecuted = true;
            }
          } catch {
            // Not parseable, skip
          }
        }

        if (withdrawalExecuted) {
          console.log("  ✅ Withdrawal executed successfully! USDT returned to receiver.");
          executedCount++;
        } else if (withdrawalCancelled) {
          console.log("  ⚠️ Withdrawal was CANCELLED during execution!");

          // Decode the cancellation reason
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
          console.log("  ⚠️ Transaction succeeded but could not determine result from events");
          console.log("  Check market token balance to verify");
          executedCount++;
        }
      } catch (execError: any) {
        console.log("  ❌ Execution failed:", execError.reason || execError.message?.slice(0, 150));
        failedCount++;
      }
    } catch (error: any) {
      console.log("  ❌ Error reading withdrawal:", error.message?.slice(0, 100));
      failedCount++;
    }
  }

  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log(
    `${`║  Executed: ${executedCount}  |  Failed: ${failedCount}  |  Total: ${withdrawalKeys.length}`.padEnd(63)}║`
  );
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  if (executedCount > 0) {
    console.log("✅ Withdrawals executed successfully!");
    console.log("USDT has been returned to the receiver's wallet.");
  }

  if (failedCount > 0) {
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("NOTE: Some withdrawals failed or were cancelled.");
    console.log("Common reasons:");
    console.log("  - Price feed not configured: npm run local:configure-markets");
    console.log("  - Stale oracle prices: try running again");
    console.log("  - Missing roles");
    console.log("  - TOKEN_TRANSFER_GAS_LIMIT not set: npm run local:configure-markets");
    console.log("═══════════════════════════════════════════════════════════════");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
