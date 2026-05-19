import hre from "hardhat";
import { getOrderKeys } from "../../utils/order";
import { fetchOracleSignedPrices } from "./chainlinkProvider/signedPrices";
import { hashString } from "../../utils/hash";
import { withGasBuffer } from "./utils";

const { ethers } = hre;

/**
 * Execute a close (MarketDecrease) order. Same flow as executeOpenPosition:
 * keeper runs this with ORDER_KEY from the close order created by closePositionOrder.ts.
 * Example: ORDER_KEY=0x1234... npx hardhat run scripts/nivo/executeClosePosition.ts --network baseSepolia
 */
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

  const ORDER_KEEPER = hashString("ORDER_KEEPER");
  const hasRole = await roleStore.hasRole(keeperWallet.address, ORDER_KEEPER);

  if (!hasRole) {
    throw new Error("Wallet does not have ORDER_KEEPER role");
  }

  let orderKey: string;
  const orderKeyFromEnv = process.env.ORDER_KEY;
  if (orderKeyFromEnv) {
    orderKey = orderKeyFromEnv;
    console.log("Using order key from ORDER_KEY env var:", orderKey);
  } else {
    const orderKeys = await getOrderKeys(dataStore, 0, 1);
    if (orderKeys.length === 0) {
      throw new Error("No orders found. Create a close order first (closePositionOrder.ts) or set ORDER_KEY.");
    }
    orderKey = orderKeys[0];
    console.log("Using first available order:", orderKey);
  }

  const order = await reader.getOrder(dataStore.address, orderKey);
  const { receiver, market: orderMarket, initialCollateralToken: initialCollateralTokenAddress } = order.addresses;

  if (orderMarket === ethers.constants.AddressZero) {
    throw new Error(`Order ${orderKey} not found or already executed`);
  }

  console.log("\n=== Order Info (close) ===");
  console.log("Order Key:", orderKey);
  console.log("Account:", receiver);
  console.log("Market:", orderMarket);
  console.log("Initial Collateral Token:", initialCollateralTokenAddress);

  const market = await reader.getMarket(dataStore.address, orderMarket);
  const indexToken = market.indexToken;
  const longToken = market.longToken;
  const shortToken = market.shortToken;

  console.log("\n=== Market Info ===");
  console.log("Index Token:", indexToken);
  console.log("Long Token:", longToken);
  console.log("Short Token:", shortToken);

  console.log("\n=== Fetching Oracle Prices from Chainlink Data Streams API ===");
  const tokens =
    longToken.toLowerCase() === shortToken.toLowerCase()
      ? [indexToken, longToken]
      : [indexToken, longToken, shortToken];
  const signedPrices = await fetchOracleSignedPrices(tokens);

  const providers: string[] = [];
  const data: string[] = [];

  for (const token of tokens) {
    const priceData = signedPrices[token.toLowerCase()];

    if (!priceData) {
      throw new Error(`Price data not found for token ${token}. Ensure oracle prices are available.`);
    }

    providers.push(chainlinkDataStreamProvider.address);
    data.push(priceData.report);

    console.log(`Token ${token}: min=${priceData.min.toString()}, max=${priceData.max.toString()}`);
  }

  const oracleParams = {
    tokens,
    providers,
    data,
  };

  console.log("\n=== Executing close order ===");
  console.log("Oracle Params:", {
    tokens: oracleParams.tokens,
    providers: oracleParams.providers,
    dataLengths: oracleParams.data.map((d) => d.length),
  });

  const estimatedGas = await orderHandler.connect(keeperWallet).estimateGas.executeOrder(orderKey, oracleParams);
  const tx = await orderHandler.connect(keeperWallet).executeOrder(orderKey, oracleParams, {
    gasLimit: withGasBuffer(estimatedGas),
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
