import hre from "hardhat";
import { getAccountDepositCount, getAccountDepositKeys } from "../../utils/deposit";

const { ethers } = hre;

/**
 * Cancel a deposit created with createDepositNivoMarket.ts, uses the WALLET_TESTER_PRIVATE_KEY.
 *
 * Cancel all deposits for the wallet: 
 * npx hardhat run scripts/nivo/cancelDeposit.ts --network baseSepolia 
 * Cancel a specific deposit by key:
 * DEPOSIT_KEY=0x... npx hardhat run scripts/nivo/cancelDepositOrder.ts --network baseSepolia  (or set the DEPOSIT_KEY in your env var)
 * 
 * Log deposits: npx hardhat run scripts/printDeposits.ts --network baseSepolia
 * Your deposit should be removed from the list.
 */
async function main() {
  const walletTesterPrivateKey = process.env.WALLET_TESTER_PRIVATE_KEY;
  if (!walletTesterPrivateKey) {
    throw new Error("WALLET_TESTER_PRIVATE_KEY is not set");
  }
  const wallet = new ethers.Wallet(walletTesterPrivateKey, ethers.provider);

  const dataStore = await ethers.getContract("DataStore");
  const reader = await ethers.getContract("Reader");
  const exchangeRouter = await ethers.getContract("ExchangeRouter");

  let keysToCancel: string[];

  const depositKeyFromEnv = process.env.DEPOSIT_KEY;
  if (depositKeyFromEnv) {
    const deposit = await reader.getDeposit(dataStore.address, depositKeyFromEnv);
    if (deposit.addresses.account === ethers.constants.AddressZero) {
      throw new Error(`Deposit ${depositKeyFromEnv} not found or already executed/cancelled`);
    }
    if (deposit.addresses.account.toLowerCase() !== wallet.address.toLowerCase()) {
      throw new Error(
        `Deposit account ${deposit.addresses.account} does not match wallet ${wallet.address}. Only the account that created the deposit can cancel it.`
      );
    }
    keysToCancel = [depositKeyFromEnv];
    console.log("Cancelling deposit key (from DEPOSIT_KEY):", depositKeyFromEnv);
  } else {
    const count = await getAccountDepositCount(dataStore, wallet.address);
    const countNum = typeof count === "number" ? count : count.toNumber?.() ?? Number(count);
    if (countNum === 0) {
      throw new Error(
        `No deposits found for account ${wallet.address}. Set DEPOSIT_KEY to cancel a specific deposit by key.`
      );
    }
    keysToCancel = await getAccountDepositKeys(dataStore, wallet.address, 0, countNum);
    console.log(`Found ${keysToCancel.length} deposit(s) for your account. Cancelling.`);
  }

  for (const key of keysToCancel) {
    const deposit = await reader.getDeposit(dataStore.address, key);
    console.log("Cancelling deposit key:", key);
    console.log("  market:", deposit.addresses.market);
    console.log("  initialLongTokenAmount:", deposit.numbers.initialLongTokenAmount.toString());
    console.log("  initialShortTokenAmount:", deposit.numbers.initialShortTokenAmount.toString());

    const tx = await exchangeRouter.connect(wallet).cancelDeposit(key);
    console.log("  tx hash:", tx.hash);
    await tx.wait();
    console.log("  cancelled.");
  }

  console.log("Done.");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });
