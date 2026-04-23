import hre from "hardhat";
import { getGlvDepositKeys } from "../../../utils/glv/glvDeposit";
import { fetchSignedPricesBaseSepolia } from "../chainlinkProvider/signedPricesBaseSepolia";
import { hashString } from "../../../utils/hash";
import { withGasBuffer } from "../utils";

const { ethers } = hre;

/**
 * Execute a GLV deposit. Uses the NIVO_KEEPER_PRIVATE_KEY.
 *
 * Run it with the DEPOSIT_KEY env var you want to execute.
 * npx hardhat run scripts/nivo/glvs/glvExecuteDeposit.ts --network baseSepolia
 * Log deposits again: npx hardhat run scripts/nivo/glvs/glvDeposit.ts --network baseSepolia
 * Your deposit should be removed from the list.
 *
 */
async function main() {
  const keeperPrivateKey = process.env.NIVO_KEEPER_PRIVATE_KEY;
  if (!keeperPrivateKey) {
    throw new Error("NIVO_KEEPER_PRIVATE_KEY is not set");
  }
  const keeperWallet = new ethers.Wallet(keeperPrivateKey, ethers.provider);

  const dataStore = await ethers.getContract("DataStore");
  const reader = await ethers.getContract("Reader");
  const glvReader = await ethers.getContract("GlvReader");
  const glvDepositHandler = await ethers.getContract("GlvDepositHandler");
  const chainlinkDataStreamProvider = await ethers.getContract("ChainlinkDataStreamProvider");
  const roleStore = await ethers.getContract("RoleStore");

  // Check if the KEEPER wallet has ORDER_KEEPER role
  const ORDER_KEEPER = hashString("ORDER_KEEPER");
  const hasRole = await roleStore.hasRole(keeperWallet.address, ORDER_KEEPER);

  if (!hasRole) {
    throw new Error("Wallet does not have ORDER_KEEPER role");
  }

  // Get GLV deposit key
  let depositKey: string;
  const depositKeyFromEnv = process.env.DEPOSIT_KEY;
  if (depositKeyFromEnv) {
    depositKey = depositKeyFromEnv;
    console.log("Using deposit key from DEPOSIT_KEY env var:", depositKey);
  } else {
    // Get first available GLV deposit
    const depositKeys = await getGlvDepositKeys(dataStore, 0, 1);
    if (depositKeys.length === 0) {
      throw new Error("No GLV deposits found. Please create a deposit first or provide DEPOSIT_KEY env var.");
    }
    depositKey = depositKeys[0];
    console.log("Using first available GLV deposit:", depositKey);
  }

  // Read GLV deposit details
  const glvDeposit = await glvReader.getGlvDeposit(dataStore.address, depositKey);

  if (glvDeposit.addresses.account === ethers.constants.AddressZero) {
    throw new Error(`GLV deposit ${depositKey} not found or already executed`);
  }

  console.log("\n=== GLV Deposit Info ===");
  console.log("Deposit Key:", depositKey);
  console.log("Account:", glvDeposit.addresses.account);
  console.log("GLV:", glvDeposit.addresses.glv);
  console.log("Market:", glvDeposit.addresses.market);
  console.log("Initial Long Token:", glvDeposit.addresses.initialLongToken);

  // Get market info to determine which tokens need prices
  const market = await reader.getMarket(dataStore.address, glvDeposit.addresses.market);
  const indexToken = market.indexToken;
  const longToken = market.longToken;
  const shortToken = market.shortToken;

  console.log("\n=== Market Info ===");
  console.log("Index Token:", indexToken);
  console.log("Long Token:", longToken);
  console.log("Short Token:", shortToken);

  // Fetch signed prices from oracle API
  console.log("\n=== Fetching Oracle Prices from Chainlink Data Streams API ===");
  const tokens =
    longToken.toLowerCase() === shortToken.toLowerCase()
      ? [indexToken, longToken]
      : [indexToken, longToken, shortToken];
  const signedPrices = await fetchSignedPricesBaseSepolia(tokens);

  // Get prices for all required tokens (indexToken, longToken, shortToken)
  const providers: string[] = [];
  const data: string[] = [];

  for (const token of tokens) {
    const priceData = signedPrices[token.toLowerCase()];

    if (!priceData) {
      throw new Error(`Price data not found for token ${token}. Make sure oracle prices are available.`);
    }

    providers.push(chainlinkDataStreamProvider.address);
    data.push(priceData.report);

    console.log(`Token ${token}: min=${priceData.min.toString()}, max=${priceData.max.toString()}`);
  }

  // Prepare oracle params
  const oracleParams = {
    tokens,
    providers,
    data,
  };

  console.log("\n=== Executing GLV Deposit ===");
  console.log("Oracle Params:", {
    tokens: oracleParams.tokens,
    providers: oracleParams.providers,
    dataLengths: oracleParams.data.map((d) => d.length),
  });

  const estimatedGas = await glvDepositHandler
    .connect(keeperWallet)
    .estimateGas.executeGlvDeposit(depositKey, oracleParams);
  const tx = await glvDepositHandler.connect(keeperWallet).executeGlvDeposit(depositKey, oracleParams, {
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
