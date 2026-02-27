import hre from "hardhat";
import { getOrderKeys } from "../../utils/order";
import { fetchSignedPricesBaseSepolia } from "../../utils/pricesBaseSepolia";
import { hashString } from "../../utils/hash";

const { ethers } = hre;

// To use this script, run it with the ORDER_KEY env var you want to execute.
// Example: ORDER_KEY=0x1234... npx hardhat run scripts/nivo/executePosition.ts --network baseSepolia

async function main() {
  const keeperPrivateKey = process.env.NIVO_KEEPER_PRIVATE_KEY;
  if (!keeperPrivateKey) {
    throw new Error("NIVO_KEEPER_PRIVATE_KEY is not set");
  }
  const keeperWallet = new ethers.Wallet(keeperPrivateKey, ethers.provider);

  const dataStore = await ethers.getContract("DataStore");
  const reader = await ethers.getContract("Reader");
  const orderHandler = await ethers.getContract("OrderHandler");
  const chainlinkDataStreamProvider = await ethers.getContract("ChainlinkDataStreamProvider");
  const roleStore = await ethers.getContract("RoleStore");

  // Check if the KEEPER wallet has ORDER_KEEPER role
  const ORDER_KEEPER = hashString("ORDER_KEEPER");
  const hasRole = await roleStore.hasRole(keeperWallet.address, ORDER_KEEPER);

  if (!hasRole) {
    throw new Error("Wallet does not have ORDER_KEEPER role");
  }

  // Get order key
  let orderKey: string;
  const orderKeyFromEnv = process.env.ORDER_KEY;
  if (orderKeyFromEnv) {
    orderKey = orderKeyFromEnv;
    console.log("Using order key from ORDER_KEY env var:", orderKey);
  } else {
    const orderKeys = await getOrderKeys(dataStore, 0, 1);
    if (orderKeys.length === 0) {
      throw new Error("No orders found. Please create a position order first or provide ORDER_KEY env var.");
    }
    orderKey = orderKeys[0];
    console.log("Using first available order:", orderKey);
  }

  // Read order details
  const order = await reader.getOrder(dataStore.address, orderKey);
  const { receiver, market: orderMarket, initialCollateralToken: initialCollateralTokenAddress } = order.addresses;

  if (orderMarket === ethers.constants.AddressZero) {
    throw new Error(`Order ${orderKey} not found or already executed`);
  }

  console.log("\n=== Order Info ===");
  console.log("Order Key:", orderKey);
  console.log("Account:", receiver);
  console.log("Market:", orderMarket);
  console.log("Initial Collateral Token:", initialCollateralTokenAddress);

  // Get market info to determine which tokens need prices
  const market = await reader.getMarket(dataStore.address, orderMarket);
  const indexToken = market.indexToken;
  const longToken = market.longToken;
  const shortToken = market.shortToken;

  console.log("\n=== Market Info ===");
  console.log("Index Token:", indexToken);
  console.log("Long Token:", longToken);
  console.log("Short Token:", shortToken);

  // Fetch signed prices from oracle API
  console.log("\n=== Fetching Oracle Prices from Chainlink Data Streams API ===");
  const tokens = [indexToken, longToken, shortToken];
  const signedPrices = await fetchSignedPricesBaseSepolia(tokens);

  const providers: string[] = [];
  const data: string[] = [];

  for (const token of tokens) {
    const priceData = signedPrices[token.toLowerCase()];

    if (!priceData) {
      throw new Error(`Price data not found for token ${token}. Make sure oracle prices are available.`);
    }

    providers.push(chainlinkDataStreamProvider.address);
    data.push(priceData.blob);

    console.log(`Token ${token}: min=${priceData.min.toString()}, max=${priceData.max.toString()}`);
  }

  const oracleParams = {
    tokens,
    providers,
    data,
  };

  console.log("\n=== Executing Order ===");
  console.log("Oracle Params:", {
    tokens: oracleParams.tokens,
    providers: oracleParams.providers,
    dataLengths: oracleParams.data.map((d) => d.length),
  });

  const tx = await orderHandler.connect(keeperWallet).executeOrder(orderKey, oracleParams, {
    gasLimit: 2500000,
  });

  console.log("Transaction sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("Transaction confirmed in block:", receipt.blockNumber);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });
