/**
 * Remove Liquidity from Forex Markets
 *
 * This script creates a withdrawal to remove liquidity from a forex market.
 * The user burns their market tokens (LP tokens) to receive USDT back.
 *
 * Usage: npm run local:remove-liquidity
 *
 * Environment variables (optional):
 *   MARKET_ADDRESS - Market to withdraw from (defaults to BRL/USD)
 *   AMOUNT - Amount of market tokens to withdraw (defaults to all)
 */
import { deployments, ethers } from "hardhat";

/** Fetch all deployed markets dynamically from the Reader contract */
async function getDeployedMarkets() {
  const dataStoreDeployment = await deployments.get("DataStore");
  const readerDeployment = await deployments.get("Reader");
  const reader = await ethers.getContractAt("Reader", readerDeployment.address);
  const markets = await reader.getMarkets(dataStoreDeployment.address, 0, 100);

  const result: { name: string; marketToken: string; indexToken: string; longToken: string; shortToken: string }[] = [];
  for (const m of markets) {
    let name = m.marketToken;
    try {
      const token = await ethers.getContractAt("MintableToken", m.indexToken);
      const symbol = await token.symbol();
      name = `${symbol}/USD`;
    } catch { /* ignore */ }
    result.push({ name, marketToken: m.marketToken, indexToken: m.indexToken, longToken: m.longToken, shortToken: m.shortToken });
  }
  return result;
}

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║           REMOVE LIQUIDITY FROM FOREX MARKET                  ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  const [wallet] = await ethers.getSigners();
  console.log("Wallet:", wallet.address);

  // Get contract deployments
  const exchangeRouterDeployment = await deployments.get("ExchangeRouter");
  const withdrawalVaultDeployment = await deployments.get("WithdrawalVault");
  const routerDeployment = await deployments.get("Router");
  const usdtDeployment = await deployments.get("USDT");

  const exchangeRouter = await ethers.getContractAt("ExchangeRouter", exchangeRouterDeployment.address);
  const router = await ethers.getContractAt("Router", routerDeployment.address);

  console.log("ExchangeRouter:", exchangeRouterDeployment.address);
  console.log("WithdrawalVault:", withdrawalVaultDeployment.address);
  console.log("Router:", routerDeployment.address);
  console.log("USDT:", usdtDeployment.address);

  // Fetch markets dynamically
  const markets = await getDeployedMarkets();
  if (markets.length === 0) {
    console.log("\nNo markets deployed. Run: npm run local:deploy:markets");
    process.exit(1);
  }

  console.log("\nDeployed markets:");
  for (let i = 0; i < markets.length; i++) {
    console.log(`  [${i}] ${markets[i].name}: ${markets[i].marketToken}`);
  }

  // Select market
  let selectedMarket = markets[0];
  if (process.env.MARKET_ADDRESS) {
    const envAddr = process.env.MARKET_ADDRESS as string;
    const found = markets.find(m => m.marketToken.toLowerCase() === envAddr.toLowerCase());
    if (found) selectedMarket = found;
    else console.log(`\nWARN: MARKET_ADDRESS ${envAddr} not found, using first market`);
  } else if (process.env.MARKET_INDEX) {
    const idx = parseInt(process.env.MARKET_INDEX);
    if (idx >= 0 && idx < markets.length) selectedMarket = markets[idx];
  }

  // Configuration
  const marketAddress = selectedMarket.marketToken;
  const executionFee = ethers.utils.parseEther("0.01"); // 0.01 ETH

  const marketName = selectedMarket.name;

  console.log("\n=== Withdrawal Configuration ===\n");
  console.log("Market:", marketName, `(${marketAddress})`);

  // Get market token (LP token) balance
  const marketToken = await ethers.getContractAt("MarketToken", marketAddress);
  const marketTokenBalance = await marketToken.balanceOf(wallet.address);

  console.log("Market Token Balance:", ethers.utils.formatUnits(marketTokenBalance, 18), "LP tokens");

  if (marketTokenBalance.eq(0)) {
    console.log("\n⚠️  No market tokens to withdraw. You need to add liquidity first.");
    console.log("Run: npm run local:add-liquidity");
    return;
  }

  // Determine withdrawal amount
  let withdrawAmount = marketTokenBalance;
  if (process.env.AMOUNT) {
    withdrawAmount = ethers.utils.parseUnits(process.env.AMOUNT, 18);
    if (withdrawAmount.gt(marketTokenBalance)) {
      console.log("Requested amount exceeds balance. Withdrawing all.");
      withdrawAmount = marketTokenBalance;
    }
  }

  console.log("Withdraw Amount:", ethers.utils.formatUnits(withdrawAmount, 18), "LP tokens");
  console.log("Execution Fee:", ethers.utils.formatEther(executionFee), "ETH");

  // Check ETH balance for execution fee
  const ethBalance = await wallet.getBalance();
  console.log("ETH Balance:", ethers.utils.formatEther(ethBalance));

  if (ethBalance.lt(executionFee)) {
    throw new Error("Insufficient ETH for execution fee");
  }

  // Step 1: Approve Router to spend market tokens
  console.log("\n=== Step 1: Approve Router ===\n");

  const currentAllowance = await marketToken.allowance(wallet.address, router.address);
  if (currentAllowance.lt(withdrawAmount)) {
    console.log("Approving Router to spend market tokens...");
    const approveTx = await marketToken.approve(router.address, ethers.constants.MaxUint256);
    await approveTx.wait();
    console.log("✅ Router approved");
  } else {
    console.log("✅ Router already approved");
  }

  // Step 2: Create withdrawal using multicall
  console.log("\n=== Step 2: Create Withdrawal ===\n");

  const withdrawalParams = {
    addresses: {
      receiver: wallet.address,
      callbackContract: ethers.constants.AddressZero,
      uiFeeReceiver: ethers.constants.AddressZero,
      market: marketAddress,
      longTokenSwapPath: [],
      shortTokenSwapPath: [],
    },
    marketTokenAmount: withdrawAmount,
    minLongTokenAmount: 0, // Accept any amount (no slippage protection for simplicity)
    minShortTokenAmount: 0,
    shouldUnwrapNativeToken: false,
    executionFee: executionFee,
    callbackGasLimit: 0,
    dataList: [],
  };

  console.log(
    "Withdrawal params:",
    JSON.stringify(
      {
        ...withdrawalParams,
        marketTokenAmount: `${ethers.utils.formatUnits(withdrawAmount, 18)} LP`,
      },
      null,
      2
    )
  );

  // Build multicall args
  const multicallArgs = [
    // Send execution fee (WNT) to WithdrawalVault
    exchangeRouter.interface.encodeFunctionData("sendWnt", [withdrawalVaultDeployment.address, executionFee]),
    // Send market tokens to WithdrawalVault
    exchangeRouter.interface.encodeFunctionData("sendTokens", [
      marketAddress,
      withdrawalVaultDeployment.address,
      withdrawAmount,
    ]),
    // Create withdrawal
    exchangeRouter.interface.encodeFunctionData("createWithdrawal", [withdrawalParams]),
  ];

  console.log("Executing multicall...");

  const tx = await exchangeRouter.multicall(multicallArgs, {
    value: executionFee,
    gasLimit: 3000000,
  });

  console.log("Transaction sent:", tx.hash);
  const receipt = await tx.wait();
  console.log("Transaction confirmed!");
  console.log("Gas used:", receipt.gasUsed.toString());

  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║            WITHDRAWAL CREATED SUCCESSFULLY!                   ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  console.log("Next steps:");
  console.log("1. Run: npm run local:execute-withdrawals");
  console.log("2. This will execute the withdrawal and return USDT to your wallet");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
