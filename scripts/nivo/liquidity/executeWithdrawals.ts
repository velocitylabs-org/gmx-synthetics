/**
 * Execute Pending Withdrawals
 *
 * In GMX, createWithdrawal() creates a pending withdrawal. A keeper must call
 * executeWithdrawal() to actually burn market tokens and return the underlying
 * tokens. This script acts as a keeper for local development.
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

  const dataStore = await ethers.getContractAt("DataStore", dataStoreDeployment.address);
  const withdrawalHandler = await ethers.getContractAt("WithdrawalHandler", withdrawalHandlerDeployment.address);
  const reader = await ethers.getContractAt("Reader", readerDeployment.address);

  console.log("DataStore:", dataStoreDeployment.address);
  console.log("WithdrawalHandler:", withdrawalHandlerDeployment.address);
  console.log("Reader:", readerDeployment.address);

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
      console.log("  Index Token:", indexToken);
      console.log("  Long Token:", longToken);

      // Try to execute the withdrawal using simulateExecuteWithdrawal
      console.log("  Attempting execution with simulated prices...");

      try {
        // Define prices - GMX uses 30 decimals for USD prices internally
        const usdtPrice = ethers.utils.parseUnits("1", 30); // $1.00
        const indexTokenPrice = ethers.utils.parseUnits("0.18", 30); // ~$0.18 for BRL

        // Build the price params - use withdrawal creation time for timestamps
        const primaryTokens = [indexToken, longToken];
        const primaryPrices = [
          { min: indexTokenPrice, max: indexTokenPrice },
          { min: usdtPrice, max: usdtPrice },
        ];

        // SimulatePricesParams structure
        const simulatePricesParams = {
          primaryTokens: primaryTokens,
          primaryPrices: primaryPrices,
          minTimestamp: updatedAtTime,
          maxTimestamp: updatedAtTime + 300, // 5 minute window
        };

        console.log("  Primary tokens:", primaryTokens);
        console.log("  Prices: Index=$0.18, USDT=$1.00");

        const simTx = await withdrawalHandler.simulateExecuteWithdrawal(withdrawalKey, simulatePricesParams, {
          gasLimit: 10000000,
        });

        const simReceipt = await simTx.wait();
        console.log("  ✅ Withdrawal executed! Gas used:", simReceipt.gasUsed.toString());
        executedCount++;
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
    console.log("NOTE: Some withdrawals failed to execute.");
    console.log("Common reasons:");
    console.log("  - Invalid price configuration");
    console.log("  - Insufficient pool balance");
    console.log("  - Missing roles");
    console.log("═══════════════════════════════════════════════════════════════");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
