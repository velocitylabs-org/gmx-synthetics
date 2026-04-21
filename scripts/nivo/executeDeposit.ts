import hre from "hardhat";
import { getDepositKeys } from "../../utils/deposit";
import { fetchSignedPricesBaseSepolia } from "./chainlinkProvider/signedPricesBaseSepolia";
import { hashString } from "../../utils/hash";
import { withGasBuffer } from "./utils";

const { ethers } = hre;

/**
 * Execute a deposit into a Nivo FX market (GBP/USDC). Uses the NIVO_KEEPER_PRIVATE_KEY.
 *
 * Run it with the DEPOSIT_KEY env var you want to execute.
 * npx hardhat run scripts/nivo/executeDeposit.ts --network baseSepolia
 * Log deposits again: npx hardhat run scripts/printDeposits.ts --network baseSepolia
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
  const depositHandler = await ethers.getContract("DepositHandler");
  const chainlinkDataStreamProvider = await ethers.getContract("ChainlinkDataStreamProvider");
  const roleStore = await ethers.getContract("RoleStore");

  // Check if the KEEPER wallet has ORDER_KEEPER role
  const ORDER_KEEPER = hashString("ORDER_KEEPER");
  const hasRole = await roleStore.hasRole(keeperWallet.address, ORDER_KEEPER);

  if (!hasRole) {
    throw new Error("Wallet does not have ORDER_KEEPER role");
  }

  // Get deposit key
  let depositKey: string;
  const depositKeyFromEnv = process.env.DEPOSIT_KEY;
  if (depositKeyFromEnv) {
    depositKey = depositKeyFromEnv;
    console.log("Using deposit key from DEPOSIT_KEY env var:", depositKey);
  } else {
    // Get first available deposit (getDepositKeys returns a Promise because it calls contract view methods)
    const depositKeys = await getDepositKeys(dataStore, 0, 1);
    if (depositKeys.length === 0) {
      throw new Error("No deposits found. Please create a deposit first or provide DEPOSIT_KEY env var.");
    }
    depositKey = depositKeys[0];
    console.log("Using first available deposit:", depositKey);
  }

  // Read deposit details
  const deposit = await reader.getDeposit(dataStore.address, depositKey);

  if (deposit.addresses.account === ethers.constants.AddressZero) {
    throw new Error(`Deposit ${depositKey} not found or already executed`);
  }

  console.log("\n=== Deposit Info ===");
  console.log("Deposit Key:", depositKey);
  console.log("Account:", deposit.addresses.account);
  console.log("Market:", deposit.addresses.market);
  console.log("Initial Long Token:", deposit.addresses.initialLongToken);

  // Get market info to determine which tokens need prices
  const market = await reader.getMarket(dataStore.address, deposit.addresses.market);
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

  console.log("\n=== Executing Deposit ===");
  console.log("Oracle Params:", {
    tokens: oracleParams.tokens,
    providers: oracleParams.providers,
    dataLengths: oracleParams.data.map((d) => d.length),
  });

  const estimatedGas = await depositHandler.connect(keeperWallet).estimateGas.executeDeposit(depositKey, oracleParams);
  const tx = await depositHandler.connect(keeperWallet).executeDeposit(depositKey, oracleParams, {
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
