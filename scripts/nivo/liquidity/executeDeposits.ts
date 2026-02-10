/**
 * Execute Pending Deposits
 *
 * In GMX, createDeposit() creates a pending deposit. A keeper must call
 * executeDeposit() to actually mint market tokens. This script acts as
 * a keeper for local development.
 *
 * Uses ChainlinkPriceFeedProvider to read prices from the configured
 * price feeds without requiring oracle signatures.
 *
 * Usage: npm run local:execute-deposits
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
  console.log("║              EXECUTE PENDING DEPOSITS                         ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  const [signer] = await ethers.getSigners();
  console.log("Executor (Keeper):", signer.address);

  // Get contract deployments
  const dataStoreDeployment = await deployments.get("DataStore");
  const depositHandlerDeployment = await deployments.get("DepositHandler");
  const readerDeployment = await deployments.get("Reader");
  const chainlinkPriceFeedProviderDeployment = await deployments.get("ChainlinkPriceFeedProvider");
  const roleStoreDeployment = await deployments.get("RoleStore");
  const oracleDeployment = await deployments.get("Oracle");

  const dataStore = await ethers.getContractAt("DataStore", dataStoreDeployment.address);
  const depositHandler = await ethers.getContractAt("DepositHandler", depositHandlerDeployment.address);
  const reader = await ethers.getContractAt("Reader", readerDeployment.address);
  const roleStore = await ethers.getContractAt("RoleStore", roleStoreDeployment.address);
  const oracle = await ethers.getContractAt("Oracle", oracleDeployment.address);

  console.log("DataStore:", dataStoreDeployment.address);
  console.log("DepositHandler:", depositHandlerDeployment.address);
  console.log("Reader:", readerDeployment.address);
  console.log("ChainlinkPriceFeedProvider:", chainlinkPriceFeedProviderDeployment.address);
  console.log("Oracle:", oracleDeployment.address);

  // Check/Grant ORDER_KEEPER role
  const ORDER_KEEPER = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"]));
  const hasKeeperRole = await roleStore.hasRole(signer.address, ORDER_KEEPER);
  if (!hasKeeperRole) {
    console.log("\n⚠️ Granting ORDER_KEEPER role to executor...");
    const tx = await roleStore.grantRole(signer.address, ORDER_KEEPER);
    await tx.wait();
    console.log("✅ ORDER_KEEPER role granted");
  }

  // Clear any stale prices left in the Oracle from previous failed executions
  // The Oracle requires tokensWithPrices to be empty before setPrices is called
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

  // Get deposit count
  const DEPOSIT_LIST = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"]));
  const depositCount = await dataStore.getBytes32Count(DEPOSIT_LIST);
  console.log("\nTotal deposits in system:", depositCount.toString());

  if (depositCount.eq(0)) {
    console.log("No pending deposits to execute.");
    return;
  }

  // Get all deposit keys
  const depositKeys = await dataStore.getBytes32ValuesAt(DEPOSIT_LIST, 0, depositCount);
  console.log("Deposit keys found:", depositKeys.length);

  console.log("\n=== Executing Deposits ===\n");

  let executedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < depositKeys.length; i++) {
    const depositKey = depositKeys[i];
    console.log(`\nDeposit ${i + 1}/${depositKeys.length}`);
    console.log("Key:", depositKey);

    try {
      // Get deposit info using the Reader contract
      const depositInfo = await reader.getDeposit(dataStoreDeployment.address, depositKey);

      const marketAddress = depositInfo.addresses.market;
      const account = depositInfo.addresses.account;
      const longToken = depositInfo.addresses.initialLongToken;
      const shortToken = depositInfo.addresses.initialShortToken;

      console.log("  Market:", marketAddress);
      console.log("  Account:", account);
      console.log("  Long Token:", longToken);
      console.log("  Short Token:", shortToken);

      const longTokenAmount = depositInfo.numbers.initialLongTokenAmount;
      const shortTokenAmount = depositInfo.numbers.initialShortTokenAmount;
      const updatedAtTime = toNumber(depositInfo.numbers.updatedAtTime);

      console.log("  Long Token Amount:", formatUnits(longTokenAmount, 6), "USDT");
      console.log("  Short Token Amount:", formatUnits(shortTokenAmount, 6), "USDT");
      console.log("  Created At:", new Date(updatedAtTime * 1000).toISOString());

      // Get market info
      const marketInfo = await reader.getMarket(dataStoreDeployment.address, marketAddress);
      const indexToken = marketInfo.indexToken;
      console.log("  Index Token:", indexToken);

      console.log("  Attempting real execution with ChainlinkPriceFeedProvider...");

      try {
        // Build SetPricesParams for executeDeposit
        // The ChainlinkPriceFeedProvider reads prices from the DataStore's configured price feeds
        // We need to provide the token addresses and the provider address
        // The data can be empty as the provider reads from the DataStore
        const tokens = [indexToken, longToken];

        // If longToken == shortToken, don't duplicate
        const uniqueTokens = longToken.toLowerCase() === shortToken.toLowerCase() ? tokens : [...tokens, shortToken];

        // ChainlinkPriceFeedProvider for all tokens
        const providers = uniqueTokens.map(() => chainlinkPriceFeedProviderDeployment.address);

        // Empty data - ChainlinkPriceFeedProvider reads from DataStore
        const data = uniqueTokens.map(() => "0x");

        const oracleParams = {
          tokens: uniqueTokens,
          providers: providers,
          data: data,
        };

        console.log("  Tokens:", uniqueTokens);
        console.log("  Provider:", chainlinkPriceFeedProviderDeployment.address);

        const tx = await depositHandler.executeDeposit(depositKey, oracleParams, { gasLimit: 10000000 });

        const receipt = await tx.wait();
        console.log("  Gas used:", receipt.gasUsed.toString());

        // Parse EventEmitter logs to check for success/cancellation
        const eventEmitter = await ethers.getContractAt(
          "EventEmitter",
          (
            await deployments.get("EventEmitter")
          ).address
        );

        let depositCancelled = false;
        let depositExecuted = false;
        let cancellationReasonBytes = "";

        for (const log of receipt.logs) {
          if (log.address.toLowerCase() !== eventEmitter.address.toLowerCase()) continue;

          try {
            const parsed = eventEmitter.interface.parseLog(log);
            const eventName = parsed.args[1];

            if (eventName === "DepositCancelled") {
              depositCancelled = true;
              // Extract reasonBytes from event data
              const eventData = parsed.args[parsed.args.length - 1];
              if (eventData.bytesItems?.items) {
                for (const item of eventData.bytesItems.items) {
                  if (item.key === "reasonBytes") {
                    cancellationReasonBytes = item.value;
                  }
                }
              }
            }

            if (eventName === "DepositExecuted") {
              depositExecuted = true;
            }
          } catch {
            // Not parseable, skip
          }
        }

        if (depositExecuted) {
          console.log("  ✅ Deposit executed successfully!");
          executedCount++;
        } else if (depositCancelled) {
          console.log("  ⚠️ Deposit was CANCELLED during execution!");

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

          console.log("  Run 'npm run local:debug-deposit' for detailed debugging");
          failedCount++;
        } else {
          console.log("  ⚠️ Unknown outcome - check logs manually");
          failedCount++;
        }
      } catch (execError: any) {
        const errorMsg = execError.reason || execError.message || "";
        console.log("  ❌ Execution failed:", errorMsg.slice(0, 300));

        // Try simulation fallback for debugging
        if (!errorMsg.includes("EndOfOracleSimulation")) {
          console.log("  Trying simulation for debugging...");
          try {
            // Use corrected prices for simulation
            const usdtPrice = ethers.utils.parseUnits("1", 24); // $1.00 for 6-decimal token
            const indexTokenPrice = ethers.utils.parseUnits("0.18", 12); // ~$0.18 for 18-decimal token

            const simulatePricesParams = {
              primaryTokens: [indexToken, longToken],
              primaryPrices: [
                { min: indexTokenPrice, max: indexTokenPrice },
                { min: usdtPrice, max: usdtPrice },
              ],
              minTimestamp: updatedAtTime,
              maxTimestamp: updatedAtTime + 300,
            };

            await depositHandler.simulateExecuteDeposit(depositKey, simulatePricesParams, { gasLimit: 10000000 });
          } catch (simError: any) {
            const simMsg = simError.reason || simError.message || "";
            if (simMsg.includes("EndOfOracleSimulation")) {
              console.log("  Simulation passed (EndOfOracleSimulation is expected)");
            } else {
              console.log("  Simulation error:", simMsg.slice(0, 200));
            }
          }
        }
        failedCount++;
      }
    } catch (error: any) {
      console.log("  ❌ Error reading deposit:", error.message?.slice(0, 100));
      failedCount++;
    }
  }

  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log(
    `${`║  Executed: ${executedCount}  |  Failed: ${failedCount}  |  Total: ${depositKeys.length}`.padEnd(63)}║`
  );
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  if (executedCount > 0) {
    console.log("✅ Deposits executed successfully!");
    console.log("Market tokens have been minted to the depositor's wallet.");
    console.log("\nYou can now:");
    console.log("1. Run: npm run local:execute-orders - to execute pending orders");
    console.log("2. Open positions via the frontend");
  }

  if (failedCount > 0) {
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("NOTE: Some deposits failed to execute.");
    console.log("Common reasons:");
    console.log("  - Price feed not configured for tokens");
    console.log("  - Market not properly configured");
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
