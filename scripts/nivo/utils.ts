import { hashString } from "../../utils/hash";
import hre from "hardhat";
import { applyFactor, bigNumberify, expandDecimals } from "../../utils/math";
import {
  ESTIMATED_GAS_FEE_BASE_AMOUNT_V2_1,
  ESTIMATED_GAS_FEE_MULTIPLIER_FACTOR,
  ESTIMATED_GAS_FEE_PER_ORACLE_PRICE,
} from "../../utils/keys";
import { BigNumber } from "ethers";

const { ethers } = hre;

export const withGasBuffer = (estimatedGas: BigNumber): BigNumber => {
  return estimatedGas.mul(120).div(100);
};

export const SUPPORTED_NETWORKS = ["baseSepolia", "base"];

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
