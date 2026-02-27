import hre from "hardhat";

import { expandDecimals, decimalToFloat } from "../../utils/math";
import { OrderType, DecreasePositionSwapType } from "../../utils/order";
import { contractAt } from "../../utils/deploy";
import { DataStore, ExchangeRouter, Reader, Router } from "../../typechain-types";
import { BigNumberish } from "ethers";
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

  const collateralToken = await contractAt("MintableToken", initialCollateralToken, signer);
  const approvedAmount = await collateralToken.allowance(await signer.getAddress(), router.address);
  if (approvedAmount.lt(initialCollateralDeltaAmount)) {
    await collateralToken.approve(router.address, initialCollateralDeltaAmount);
  }

  const executionFee = expandDecimals(10, 15); // 0.010 ETH (min is ~0.0051 ETH)
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
      minOutputAmount: initialCollateralDeltaAmount,
      validFromTime: 0,
    },
    orderType,
    decreasePositionSwapType,
    isLong,
    shouldUnwrapNativeToken: true,
    autoCancel: false,
    referralCode,
    dataList: [],
  };

  const multicallArgs = [
    exchangeRouter.interface.encodeFunctionData("sendWnt", [orderVault.address, executionFee]),
    exchangeRouter.interface.encodeFunctionData("sendTokens", [
      initialCollateralToken,
      orderVault.address,
      initialCollateralDeltaAmount,
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
  if (hre.network.name !== "baseSepolia") {
    throw new Error(`Unsupported network: ${hre.network.name}`);
  }

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

  const market: string = ethers.utils.getAddress("0x090aAF3eee5f64140e2F752a9f568a49A985ffD9"); // index: GBP  long: USDC  short: USDC
  const USDC: string = ethers.utils.getAddress("0x036CbD53842c5426634e7929541eC2318f3dCF7e"); // USDC

  if (!markets.some((m) => m.marketToken === market)) {
    throw new Error(`${market} is not a valid market`);
  }

  const tokens = await hre.gmx.getTokens();
  if (!Object.values(tokens).some((t) => t.address === USDC)) {
    throw new Error(`${USDC} is not a valid token`);
  }

  // GBP market: Chainlink price ~$1.3509 per GBP.
  // Short increase: execution only if executionPrice >= acceptablePrice.
  // 1% slippage: 1.3509 * 0.99 ≈ 1.3374 USD per GBP.
  // Price decimals on-chain = 30 - token.decimals (config/tokens.ts: GBP has decimals 18) => 12 decimals.
  // expandDecimals(1337391, 6) => 1.337391e12, which matches that format.
  const acceptablePrice = expandDecimals(1337391, 6); // 1.3374 USD per GBP

  const tx = await createOrder({
    router,
    exchangeRouter: exchangeRouterConnected,
    receiver,
    referralCode,
    market,
    initialCollateralToken: USDC,
    initialCollateralDeltaAmount: 2500000, // 2.5 USDC
    sizeDeltaUsd: decimalToFloat(10), // 10 USD
    triggerPrice: 0, // not needed for market order
    acceptablePrice,
    isLong: false,
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
