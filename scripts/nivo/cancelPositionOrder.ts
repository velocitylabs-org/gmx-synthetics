import hre from "hardhat";
import { getAccountOrderCount, getAccountOrderKeys } from "../../utils/order";

const { ethers } = hre;

/**
 * Cancel a position order created with openPositionOrder.ts using WALLET_TESTER_PRIVATE_KEY.
 *
 * - Cancel all orders for the wallet:
 *   npx hardhat run scripts/nivo/cancelPositionOrder.ts --network baseSepolia
 *
 * - Cancel a specific order by key:
 *   ORDER_KEY=0x... npx hardhat run scripts/nivo/cancelPositionOrder.ts --network baseSepolia
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

  const orderKeyFromEnv = process.env.ORDER_KEY;
  if (orderKeyFromEnv) {
    const order = await reader.getOrder(dataStore.address, orderKeyFromEnv);
    if (order.addresses.account === ethers.constants.AddressZero) {
      throw new Error(`Order ${orderKeyFromEnv} not found or already executed/cancelled`);
    }

    if (order.addresses.account.toLowerCase() !== wallet.address.toLowerCase()) {
      throw new Error(
        `Order account ${order.addresses.account} does not match wallet ${wallet.address}. Only the account that created the order can cancel it.`
      );
    }

    keysToCancel = [orderKeyFromEnv];
    console.log("Cancelling order key (from ORDER_KEY):", orderKeyFromEnv);
  } else {
    const count = await getAccountOrderCount(dataStore, wallet.address);
    const countNum = typeof count === "number" ? count : Number(count);
    console.log("countNum", countNum);
    if (countNum === 0) {
      throw new Error(
        `No orders found for account ${wallet.address}. Set ORDER_KEY to cancel a specific order by key.`
      );
    }

    keysToCancel = await getAccountOrderKeys(dataStore, wallet.address, 0, countNum);
    console.log(`Found ${keysToCancel.length} order(s) for your account. Cancelling.`);
  }

  for (const key of keysToCancel) {
    const order = await reader.getOrder(dataStore.address, key);

    console.log("Cancelling order key:", key);
    console.log("  account:", order.addresses.account);
    console.log("  market:", order.addresses.market);
    console.log("  sizeDeltaUsd:", order.numbers.sizeDeltaUsd?.toString?.() ?? order.numbers.sizeDeltaUsd);

    const tx = await exchangeRouter.connect(wallet).cancelOrder(key);
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
