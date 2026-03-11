import hre from "hardhat";

import { OrderType, DecreasePositionSwapType } from "../../utils/order";
import { DataStore, ExchangeRouter, Reader } from "../../typechain-types";
import { BigNumber, BigNumberish } from "ethers";
import { fetchSignedPricesBaseSepolia } from "./chainlinkProvider/signedPricesBaseSepolia";
import { expandDecimals } from "../../utils/math";
const { ethers } = hre;

async function createCloseOrder({
  exchangeRouter,
  receiver,
  referralCode,
  market,
  initialCollateralToken,
  initialCollateralDeltaAmount,
  sizeDeltaUsd,
  triggerPrice,
  acceptablePrice,
  isLong,
  decreasePositionSwapType,
}: {
  exchangeRouter: ExchangeRouter;
  receiver: string;
  referralCode: string;
  market: string;
  initialCollateralToken: string;
  initialCollateralDeltaAmount: BigNumberish;
  sizeDeltaUsd: BigNumberish;
  triggerPrice: BigNumberish;
  acceptablePrice: BigNumberish;
  isLong: boolean;
  decreasePositionSwapType: number;
}) {
  const { AddressZero } = ethers.constants;
  const orderVault = await hre.ethers.getContract("OrderVault");

  const executionFee = expandDecimals(10, 15);
  const orderParams: Parameters<typeof exchangeRouter.createOrder>[0] = {
    addresses: {
      receiver,
      cancellationReceiver: receiver,
      callbackContract: AddressZero,
      uiFeeReceiver: AddressZero,
      market,
      initialCollateralToken,
      swapPath: [],
    },
    numbers: {
      sizeDeltaUsd,
      initialCollateralDeltaAmount,
      triggerPrice,
      acceptablePrice,
      executionFee,
      callbackGasLimit: 0,
      minOutputAmount: 0,
      validFromTime: 0,
    },
    orderType: OrderType.MarketDecrease,
    decreasePositionSwapType,
    isLong,
    shouldUnwrapNativeToken: false,
    autoCancel: false,
    referralCode,
    dataList: [],
  };

  // For MarketDecrease we only send execution fee (WNT), no collateral tokens
  const multicallArgs = [
    exchangeRouter.interface.encodeFunctionData("sendWnt", [orderVault.address, executionFee]),
    exchangeRouter.interface.encodeFunctionData("createOrder", [orderParams]),
  ];

  const estimatedGas = await exchangeRouter.estimateGas.multicall(multicallArgs, { value: executionFee });

  const tx = await exchangeRouter.multicall(multicallArgs, {
    value: executionFee,
    gasLimit: estimatedGas.mul(120).div(100),
  });

  return tx;
}

async function main() {
  if (hre.network.name !== "baseSepolia") {
    throw new Error(`Unsupported network: ${hre.network.name}`);
  }

  const walletTesterPrivateKey = process.env.WALLET_TESTER_PRIVATE_KEY;
  if (!walletTesterPrivateKey) {
    throw new Error("WALLET_TESTER_PRIVATE_KEY is not set");
  }

  const wallet = new ethers.Wallet(walletTesterPrivateKey, ethers.provider);

  const reader = await hre.ethers.getContract<Reader>("Reader");
  const dataStore = await hre.ethers.getContract<DataStore>("DataStore");
  const exchangeRouter = await hre.ethers.getContract<ExchangeRouter>("ExchangeRouter");
  const exchangeRouterConnected = exchangeRouter.connect(wallet);
  const receiver = await wallet.getAddress();
  const referralCode = ethers.constants.HashZero;

  const positions = await reader.getAccountPositions(dataStore.address, receiver, 0, 20);
  if (positions.length === 0) {
    throw new Error("No open positions found for this account.");
  }
  const position = positions[0];
  if (!position) {
    throw new Error("No position found for market.");
  }

  const market: string = ethers.utils.getAddress("0x090aAF3eee5f64140e2F752a9f568a49A985ffD9"); // index: GBP  long: USDC  short: USDC
  const GBP: string = ethers.utils.getAddress("0x6FCdee981b7CC0A30a34187529F1f46836522263"); // GBP
  const initialCollateralToken = position.addresses.collateralToken;
  const sizeDeltaUsd = position.numbers.sizeInUsd;
  const initialCollateralDeltaAmount = position.numbers.collateralAmount;
  const isLong = position.flags.isLong;

  console.log("\n=== Closing position ===");
  console.log("Market:", market);
  console.log("Collateral token:", initialCollateralToken);
  console.log("Size (USD):", sizeDeltaUsd.toString());
  console.log("Collateral to withdraw:", initialCollateralDeltaAmount.toString());
  console.log("Side:", isLong ? "long" : "short");

  // GBP market: use conservative acceptable price (slippage).
  // Short decrease: we "buy" index, so executionPrice <= acceptablePrice (max we pay).
  // Long decrease: we "sell" index, so executionPrice >= acceptablePrice (min we accept).

  // Acceptable price for market orders (wide slippage to avoid stale-price failures):
  // GBP is an 18-decimal token → on-chain price has 12 decimals (30 - 18)
  const signedPrices = await fetchSignedPricesBaseSepolia([GBP.toLowerCase()]);
  const price = signedPrices[GBP.toLowerCase()];
  const acceptablePrice = isLong
    ? BigNumber.from(price.min).mul(95).div(100) // ~0.95
    : BigNumber.from(price.max).mul(105).div(100); // ~1.05

  const tx = await createCloseOrder({
    exchangeRouter: exchangeRouterConnected,
    receiver,
    referralCode,
    market,
    initialCollateralToken,
    initialCollateralDeltaAmount,
    sizeDeltaUsd,
    triggerPrice: 0,
    acceptablePrice,
    isLong,
    decreasePositionSwapType: DecreasePositionSwapType.NoSwap,
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
