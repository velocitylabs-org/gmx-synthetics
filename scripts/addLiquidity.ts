/**
 * Add Liquidity to Forex Markets
 *
 * This script deposits USDT into a forex market to provide liquidity.
 * Liquidity is required before positions can be opened in the market.
 *
 * Usage: npm run local:add-liquidity
 *
 * Environment variables (optional):
 *   MARKET_ADDRESS - Market to deposit into (defaults to BRL/USD)
 *   AMOUNT - Amount of USDT to deposit (defaults to 10,000)
 */
import { deployments, ethers } from "hardhat";

// Markets available for liquidity
const MARKETS = {
  "BRL/USD": "0x763779b6c23e29C02d675eA0cE6CBFf8DCc328e6",
  "COP/USD": "0xFEf866Ed484CbecF5Aff364B30F0e034B37B765A",
  "MXN/USD": "0xc45b0e23458085495F9150883DA72784155178f4",
  "PEN/USD": "0xc7eA3eeDf93070373Fc0C6cbc9C5D2e9a36a965D",
};

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║              ADD LIQUIDITY TO FOREX MARKET                    ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  const [wallet] = await ethers.getSigners();
  console.log("Wallet:", wallet.address);

  // Get contract deployments
  const exchangeRouterDeployment = await deployments.get("ExchangeRouter");
  const depositVaultDeployment = await deployments.get("DepositVault");
  const routerDeployment = await deployments.get("Router");
  const usdtDeployment = await deployments.get("USDT");
  const wethDeployment = await deployments.get("WETH");

  const exchangeRouter = await ethers.getContractAt("ExchangeRouter", exchangeRouterDeployment.address);
  const router = await ethers.getContractAt("Router", routerDeployment.address);
  const usdt = await ethers.getContractAt("MintableToken", usdtDeployment.address);

  console.log("ExchangeRouter:", exchangeRouterDeployment.address);
  console.log("DepositVault:", depositVaultDeployment.address);
  console.log("Router:", routerDeployment.address);
  console.log("USDT:", usdtDeployment.address);
  console.log("WETH:", wethDeployment.address);

  // Configuration
  const marketAddress = process.env.MARKET_ADDRESS || MARKETS["BRL/USD"];
  const depositAmount = process.env.AMOUNT
    ? ethers.utils.parseUnits(process.env.AMOUNT, 6)
    : ethers.utils.parseUnits("1000000", 6); // 1,000,000 USDT default (reasonable test amount)
  const executionFee = ethers.utils.parseEther("0.01"); // 0.01 ETH

  // Find market name
  const marketName =
    Object.entries(MARKETS).find(([_, addr]) => addr.toLowerCase() === marketAddress.toLowerCase())?.[0] || "Unknown";

  console.log("\n=== Deposit Configuration ===\n");
  console.log("Market:", marketName, `(${marketAddress})`);
  console.log("Deposit Amount:", ethers.utils.formatUnits(depositAmount, 6), "USDT");
  console.log("Execution Fee:", ethers.utils.formatEther(executionFee), "ETH");

  // Check USDT balance
  const usdtBalance = await usdt.balanceOf(wallet.address);
  console.log("\nUSDT Balance:", ethers.utils.formatUnits(usdtBalance, 6));

  if (usdtBalance.lt(depositAmount)) {
    console.log("\n⚠️  Insufficient USDT balance. Minting...");
    const mintTx = await usdt.mint(wallet.address, depositAmount);
    await mintTx.wait();
    console.log("✅ Minted", ethers.utils.formatUnits(depositAmount, 6), "USDT");
  }

  // Check ETH balance for execution fee
  const ethBalance = await wallet.getBalance();
  console.log("ETH Balance:", ethers.utils.formatEther(ethBalance));

  if (ethBalance.lt(executionFee)) {
    throw new Error("Insufficient ETH for execution fee");
  }

  // Step 1: Approve Router to spend USDT
  console.log("\n=== Step 1: Approve Router ===\n");

  const currentAllowance = await usdt.allowance(wallet.address, router.address);
  if (currentAllowance.lt(depositAmount)) {
    console.log("Approving Router to spend USDT...");
    const approveTx = await usdt.approve(router.address, ethers.constants.MaxUint256);
    await approveTx.wait();
    console.log("✅ Router approved");
  } else {
    console.log("✅ Router already approved");
  }

  // Step 2: Create deposit using multicall
  console.log("\n=== Step 2: Create Deposit ===\n");

  const depositParams = {
    addresses: {
      receiver: wallet.address,
      callbackContract: ethers.constants.AddressZero,
      uiFeeReceiver: ethers.constants.AddressZero,
      market: marketAddress,
      initialLongToken: usdtDeployment.address,
      initialShortToken: usdtDeployment.address, // Same token for forex markets
      longTokenSwapPath: [],
      shortTokenSwapPath: [],
    },
    minMarketTokens: 0,
    shouldUnwrapNativeToken: false,
    executionFee: executionFee,
    callbackGasLimit: 0,
    dataList: [],
  };

  console.log("Deposit params:", JSON.stringify(depositParams, null, 2));

  // Build multicall args
  const multicallArgs = [
    // Send execution fee (WNT) to DepositVault
    exchangeRouter.interface.encodeFunctionData("sendWnt", [depositVaultDeployment.address, executionFee]),
    // Send USDT (long token) to DepositVault
    exchangeRouter.interface.encodeFunctionData("sendTokens", [
      usdtDeployment.address,
      depositVaultDeployment.address,
      depositAmount,
    ]),
    // Create deposit
    exchangeRouter.interface.encodeFunctionData("createDeposit", [depositParams]),
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

  // Parse deposit key from events
  const _depositCreatedEvent = receipt.events?.find(
    (e: any) => e.event === "DepositCreated" || e.topics?.[0]?.includes("DepositCreated")
  );

  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║              DEPOSIT CREATED SUCCESSFULLY!                    ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  console.log("Next steps:");
  console.log("1. Run: npm run local:execute-deposits");
  console.log("2. This will execute the deposit and mint market tokens to your wallet");
  console.log("\nAvailable markets:");
  Object.entries(MARKETS).forEach(([name, addr]) => {
    console.log(`  ${name}: ${addr}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
