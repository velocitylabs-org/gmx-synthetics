import hre from "hardhat";
import { applyFactor, bigNumberify, expandDecimals, formatAmount } from "../../utils/math";
import {
  ESTIMATED_GAS_FEE_BASE_AMOUNT_V2_1,
  ESTIMATED_GAS_FEE_MULTIPLIER_FACTOR,
  ESTIMATED_GAS_FEE_PER_ORACLE_PRICE,
  DEPOSIT_GAS_LIMIT,
  GLV_DEPOSIT_GAS_LIMIT,
  GLV_PER_MARKET_GAS_LIMIT,
} from "../../utils/keys";
import { BigNumber, Contract, Signer, Wallet } from "ethers";
import { MintableToken, WNT } from "../../typechain-types";

const { ethers } = hre;

export const withGasBuffer = (estimatedGas: BigNumber): BigNumber => {
  return estimatedGas.mul(120).div(100);
};

export const SUPPORTED_NETWORKS = ["baseSepolia", "base"];
export const getDepositExecutionFee = async (dataStore: Contract): Promise<BigNumber> => {
  const [depositGasLimitBase, feeBaseAmount, feeMultiplier, feePerOraclePrice] = await Promise.all([
    dataStore.getUint(DEPOSIT_GAS_LIMIT),
    dataStore.getUint(ESTIMATED_GAS_FEE_BASE_AMOUNT_V2_1),
    dataStore.getUint(ESTIMATED_GAS_FEE_MULTIPLIER_FACTOR),
    dataStore.getUint(ESTIMATED_GAS_FEE_PER_ORACLE_PRICE),
  ]);

  const oraclePriceCount = bigNumberify(3);
  const adjustedGasLimit = feeBaseAmount
    .add(applyFactor(depositGasLimitBase, feeMultiplier))
    .add(oraclePriceCount.mul(feePerOraclePrice));
  const feeData = await ethers.provider.getFeeData();
  const effectiveGasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? expandDecimals(1, 9);
  return adjustedGasLimit.mul(effectiveGasPrice);
};

export const getGlvDepositExecutionFee = async (marketCount: number, dataStore: Contract): Promise<BigNumber> => {
  const [
    glvDepositGasLimitBase,
    glvPerMarketGasLimit,
    depositGasLimitBase,
    feeBaseAmount,
    feeMultiplier,
    feePerOraclePrice,
  ] = await Promise.all([
    dataStore.getUint(GLV_DEPOSIT_GAS_LIMIT),
    dataStore.getUint(GLV_PER_MARKET_GAS_LIMIT),
    dataStore.getUint(DEPOSIT_GAS_LIMIT),
    dataStore.getUint(ESTIMATED_GAS_FEE_BASE_AMOUNT_V2_1),
    dataStore.getUint(ESTIMATED_GAS_FEE_MULTIPLIER_FACTOR),
    dataStore.getUint(ESTIMATED_GAS_FEE_PER_ORACLE_PRICE),
  ]);

  const gasLimit = glvDepositGasLimitBase.add(glvPerMarketGasLimit.mul(marketCount)).add(depositGasLimitBase);
  const oraclePriceCount = bigNumberify(2 + marketCount);
  const adjustedGasLimit = feeBaseAmount
    .add(applyFactor(gasLimit, feeMultiplier))
    .add(oraclePriceCount.mul(feePerOraclePrice));
  const feeData = await ethers.provider.getFeeData();
  const effectiveGasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? expandDecimals(1, 9);
  return adjustedGasLimit.mul(effectiveGasPrice);
};

export const ensureWntBalance = async (wnt: WNT, wallet: Wallet, executionFee: BigNumber) => {
  const wntBalance = await wnt.balanceOf(wallet.address);
  const ethBalance = await ethers.provider.getBalance(wallet.address);
  console.log("executionFee %s", formatAmount(executionFee, 18, 6));
  console.log("WNT balance %s", formatAmount(wntBalance, 18, 6));
  console.log("ETH balance %s", formatAmount(ethBalance, 18, 6));

  if (wntBalance.lt(executionFee)) {
    if (ethBalance.gte(executionFee)) {
      console.log("Wrapping ETH to WNT...");
      await wnt.deposit({ value: executionFee });
    } else {
      throw new Error(`Insufficient WNT and ETH balance. Need ${executionFee.toString()} WNT (or ETH to wrap)`);
    }
  }
};

export const ensureWntAllowance = async (wnt: WNT, wallet: Wallet, router: Contract, amount: BigNumber) => {
  const wntAllowance = await wnt.allowance(wallet.address, router.address);
  console.log("WNT allowance %s", wntAllowance.toString());
  if (wntAllowance.lt(amount)) {
    console.log("approving WNT");
    await wnt.approve(router.address, bigNumberify(2).pow(256).sub(1));
  }
};

export const ensureCollateralTokenAllowance = async (
  collateralToken: MintableToken,
  wallet: Wallet,
  router: Contract,
  totalCollateralTokenNeeded: BigNumber
) => {
  const collateralTokenAllowance = await collateralToken.allowance(wallet.address, router.address);
  console.log("Collateral token address %s", collateralToken.address);
  console.log("Collateral token allowance %s", collateralTokenAllowance.toString());

  if (collateralTokenAllowance.lt(totalCollateralTokenNeeded)) {
    console.log("approving collateral token");
    await collateralToken.approve(router.address, bigNumberify(2).pow(256).sub(1));
  }
};

export const verifyCollateralTokenBalance = async (
  collateralToken: MintableToken,
  wallet: Wallet,
  totalCollateralTokenNeeded: BigNumber
) => {
  const collateralBalance = await collateralToken.balanceOf(wallet.address);
  // On Base Sepolia, USDC is a real token, not mintable
  if (collateralBalance.lt(totalCollateralTokenNeeded)) {
    throw new Error(
      `Insufficient total collateral balance. Need ${totalCollateralTokenNeeded.toString()}, have ${collateralBalance.toString()}. `
    );
  }
};
