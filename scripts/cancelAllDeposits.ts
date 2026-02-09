/**
 * Cancel All Pending Deposits
 *
 * This script cancels all pending deposit requests created by the current account.
 * Useful for cleaning up deposits that failed to execute or have invalid parameters.
 *
 * Usage: npm run local:cancel-all-deposits
 */
import { deployments, ethers } from "hardhat";

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║              CANCEL ALL PENDING DEPOSITS                      ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  const [signer] = await ethers.getSigners();
  console.log("Account:", signer.address);

  // Get contract deployments
  const dataStoreDeployment = await deployments.get("DataStore");
  const exchangeRouterDeployment = await deployments.get("ExchangeRouter");

  const dataStore = await ethers.getContractAt("DataStore", dataStoreDeployment.address);
  const exchangeRouter = await ethers.getContractAt("ExchangeRouter", exchangeRouterDeployment.address);

  console.log("DataStore:", dataStoreDeployment.address);
  console.log("ExchangeRouter:", exchangeRouterDeployment.address);

  // Get deposit count
  const DEPOSIT_LIST = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["DEPOSIT_LIST"]));
  const depositCount = await dataStore.getBytes32Count(DEPOSIT_LIST);
  console.log("\nTotal deposits in system:", depositCount.toString());

  if (depositCount.eq(0)) {
    console.log("No pending deposits to cancel.");
    return;
  }

  // Get all deposit keys
  const depositKeys = await dataStore.getBytes32ValuesAt(DEPOSIT_LIST, 0, depositCount);
  console.log("Deposit keys found:", depositKeys.length);

  // Get Reader to fetch deposit details
  const readerDeployment = await deployments.get("Reader");
  const reader = await ethers.getContractAt("Reader", readerDeployment.address);

  console.log("\n=== Cancelling Deposits ===\n");

  let cancelledCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < depositKeys.length; i++) {
    const depositKey = depositKeys[i];
    console.log(`\nDeposit ${i + 1}/${depositKeys.length}`);
    console.log("Key:", depositKey);

    try {
      // Get deposit info
      const depositInfo = await reader.getDeposit(dataStoreDeployment.address, depositKey);
      const depositAccount = depositInfo.addresses.account;
      const depositMarket = depositInfo.addresses.market;

      console.log("  Account:", depositAccount);
      console.log("  Market:", depositMarket);

      // Check if this deposit belongs to current account
      if (depositAccount.toLowerCase() !== signer.address.toLowerCase()) {
        console.log("  ⏭️ Skipping - not owned by current account");
        skippedCount++;
        continue;
      }

      console.log("  Cancelling deposit...");
      const tx = await exchangeRouter.cancelDeposit(depositKey, {
        gasLimit: 15000000,
      });
      const receipt = await tx.wait();
      console.log("  ✅ Deposit cancelled! Gas used:", receipt.gasUsed.toString());
      cancelledCount++;
    } catch (error: any) {
      console.log("  ❌ Failed to cancel:", error.reason || error.message?.slice(0, 100));
      failedCount++;
    }
  }

  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log(
    `${`║  Cancelled: ${cancelledCount}  |  Skipped: ${skippedCount}  |  Failed: ${failedCount}  |  Total: ${depositKeys.length}`.padEnd(
      63
    )}║`
  );
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  if (cancelledCount > 0) {
    console.log("✅ Deposits cancelled successfully!");
    console.log("Tokens have been refunded to your wallet.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
