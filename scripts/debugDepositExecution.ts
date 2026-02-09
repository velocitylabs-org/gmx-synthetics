/**
 * Debug Deposit Execution
 *
 * This script creates and executes a deposit, then parses EventEmitter logs
 * to decode the exact cancellation reason if the deposit fails.
 */
import { deployments, ethers } from "hardhat";
import { formatParsedError, parseError } from "../utils/error";

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║           DEBUG DEPOSIT EXECUTION                             ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  const [signer] = await ethers.getSigners();

  // Get contract deployments
  const dataStoreDeployment = await deployments.get("DataStore");
  const depositHandlerDeployment = await deployments.get("DepositHandler");
  const readerDeployment = await deployments.get("Reader");
  const eventEmitterDeployment = await deployments.get("EventEmitter");
  const chainlinkPriceFeedProviderDeployment = await deployments.get("ChainlinkPriceFeedProvider");
  const roleStoreDeployment = await deployments.get("RoleStore");

  const dataStore = await ethers.getContractAt("DataStore", dataStoreDeployment.address);
  const depositHandler = await ethers.getContractAt("DepositHandler", depositHandlerDeployment.address);
  const reader = await ethers.getContractAt("Reader", readerDeployment.address);
  const eventEmitter = await ethers.getContractAt("EventEmitter", eventEmitterDeployment.address);
  const roleStore = await ethers.getContractAt("RoleStore", roleStoreDeployment.address);

  console.log("Contracts:");
  console.log("  DataStore:", dataStoreDeployment.address);
  console.log("  DepositHandler:", depositHandlerDeployment.address);
  console.log("  EventEmitter:", eventEmitterDeployment.address);
  console.log("  ChainlinkPriceFeedProvider:", chainlinkPriceFeedProviderDeployment.address);
  console.log("  Executor:", signer.address);

  // Grant ORDER_KEEPER role if needed
  const ORDER_KEEPER = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["ORDER_KEEPER"]));
  const hasKeeperRole = await roleStore.hasRole(signer.address, ORDER_KEEPER);
  if (!hasKeeperRole) {
    console.log("\n⚠️ Granting ORDER_KEEPER role...");
    const tx = await roleStore.grantRole(signer.address, ORDER_KEEPER);
    await tx.wait();
    console.log("✅ ORDER_KEEPER role granted");
  }

  // Get deposit keys
  const { hashString } = await import("../utils/hash");
  const DEPOSIT_LIST = hashString("DEPOSIT_LIST");
  const depositCount = await dataStore.getBytes32Count(DEPOSIT_LIST);
  console.log("\nPending deposits:", depositCount.toString());

  if (depositCount.eq(0)) {
    console.log("\n⚠️ No pending deposits. Creating one first...");
    console.log("Run: npm run local:add-liquidity");
    return;
  }

  const depositKeys = await dataStore.getBytes32ValuesAt(DEPOSIT_LIST, 0, depositCount);
  const depositKey = depositKeys[0];
  console.log("Deposit key:", depositKey);

  // Get deposit info
  const deposit = await reader.getDeposit(dataStoreDeployment.address, depositKey);
  const market = deposit.addresses.market;
  const indexToken = (await reader.getMarket(dataStoreDeployment.address, market)).indexToken;
  const longToken = deposit.addresses.initialLongToken;
  const shortToken = deposit.addresses.initialShortToken;

  console.log("\n=== Deposit Info ===");
  console.log("  Market:", market);
  console.log("  Account:", deposit.addresses.account);
  console.log("  Index Token:", indexToken);
  console.log("  Long Token:", longToken);
  console.log("  Short Token:", shortToken);
  console.log("  Long Amount:", ethers.utils.formatUnits(deposit.numbers.initialLongTokenAmount, 6), "USDT");
  console.log("  Short Amount:", ethers.utils.formatUnits(deposit.numbers.initialShortTokenAmount, 6), "USDT");

  // Build oracle params using ChainlinkPriceFeedProvider
  const tokens = [indexToken, longToken];
  const uniqueTokens = longToken.toLowerCase() === shortToken.toLowerCase() ? tokens : [...tokens, shortToken];

  const oracleParams = {
    tokens: uniqueTokens,
    providers: uniqueTokens.map(() => chainlinkPriceFeedProviderDeployment.address),
    data: uniqueTokens.map(() => "0x"),
  };

  console.log("\n=== Oracle Params ===");
  console.log("  Tokens:", uniqueTokens);
  console.log("  Provider:", chainlinkPriceFeedProviderDeployment.address);

  // Execute deposit
  console.log("\n=== Executing Deposit ===");

  try {
    const tx = await depositHandler.executeDeposit(depositKey, oracleParams, {
      gasLimit: 15000000,
    });

    console.log("Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("Transaction confirmed!");
    console.log("Gas used:", receipt.gasUsed.toString());
    console.log("Logs count:", receipt.logs.length);

    // Parse logs to find events
    console.log("\n=== Parsing EventEmitter Logs ===");

    let depositCancelledFound = false;
    let depositExecutedFound = false;
    let cancellationReason = null;
    let cancellationReasonBytes = null;

    for (const log of receipt.logs) {
      // Check if this is an EventEmitter log
      if (log.address.toLowerCase() !== eventEmitterDeployment.address.toLowerCase()) {
        continue;
      }

      try {
        // Try to parse the log
        const parsed = eventEmitter.interface.parseLog(log);
        const eventName = parsed.args[1]; // eventName is the second argument

        console.log("  Event:", eventName);

        if (eventName === "DepositCancelled") {
          depositCancelledFound = true;

          // Extract event data - the last argument contains the structured data
          const eventData = parsed.args[parsed.args.length - 1];

          // Find reason and reasonBytes in the event data
          if (eventData.stringItems?.items) {
            for (const item of eventData.stringItems.items) {
              if (item.key === "reason") {
                cancellationReason = item.value;
              }
            }
          }

          if (eventData.bytesItems?.items) {
            for (const item of eventData.bytesItems.items) {
              if (item.key === "reasonBytes") {
                cancellationReasonBytes = item.value;
              }
            }
          }
        }

        if (eventName === "DepositExecuted") {
          depositExecutedFound = true;
        }
      } catch {
        // Not an EventEmitter log we can parse
      }
    }

    // Report findings
    console.log("\n=== Results ===");

    if (depositExecutedFound) {
      console.log("✅ DEPOSIT EXECUTED SUCCESSFULLY!");
      console.log("Market tokens should have been minted.");
    } else if (depositCancelledFound) {
      console.log("❌ DEPOSIT WAS CANCELLED!");
      console.log("\nCancellation Details:");
      console.log("  Reason:", cancellationReason || "(not found)");

      if (cancellationReasonBytes && cancellationReasonBytes !== "0x") {
        console.log("  Reason Bytes:", `${cancellationReasonBytes.slice(0, 66)}...`);

        // Decode the error
        try {
          const decodedError = parseError(cancellationReasonBytes, false);
          if (decodedError) {
            console.log("\n  ╔═══════════════════════════════════════════════════════════╗");
            console.log("  ║ DECODED ERROR:                                            ║");
            console.log("  ╚═══════════════════════════════════════════════════════════╝");
            console.log("  Error Name:", decodedError.name);
            console.log("  Error Args:", decodedError.args?.map((a: any) => a.toString()).join(", "));
            console.log("\n  Formatted:", formatParsedError(decodedError));
          } else {
            console.log("  Could not decode error bytes");
          }
        } catch (decodeErr: any) {
          console.log("  Error decoding:", decodeErr.message);

          // Try manual decoding for common errors
          const selector = cancellationReasonBytes.slice(0, 10);
          console.log("  Error selector:", selector);

          // Check common error selectors
          const knownErrors: Record<string, string> = {
            "0xcd64a025": "EmptyPrimaryPrice(address)",
            "0x8d892e73": "InvalidOracleProviderForToken(address,address)",
            "0x7f3e65c4": "MaxPoolUsdForDepositExceeded(uint256,uint256)",
            "0x5e7b5556": "ChainlinkPriceFeedNotUpdated(address,uint256,uint256)",
          };

          if (knownErrors[selector]) {
            console.log("  Known error:", knownErrors[selector]);

            // Try to decode arguments
            try {
              const dataWithoutSelector = `0x${cancellationReasonBytes.slice(10)}`;
              if (selector === "0xcd64a025") {
                const [token] = ethers.utils.defaultAbiCoder.decode(["address"], dataWithoutSelector);
                console.log("  Token with empty price:", token);
              } else if (selector === "0x8d892e73") {
                const [token, provider] = ethers.utils.defaultAbiCoder.decode(
                  ["address", "address"],
                  dataWithoutSelector
                );
                console.log("  Token:", token);
                console.log("  Invalid Provider:", provider);
              } else if (selector === "0x7f3e65c4") {
                const [poolUsd, maxPoolUsd] = ethers.utils.defaultAbiCoder.decode(
                  ["uint256", "uint256"],
                  dataWithoutSelector
                );
                console.log("  Pool USD:", ethers.utils.formatUnits(poolUsd, 30));
                console.log("  Max Pool USD:", ethers.utils.formatUnits(maxPoolUsd, 30));
              }
            } catch {
              console.log("  Could not decode arguments");
            }
          }
        }
      }

      console.log("\n=== Suggested Fixes ===");
      if (cancellationReason?.includes("EmptyPrimaryPrice") || cancellationReasonBytes?.startsWith("0xcd64a025")) {
        console.log("- Check PRICE_FEED configuration for the token");
        console.log("- Verify PRICE_FEED_MULTIPLIER is set correctly");
        console.log("- Ensure MockPriceFeed has valid price data");
      } else if (cancellationReason?.includes("MaxPoolUsd") || cancellationReasonBytes?.startsWith("0x7f3e65c4")) {
        console.log("- Reduce deposit amount");
        console.log("- Increase MAX_POOL_USD_FOR_DEPOSIT in configureForexMarkets.ts");
      } else if (
        cancellationReason?.includes("ChainlinkPriceFeedNotUpdated") ||
        cancellationReasonBytes?.startsWith("0x5e7b5556")
      ) {
        console.log("- Increase PRICE_FEED_HEARTBEAT_DURATION");
        console.log("- Update MockPriceFeed timestamp");
      } else {
        console.log("- Run npm run local:configure-markets to ensure all config is set");
        console.log("- Check the error details above for specific fix");
      }
    } else {
      console.log("⚠️ Neither DepositExecuted nor DepositCancelled events found");
      console.log("This is unexpected - check the transaction logs manually");
    }
  } catch (error: any) {
    console.log("\n❌ Transaction reverted!");
    console.log("Error:", error.reason || error.message);

    // Try to decode the error
    if (error.data) {
      try {
        const decodedError = parseError(error.data, false);
        if (decodedError) {
          console.log("\nDecoded Error:", formatParsedError(decodedError));
        }
      } catch {
        console.log("Could not decode error data");
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
