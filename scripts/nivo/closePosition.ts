import hre from "hardhat";

import { expandDecimals } from "../../utils/math";
import { OrderType, DecreasePositionSwapType } from "../../utils/order";
import { DataStore, ExchangeRouter, Reader } from "../../typechain-types";
import { BigNumberish } from "ethers";
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

  const signer = exchangeRouter.signer;

  const estimatedGasLimit = 10_000_000;
  const gasPrice = await signer.getGasPrice();
  const executionFee = gasPrice.mul(estimatedGasLimit);

  const orderParams: Parameters<typeof exchangeRouter.createOrder>[0] = {
    addresses: {
      receiver,
      cancellationReceiver: AddressZero,
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
    shouldUnwrapNativeToken: true,
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

  const marketFilter = process.env.MARKET ? ethers.utils.getAddress(process.env.MARKET) : null;
  const positionIndex = process.env.POSITION_INDEX ? parseInt(process.env.POSITION_INDEX, 10) : 0;

  const position = marketFilter
    ? positions.find((p) => p.addresses.market.toLowerCase() === marketFilter.toLowerCase())
    : positions[positionIndex];

  if (!position) {
    throw new Error(
      marketFilter
        ? `No position found for market ${marketFilter}.`
        : `No position at index ${positionIndex}. Use POSITION_INDEX=0..${positions.length - 1} or MARKET=0x...`
    );
  }

  const market = position.addresses.market;
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
  // 1% slippage: ~1.3509 * 1.01 for short (pay at most), ~1.3509 * 0.99 for long (accept at least).
  const acceptablePrice = isLong
    ? expandDecimals(1337391, 6) // ~0.99 * 1.35
    : expandDecimals(1364409, 6); // ~1.01 * 1.35

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

  console.log("\ntx sent:", tx.hash);
  console.log("Run executeClosePosition with ORDER_KEY=<orderKey> after the order is created.");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });
