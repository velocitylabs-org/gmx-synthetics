import hre from "hardhat";

import { expandDecimals, decimalToFloat, formatAmount } from "../../utils/math";
import { OrderType, DecreasePositionSwapType } from "../../utils/order";
import { contractAt } from "../../utils/deploy";
import { DataStore, ExchangeRouter, Reader, Router } from "../../typechain-types";
import { BigNumberish } from "ethers";
import { SUPPORTED_FX_CURRENCIES, SUPPORTED_NETWORKS } from "./utils";
import { DEFAULT_MARKET_TYPE, fetchMarketAddress } from "../../utils/market";
import { fetchOracleSignedPrices } from "./chainlinkProvider/signedPrices";
import { computeAcceptablePrice } from "./utils";
const { ethers } = hre;

/**
 * Create a position order into a Nivo FX market (FX/USDC). Uses the WALLET_TESTER_PRIVATE_KEY.
 *
 * FX_CURRENCY=BRL npx hardhat run scripts/nivo/openPositionOrder.ts --network baseSepolia
 *
 * By default POSITION_COLLATERAL_AMOUNT and POSITION_SIZE_USD are set to 2 USDC and $10 (x5 leverage)
 * FX_CURRENCY=BRL POSITION_COLLATERAL_AMOUNT=2 POSITION_SIZE_USD=10 npx hardhat run scripts/nivo/openPositionOrder.ts --network baseSepolia
 *
 * Use the order TX hash to print the events: TX=0x... npx hardhat run scripts/parseTransactionEvents.ts --network baseSepolia
 *
 * Execute the position order: npx hardhat run scripts/nivo/executeOpenPosition.ts --network baseSepolia
 * Use the keeper execution TX hash to print the events: TX=0x... npx hardhat run scripts/parseTransactionEvents.ts --network baseSepolia
 */
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
    ...(isIncreaseOrder
      ? [
          exchangeRouter.interface.encodeFunctionData("sendTokens", [
            initialCollateralToken,
            orderVault.address,
            initialCollateralDeltaAmount,
          ]),
        ]
      : []),
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

  const fxCurrency = process.env.FX_CURRENCY;
  if (!fxCurrency || !SUPPORTED_FX_CURRENCIES.includes(fxCurrency)) {
    throw new Error("FX_CURRENCY is not set or not supported");
  }

  const walletTesterPrivateKey = process.env.WALLET_TESTER_PRIVATE_KEY;
  if (!walletTesterPrivateKey) {
    throw new Error("WALLET_TESTER_PRIVATE_KEY is not set");
  }

  const wallet = new ethers.Wallet(walletTesterPrivateKey, ethers.provider);

  const positionCollateralAmount = process.env.POSITION_COLLATERAL_AMOUNT
    ? Number(process.env.POSITION_COLLATERAL_AMOUNT)
    : 2;
  const positionSizeAmount = process.env.POSITION_SIZE_USD ? Number(process.env.POSITION_SIZE_USD) : 10;

  const router = await hre.ethers.getContract<Router>("Router");
  const reader = await hre.ethers.getContract<Reader>("Reader");
  const dataStore = await hre.ethers.getContract<DataStore>("DataStore");
  const exchangeRouter = await hre.ethers.getContract<ExchangeRouter>("ExchangeRouter");
  const exchangeRouterConnected = exchangeRouter.connect(wallet);
  const receiver = await wallet.getAddress();
  const referralCode = ethers.constants.HashZero;

  const tokens = await hre.gmx.getTokens();

  const syntheticFx = ethers.utils.getAddress(tokens[fxCurrency].address);
  if (!tokens[fxCurrency] || !tokens[fxCurrency].address || !syntheticFx) {
    throw new Error(`Invalid FX currency: ${fxCurrency}`);
  }
  const collateralToken = ethers.utils.getAddress(tokens["USDC"].address);
  if (!collateralToken || !tokens["USDC"] || !tokens["USDC"].address) {
    throw new Error(`${collateralToken} is not a valid token`);
  }

  const syntheticMarketAddress = await fetchMarketAddress(
    syntheticFx,
    collateralToken,
    collateralToken,
    DEFAULT_MARKET_TYPE
  );
  if (!syntheticMarketAddress || syntheticMarketAddress === ethers.constants.AddressZero) {
    throw new Error(`Market not found in DataStore for ${fxCurrency}/USDC.`);
  }
  const syntheticMarketInfo = await reader.getMarket(dataStore.address, syntheticMarketAddress);

  const syntheticFxPrice = await fetchOracleSignedPrices([syntheticMarketInfo.indexToken]);
  const pricePrecision = 30 - tokens[fxCurrency].decimals; // protocol stores prices at 10^(30-decimals)
  const priceData = syntheticFxPrice[syntheticMarketInfo.indexToken.toLowerCase()];
  console.log(`signedPrices [${fxCurrency}]: min=${formatAmount(priceData.min, pricePrecision, 4, true)}`);
  console.log(`signedPrices [${fxCurrency}]: max=${formatAmount(priceData.max, pricePrecision, 4, true)}`);

  // --- Configuration ---
  const isLong = false;
  const orderType = OrderType.MarketIncrease; // MarketIncrease (open) or MarketDecrease (close)
  const collateralAmountUsdc = expandDecimals(positionCollateralAmount, 6); // 2 USDC (6 decimals)
  const sizeUsd = decimalToFloat(positionSizeAmount); // $10 position

  const fxTokenConfig = tokens[fxCurrency];
  const acceptablePrice = computeAcceptablePrice(
    syntheticFxPrice,
    syntheticMarketInfo.indexToken,
    isLong,
    orderType,
    fxTokenConfig.dataStreamIsInverted ?? false,
    fxTokenConfig.decimals
  );
  console.log(
    `acceptablePrice [${fxCurrency}]: ${formatAmount(acceptablePrice, pricePrecision, 6, true)} USD/${fxCurrency}`
  );

  const tx = await createOrder({
    router,
    exchangeRouter: exchangeRouterConnected,
    receiver,
    referralCode,
    market: syntheticMarketAddress,
    initialCollateralToken: collateralToken,
    initialCollateralDeltaAmount: collateralAmountUsdc,
    sizeDeltaUsd: sizeUsd,
    triggerPrice: 0,
    acceptablePrice,
    isLong,
    orderType,
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
