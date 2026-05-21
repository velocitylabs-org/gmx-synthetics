import { hashString } from "../../utils/hash";
import hre from "hardhat";
import { applyFactor, bigNumberify, expandDecimals } from "../../utils/math";
import {
  ESTIMATED_GAS_FEE_BASE_AMOUNT_V2_1,
  ESTIMATED_GAS_FEE_MULTIPLIER_FACTOR,
  ESTIMATED_GAS_FEE_PER_ORACLE_PRICE,
} from "../../utils/keys";
import { BigNumber } from "ethers";
import { SignedPrices } from "./chainlinkProvider/signedPrices";
import { OrderType } from "../../utils/order";

const { ethers } = hre;

export const withGasBuffer = (estimatedGas: BigNumber): BigNumber => {
  return estimatedGas.mul(120).div(100);
};

export const SUPPORTED_NETWORKS = ["baseSepolia", "base"];
export const SUPPORTED_FX_CURRENCIES = ["GBP", "BRL", "MXN", "COP"];

export const getDepositExecutionFee = async (): Promise<BigNumber> => {
  const dataStore = await ethers.getContract("DataStore");

  // Compute execution fee exactly as the contract does:
  //   adjustedGasLimit = baseAmount + applyFactor(DEPOSIT_GAS_LIMIT, multiplier) + oraclePriceCount * perOraclePrice
  //   executionFee = adjustedGasLimit * tx.gasprice   (tx.gasprice = effectiveGasPrice in EIP-1559)
  const DEPOSIT_GAS_LIMIT_KEY = hashString("DEPOSIT_GAS_LIMIT");
  const [depositGasLimitBase, feeBaseAmount, feeMultiplier, feePerOraclePrice] = await Promise.all([
    dataStore.getUint(DEPOSIT_GAS_LIMIT_KEY),
    dataStore.getUint(ESTIMATED_GAS_FEE_BASE_AMOUNT_V2_1),
    dataStore.getUint(ESTIMATED_GAS_FEE_MULTIPLIER_FACTOR),
    dataStore.getUint(ESTIMATED_GAS_FEE_PER_ORACLE_PRICE),
  ]);

  // GasUtils.estimateDepositOraclePriceCount returns 3 + swapsCount (no swaps here = 3)
  const oraclePriceCount = bigNumberify(3);
  const adjustedGasLimit = feeBaseAmount
    .add(applyFactor(depositGasLimitBase, feeMultiplier))
    .add(oraclePriceCount.mul(feePerOraclePrice));
  const feeData = await ethers.provider.getFeeData();
  const effectiveGasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? expandDecimals(1, 9);
  const executionFee = adjustedGasLimit.mul(effectiveGasPrice);
  return executionFee;
};

export function computeAcceptablePrice(
  signedPrices: SignedPrices,
  indexToken: string,
  isLong: boolean,
  orderType: number,
  isInverted: boolean,
  tokenDecimals: number,
  slippageBase = 200
): ReturnType<typeof ethers.BigNumber.from> {
  const priceData = signedPrices[indexToken.toLowerCase()];
  if (!priceData) throw new Error(`No price data for index token ${indexToken}`);

  let min = priceData.min;
  let max = priceData.max;

  // Inversion logic for streams like USD/BRL (Chainlink reports BRL-per-USD, not USD-per-BRL):
  //
  // - Raw stream (ex USD/BRL): Chainlink reports ~4.89 → stored as 4889885000000 (precision 12)
  // - Scale = 10^(2*12) = 10^24
  // - After inversion: 10^24 / 4889885000000 ≈ 204500000000 → ~0.2045 USD/BRL ✓
  // - Min/max swap because scale/rawMax < scale/rawMin — a larger raw value yields a smaller inverted price
  if (isInverted) {
    // Matches on-chain inversion: scale = 10^(2*(30-decimals))
    // min/max swap because inverting a smaller number yields a larger result
    const scale = 10n ** (2n * BigInt(30 - tokenDecimals));
    const invertedMin = scale / max;
    const invertedMax = scale / min;
    min = invertedMin;
    max = invertedMax;
  }

  const isIncreaseOrder = orderType === OrderType.MarketIncrease;
  // Long increase / short decrease → ceiling (wantsHighPrice = true)
  // Long decrease / short increase → floor (wantsHighPrice = false)
  const wantsHighPrice = (isLong && isIncreaseOrder) || (!isLong && !isIncreaseOrder);
  return wantsHighPrice
    ? ethers.BigNumber.from(max.toString())
        .mul(10000 + slippageBase)
        .div(10000)
    : ethers.BigNumber.from(min.toString())
        .mul(10000 - slippageBase)
        .div(10000);
}
