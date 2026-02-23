import hre from "hardhat";
import { Signer } from "ethers";

import { getMarketTokenAddress, DEFAULT_MARKET_TYPE } from "../utils/market";
import { bigNumberify, expandDecimals } from "../utils/math";

import { WNT, ExchangeRouter, MintableToken } from "../typechain-types";
import { IDepositUtils } from "../typechain-types/contracts/exchange/DepositHandler";

const { ethers } = hre;

/**
 * Create a deposit into a Nivo FX market (GBP/USDC). Uses the WALLET_TESTER_PRIVATE_KEY.
 *
 * npx hardhat run scripts/createDepositNivoMarket.ts --network baseSepolia
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
  if (hre.network.name === "baseSepolia") {
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
  if (!walletTesterPrivateKey) {
    throw new Error("WALLET_TESTER_PRIVATE_KEY is not set");
  }
  const wallet = new ethers.Wallet(walletTesterPrivateKey, ethers.provider);

  const marketFactory = await ethers.getContract("MarketFactory");
  const roleStore = await ethers.getContract("RoleStore");
  const dataStore = await ethers.getContract("DataStore");
  const depositVault = await ethers.getContract("DepositVault");
  const exchangeRouter: ExchangeRouter = await ethers.getContract("ExchangeRouter");
  const router = await ethers.getContract("Router");

  const { wnt, syntheticFx, collateralToken } = await getValues("GBP", "USDC", wallet);

  const executionFee = expandDecimals(6, 15); // 0.006 ETH (min is ~0.0051 ETH)
  const wntBalance = await wnt.balanceOf(wallet.address);
  const ethBalance = await ethers.provider.getBalance(wallet.address);
  console.log("WNT balance %s", wntBalance.toString());
  console.log("ETH balance %s", ethBalance.toString());

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
  const longTokenAmount = expandDecimals(5, 6); // 5 USDC
  const shortTokenAmount = expandDecimals(5, 6); // 5 USDC

  const collateralTokenAllowance = await collateralToken.allowance(wallet.address, router.address);
  console.log("Collateral token address %s", collateralToken.address);
  console.log("Collateral token allowance %s", collateralTokenAllowance.toString());

  const totalCollateralTokenNeeded = longTokenAmount.add(shortTokenAmount);
  if (collateralTokenAllowance.lt(totalCollateralTokenNeeded)) {
    console.log("approving collateral token");
    await collateralToken.approve(router.address, bigNumberify(2).pow(256).sub(1));
  }
  const collateralBalance = await collateralToken.balanceOf(wallet.address);
  console.log("Collateral token balance %s", collateralBalance.toString());

  // On Base Sepolia, USDC is a real token, not mintable
  if (collateralBalance.lt(totalCollateralTokenNeeded)) {
    throw new Error(
      `Insufficient collateral balance. Need ${totalCollateralTokenNeeded.toString()} (${longTokenAmount.toString()} long + ${shortTokenAmount.toString()} short), have ${collateralBalance.toString()}. `
    );
  }

  // For Nivo FX markets: indexToken = FX currency (BRL), longToken = USDC, shortToken = USDC
  const syntheticMarketAddress = await getMarketTokenAddress(
    syntheticFx.address,
    collateralToken.address,
    collateralToken.address,
    DEFAULT_MARKET_TYPE,
    marketFactory.address,
    roleStore.address,
    dataStore.address
  );
  console.log("market %s", syntheticMarketAddress);

  const params: IDepositUtils.CreateDepositParamsStruct = {
    addresses: {
      receiver: wallet.address,
      callbackContract: ethers.constants.AddressZero,
      uiFeeReceiver: ethers.constants.AddressZero,
      market: syntheticMarketAddress,
      initialLongToken: collateralToken.address,
      initialShortToken: collateralToken.address,
      longTokenSwapPath: [],
      shortTokenSwapPath: [],
    },
    minMarketTokens: 0,
    shouldUnwrapNativeToken: false,
    executionFee: executionFee,
    callbackGasLimit: 0,
    dataList: [],
  };
  console.log("exchange router %s", exchangeRouter.address);
  console.log("deposit vault %s", depositVault.address);
  console.log("creating deposit %s", JSON.stringify(params));

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

  const tx = await exchangeRouter.connect(wallet).multicall(multicallArgs, {
    value: executionFee,
    gasLimit: 2500000,
  });

  console.log("transaction sent", tx.hash);
  const receipt = await tx.wait();
  console.log("receipt received, block:", receipt.blockNumber);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });
