import hre from "hardhat";
import { Signer } from "ethers";

import { fetchMarketAddress, DEFAULT_MARKET_TYPE } from "../../utils/market";
import { bigNumberify, expandDecimals, formatAmount } from "../../utils/math";
import { minMarketTokensForFirstDeposit, poolAmountKey } from "../../utils/keys";

import { WNT, ExchangeRouter, MintableToken } from "../../typechain-types";
import { IDepositUtils } from "../../typechain-types/contracts/exchange/DepositHandler";
import { getDepositExecutionFee, SUPPORTED_FX_CURRENCIES, SUPPORTED_NETWORKS, withGasBuffer } from "./utils";

const { ethers } = hre;

/**
 * Create a deposit into a Nivo FX market (FX/USDC). Uses the WALLET_TESTER_PRIVATE_KEY.
 *
 * FX_CURRENCY=BRL npx hardhat run scripts/nivo/depositOrder.ts --network baseSepolia
 
 * By default LG_TOKEN_AMOUNT and ST_TOKEN_AMOUNT are set to 10 USDC
 * FX_CURRENCY=BRL LG_TOKEN_AMOUNT=5 ST_TOKEN_AMOUNT=5 npx hardhat run scripts/nivo/depositOrder.ts --network baseSepolia
 * 
 * Log deposits: npx hardhat run scripts/printDeposits.ts --network baseSepolia
 */
async function getValues(
  fx: string,
  collateralToken: string,
  wallet: Signer
): Promise<{
  wnt: WNT;
  syntheticFx: { address: string };
  collateralToken: MintableToken;
}> {
  const tokens = await hre.gmx.getTokens();

  if (SUPPORTED_NETWORKS.includes(hre.network.name)) {
    if (!tokens[fx] || !tokens[fx].address) {
      throw new Error(`Invalid FX currency: ${fx}`);
    }

    return {
      wnt: await ethers.getContractAt("WNT", tokens.WETH.address, wallet),
      syntheticFx: { address: tokens[fx].address },
      collateralToken: await ethers.getContractAt("MintableToken", tokens[collateralToken].address, wallet),
    };
  }

  throw new Error("unsupported network");
}

async function main() {
  // Use private key from environment variable
  const walletTesterPrivateKey = process.env.WALLET_TESTER_PRIVATE_KEY;
  const lgTokenAmount = process.env.LG_TOKEN_AMOUNT ? Number(process.env.LG_TOKEN_AMOUNT) : 10;
  const stTokenAmount = Number(process.env.ST_TOKEN_AMOUNT || 10);

  const fxCurrency = process.env.FX_CURRENCY;
  if (!walletTesterPrivateKey) {
    throw new Error("WALLET_TESTER_PRIVATE_KEY is not set");
  }
  if (!fxCurrency || !SUPPORTED_FX_CURRENCIES.includes(fxCurrency)) {
    throw new Error("FX_CURRENCY is not set or not supported");
  }
  const wallet = new ethers.Wallet(walletTesterPrivateKey, ethers.provider);

  const dataStore = await ethers.getContract("DataStore");
  const depositVault = await ethers.getContract("DepositVault");
  const exchangeRouter: ExchangeRouter = await ethers.getContract("ExchangeRouter");
  const router = await ethers.getContract("Router");

  const { wnt, syntheticFx, collateralToken } = await getValues(fxCurrency, "USDC", wallet);

  const executionFee = (await getDepositExecutionFee()) ?? expandDecimals(6, 15);
  const wntBalance = await wnt.balanceOf(wallet.address);
  const ethBalance = await ethers.provider.getBalance(wallet.address);
  console.log("WNT balance (ETH): %s", formatAmount(wntBalance, 18, 4, true));
  console.log("ETH balance (ETH): %s", formatAmount(ethBalance, 18, 4, true));

  // If WNT balance is insufficient, try to wrap ETH to WNT
  if (wntBalance.lt(executionFee)) {
    if (ethBalance.gte(executionFee)) {
      console.log("Wrapping ETH to WNT...");
      await wnt.deposit({ value: executionFee });
    } else {
      throw new Error(`Insufficient WNT and ETH balance. Need ${executionFee.toString()} WNT (or ETH to wrap), `);
    }
  }

  const wntAllowance = await wnt.allowance(wallet.address, router.address);
  console.log("WNT address %s symbol %s", wnt.address, await wnt.symbol());
  console.log("WNT allowance %s", wntAllowance.toString());
  if (wntAllowance.lt(executionFee)) {
    console.log("approving WNT");
    await wnt.approve(router.address, bigNumberify(2).pow(256).sub(1));
  }

  // For Nivo FX markets, both longToken and shortToken are the same collateral token (USDC)
  const longTokenAmount = expandDecimals(lgTokenAmount, 6); // Default 10 USDC
  const shortTokenAmount = expandDecimals(stTokenAmount, 6); // Default 10 USDC

  const collateralTokenAllowance = await collateralToken.allowance(wallet.address, router.address);
  console.log("Collateral token address %s", collateralToken.address);
  console.log("Collateral token allowance %s", collateralTokenAllowance.toString());

  const totalCollateralTokenNeeded = longTokenAmount.add(shortTokenAmount);
  if (collateralTokenAllowance.lt(totalCollateralTokenNeeded)) {
    console.log("approving collateral token");
    await collateralToken.approve(router.address, bigNumberify(2).pow(256).sub(1));
  }
  const collateralBalance = await collateralToken.balanceOf(wallet.address);
  console.log("Collateral token balance (USDC): %s", formatAmount(collateralBalance, 6, 2, true));

  // On Base Sepolia, USDC is a real token, not mintable
  if (collateralBalance.lt(totalCollateralTokenNeeded)) {
    throw new Error(
      `Insufficient collateral balance. Need ${totalCollateralTokenNeeded.toString()} (${longTokenAmount.toString()} long + ${shortTokenAmount.toString()} short), have ${collateralBalance.toString()}. `
    );
  }

  // For Nivo FX markets: indexToken = FX currency, longToken = USDC, shortToken = USDC
  const syntheticMarketAddress = await fetchMarketAddress(
    syntheticFx.address,
    collateralToken.address,
    collateralToken.address,
    DEFAULT_MARKET_TYPE
  );
  if (!syntheticMarketAddress || syntheticMarketAddress === ethers.constants.AddressZero) {
    throw new Error(`Market not found in DataStore for ${fxCurrency}/USDC.`);
  }
  console.log("market %s", syntheticMarketAddress);

  const poolAmount = await dataStore.getUint(poolAmountKey(syntheticMarketAddress, collateralToken.address));
  console.log("pool liquidity (USDC): %s", formatAmount(poolAmount, 6, 2, true));

  // First deposit: when market token supply is 0, the protocol may require receiver = address(1) and a minimum mint.
  let receiver = wallet.address;
  let minMarketTokens = bigNumberify(0);
  const marketToken = await ethers.getContractAt("MarketToken", syntheticMarketAddress, wallet);
  const supply = await marketToken.totalSupply();
  if (supply.isZero()) {
    const requiredMin = await dataStore.getUint(minMarketTokensForFirstDeposit(syntheticMarketAddress));
    if (requiredMin.gt(0)) {
      /** Receiver required by the protocol for the first deposit in a market (when minMarketTokensForFirstDeposit > 0). */
      const RECEIVER_FOR_FIRST_DEPOSIT = "0x0000000000000000000000000000000000000001";
      receiver = RECEIVER_FOR_FIRST_DEPOSIT;
      minMarketTokens = requiredMin;
      console.log("Using first deposit receiver %s and minMarketTokens %s", receiver, minMarketTokens.toString());
    }
  }

  const params: IDepositUtils.CreateDepositParamsStruct = {
    addresses: {
      receiver,
      callbackContract: ethers.constants.AddressZero,
      uiFeeReceiver: ethers.constants.AddressZero,
      market: syntheticMarketAddress,
      initialLongToken: collateralToken.address,
      initialShortToken: collateralToken.address,
      longTokenSwapPath: [],
      shortTokenSwapPath: [],
    },
    minMarketTokens,
    shouldUnwrapNativeToken: false,
    executionFee,
    callbackGasLimit: 0,
    dataList: [],
  };

  const multicallArgs = [
    exchangeRouter.interface.encodeFunctionData("sendWnt", [depositVault.address, executionFee]),
    exchangeRouter.interface.encodeFunctionData("sendTokens", [
      collateralToken.address,
      depositVault.address,
      longTokenAmount,
    ]),
    exchangeRouter.interface.encodeFunctionData("sendTokens", [
      collateralToken.address,
      depositVault.address,
      shortTokenAmount,
    ]),
    exchangeRouter.interface.encodeFunctionData("createDeposit", [params]),
  ];
  console.log("multicall args", multicallArgs);

  const estimatedGas = await exchangeRouter
    .connect(wallet)
    .estimateGas.multicall(multicallArgs, { value: executionFee });
  const tx = await exchangeRouter.connect(wallet).multicall(multicallArgs, {
    value: executionFee,
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
