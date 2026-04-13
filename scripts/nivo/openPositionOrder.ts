import hre from "hardhat";

import { expandDecimals, decimalToFloat } from "../../utils/math";
import { OrderType, DecreasePositionSwapType } from "../../utils/order";
import { contractAt } from "../../utils/deploy";
import { DataStore, ExchangeRouter, Reader, Router } from "../../typechain-types";
import { BigNumberish } from "ethers";
import { SUPPORTED_NETWORKS } from "./utils";
const { ethers } = hre;

async function createOrder({
  router, // the router instance
  exchangeRouter, // the exchangeRouter instance
  receiver, // the receiver of any output tokens
  referralCode, // the referralCode
  market, // the address of the market
  initialCollateralToken, // the collateral token being sent
  initialCollateralDeltaAmount, // the amount of collateral token being sent
  sizeDeltaUsd, // the size of the position
  triggerPrice, // the price at which the order should be triggerred
  acceptablePrice, // the acceptable price at which the order should be executed
  isLong, // whether to open a long or short position
  orderType, // whether this is a market, limit, increase, decrease, swap order
  decreasePositionSwapType, // the swap type for output tokens when decreasing a position
}: {
  router: Router;
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
  orderType: number;
  decreasePositionSwapType: number;
}) {
  const { AddressZero } = ethers.constants;
  const orderVault = await hre.ethers.getContract("OrderVault");

  const signer = exchangeRouter.signer;

  const isIncreaseOrder = orderType === OrderType.MarketIncrease;
  if (isIncreaseOrder) {
    const collateralToken = await contractAt("MintableToken", initialCollateralToken, signer);
    const approvedAmount = await collateralToken.allowance(await signer.getAddress(), router.address);
    if (approvedAmount.lt(initialCollateralDeltaAmount)) {
      await collateralToken.approve(router.address, initialCollateralDeltaAmount);
    }
  }

  const executionFee = expandDecimals(10, 15); // 0.010 ETH (min is ~0.0051 ETH)
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
      initialCollateralDeltaAmount: isIncreaseOrder ? initialCollateralDeltaAmount : 0,
      triggerPrice,
      acceptablePrice,
      executionFee,
      callbackGasLimit: 0,
      minOutputAmount: 0,
      validFromTime: 0,
    },
    orderType,
    decreasePositionSwapType,
    isLong,
    shouldUnwrapNativeToken: false,
    autoCancel: false,
    referralCode,
    dataList: [],
  };

  const multicallArgs = [
    exchangeRouter.interface.encodeFunctionData("sendWnt", [orderVault.address, executionFee]),
    ...(isIncreaseOrder && [
      exchangeRouter.interface.encodeFunctionData("sendTokens", [
        initialCollateralToken,
        orderVault.address,
        initialCollateralDeltaAmount,
      ]),
    ]),
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
  if (!SUPPORTED_NETWORKS.includes(hre.network.name)) {
    throw new Error(`Unsupported network: ${hre.network.name}`);
  }
  const isBaseMainnet = hre.network.name === "base";

  const walletTesterPrivateKey = process.env.WALLET_TESTER_PRIVATE_KEY;
  if (!walletTesterPrivateKey) {
    throw new Error("WALLET_TESTER_PRIVATE_KEY is not set");
  }

  const wallet = new ethers.Wallet(walletTesterPrivateKey, ethers.provider);

  const router = await hre.ethers.getContract<Router>("Router");
  const reader = await hre.ethers.getContract<Reader>("Reader");
  const dataStore = await hre.ethers.getContract<DataStore>("DataStore");
  const exchangeRouter = await hre.ethers.getContract<ExchangeRouter>("ExchangeRouter");
  const exchangeRouterConnected = exchangeRouter.connect(wallet);
  const receiver = await wallet.getAddress();
  const referralCode = ethers.constants.HashZero;
  const markets = await reader.getMarkets(dataStore.address, 0, 100);

  const market: string = isBaseMainnet
    ? ethers.utils.getAddress("0x577CBa4C306D02072880B8bfAe261864b97A46E6")
    : ethers.utils.getAddress("0x090aAF3eee5f64140e2F752a9f568a49A985ffD9"); // index: GBP  long: USDC  short: USDC
  const USDC: string = isBaseMainnet
    ? ethers.utils.getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
    : ethers.utils.getAddress("0x036CbD53842c5426634e7929541eC2318f3dCF7e"); // USDC

  if (!markets.some((m) => m.marketToken === market)) {
    throw new Error(`${market} is not a valid market`);
  }

  const tokens = await hre.gmx.getTokens();
  if (!Object.values(tokens).some((t) => t.address === USDC)) {
    throw new Error(`${USDC} is not a valid token`);
  }

  // --- Configuration ---
  const isLong = false;
  const orderType = OrderType.MarketIncrease; // MarketIncrease (open) or MarketDecrease (close)
  const collateralAmountUsdc = 2500000; // 2.5 USDC (6 decimals)
  const sizeUsd = decimalToFloat(10); // $10 position

  // Acceptable price for market orders (wide slippage to avoid stale-price failures):
  // GBP is an 18-decimal token → on-chain price has 12 decimals (30 - 18)
  //
  // Increase: Long wants executionPrice <= acceptable (buy low), Short wants >= acceptable (sell high)
  // Decrease: Long wants executionPrice >= acceptable (sell high), Short wants <= acceptable (buy low)
  const isIncreaseOrder = orderType === OrderType.MarketIncrease;
  const wantsHighPrice = (isLong && isIncreaseOrder) || (!isLong && !isIncreaseOrder);
  const acceptablePrice = wantsHighPrice
    ? expandDecimals(200, 12) // $200 ceiling (way above any GBP price)
    : 0; // $0 floor

  const tx = await createOrder({
    router,
    exchangeRouter: exchangeRouterConnected,
    receiver,
    referralCode,
    market,
    initialCollateralToken: USDC,
    initialCollateralDeltaAmount: collateralAmountUsdc,
    sizeDeltaUsd: sizeUsd,
    triggerPrice: 0,
    acceptablePrice,
    isLong,
    orderType: OrderType.MarketIncrease,
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
