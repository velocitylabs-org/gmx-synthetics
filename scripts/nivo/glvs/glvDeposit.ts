import hre from "hardhat";
import { GlvRouter, MintableToken, WNT } from "../../../typechain-types";
import {
  getGlvDepositExecutionFee,
  ensureWntAllowance,
  ensureWntBalance,
  verifyCollateralTokenBalance,
  ensureCollateralTokenAllowance,
  withGasBuffer,
} from "../utils";
import { bigNumberify, expandDecimals } from "../../../utils/math";
import { minGlvTokensForFirstGlvDepositKey } from "../../../utils/keys";
import { IGlvDepositUtils } from "../../../typechain-types/contracts/exchange/GlvDepositHandler";
import { DEFAULT_MARKET_TYPE, fetchMarketAddress } from "../../../utils/market";

const { ethers, gmx: nivo } = hre;

type GLVReaderInfo = {
  glv: [glvToken: string, longToken: string, shortToken: string];
  markets: [string];
};

// FX_MARKET=BRL npx hardhat run scripts/nivo/glvs/glvDeposit.ts --network base
async function deposit(fx: string) {
  // Use private key from environment variable
  const walletTesterPrivateKey = process.env.WALLET_TESTER_PRIVATE_KEY;
  if (!walletTesterPrivateKey) {
    throw new Error("WALLET_TESTER_PRIVATE_KEY is not set");
  }
  const wallet = new ethers.Wallet(walletTesterPrivateKey, ethers.provider);

  const dataStore = await ethers.getContract("DataStore");
  const glvRouter: GlvRouter = await ethers.getContract("GlvRouter");
  const glvVault = await ethers.getContract("GlvVault");
  const glvReader = await ethers.getContract("GlvReader");
  const router = await ethers.getContract("Router");

  const tokens = await nivo.getTokens();
  if (!tokens[fx]) throw new Error(`Unknown FX token: ${fx}`);
  const { WETH, USDC, [fx]: FX } = tokens;

  const wnt: WNT = await ethers.getContractAt("WNT", WETH.address, wallet);
  const collateralToken: MintableToken = await ethers.getContractAt("MintableToken", USDC.address, wallet);

  const glvsConfig = await nivo.getGlvs();
  const glvConfig = glvsConfig.find((g) => g.symbol === "GLV [USDC-USDC]");
  if (!glvConfig) throw new Error("USDC/USDC GLV config not found");
  if (!glvConfig.address) throw new Error("USDC/USDC GLV address not set in config");
  const glvAddress = glvConfig.address;

  const glvInfo: GLVReaderInfo = await glvReader.getGlvInfo(dataStore.address, glvAddress);
  const glvToken = await ethers.getContractAt("GlvToken", glvAddress, wallet);
  const glvSupply = await glvToken.totalSupply();
  const marketCount = glvInfo.markets.length;
  const targetMarket = await fetchMarketAddress(
    FX.address,
    collateralToken.address,
    collateralToken.address,
    DEFAULT_MARKET_TYPE
  );

  const executionFee = await getGlvDepositExecutionFee(marketCount, dataStore);

  const longTokenAmount = expandDecimals(10, 6); // 10 USDC
  const shortTokenAmount = expandDecimals(10, 6); // 10 USDC
  const totalCollateralTokenNeeded = longTokenAmount.add(shortTokenAmount);

  await ensureWntBalance(wnt, wallet, executionFee);
  await ensureWntAllowance(wnt, wallet, router, executionFee);
  await ensureCollateralTokenAllowance(collateralToken, wallet, router, totalCollateralTokenNeeded);
  await verifyCollateralTokenBalance(collateralToken, wallet, totalCollateralTokenNeeded);

  let receiver = wallet.address;
  let minGlvTokens = bigNumberify(0);

  // First deposit: when GLV token supply is 0, the protocol may require receiver = address(1) and a minimum mint.
  if (glvSupply.isZero()) {
    const requiredMin = await dataStore.getUint(minGlvTokensForFirstGlvDepositKey(glvAddress));
    console.log("requiredMin %s", requiredMin.toString());
    if (requiredMin.gt(0)) {
      const RECEIVER_FOR_FIRST_GLV_DEPOSIT = "0x0000000000000000000000000000000000000001";
      receiver = RECEIVER_FOR_FIRST_GLV_DEPOSIT;
      minGlvTokens = requiredMin;
      console.log("Using first deposit receiver %s and minGlvTokens %s", receiver, minGlvTokens.toString());
    }
  }

  const params: IGlvDepositUtils.CreateGlvDepositParamsStruct = {
    addresses: {
      glv: glvAddress,
      market: targetMarket,
      receiver,
      callbackContract: ethers.constants.AddressZero,
      uiFeeReceiver: ethers.constants.AddressZero,
      initialLongToken: collateralToken.address,
      initialShortToken: collateralToken.address,
      longTokenSwapPath: [],
      shortTokenSwapPath: [],
    },
    minGlvTokens,
    executionFee,
    callbackGasLimit: bigNumberify(0),
    shouldUnwrapNativeToken: false,
    isMarketTokenDeposit: false,
    dataList: [],
  };

  console.log("params", params);

  const multicallArgs = [
    glvRouter.interface.encodeFunctionData("sendWnt", [glvVault.address, executionFee]),
    glvRouter.interface.encodeFunctionData("sendTokens", [collateralToken.address, glvVault.address, longTokenAmount]),
    glvRouter.interface.encodeFunctionData("sendTokens", [collateralToken.address, glvVault.address, shortTokenAmount]),
    glvRouter.interface.encodeFunctionData("createGlvDeposit", [params]),
  ];

  await glvRouter.connect(wallet).callStatic.multicall(multicallArgs, { value: executionFee });

  const estimatedGas = await glvRouter.connect(wallet).estimateGas.multicall(multicallArgs, { value: executionFee });
  const tx = await glvRouter.connect(wallet).multicall(multicallArgs, {
    value: executionFee,
    gasLimit: withGasBuffer(estimatedGas),
  });

  console.log("Transaction sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("Transaction confirmed in block:", receipt.blockNumber);
}

deposit(process.env.FX_MARKET ?? "GBP")
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });
