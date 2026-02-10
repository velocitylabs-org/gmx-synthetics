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

/** Fetch all deployed markets dynamically from the Reader contract */
async function getDeployedMarkets() {
  const dataStoreDeployment = await deployments.get("DataStore");
  const readerDeployment = await deployments.get("Reader");
  const reader = await ethers.getContractAt("Reader", readerDeployment.address);
  const markets = await reader.getMarkets(dataStoreDeployment.address, 0, 100);

  // Build a name map based on index token symbol
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

  // Select market: use MARKET_ADDRESS env var, MARKET_INDEX env var, or default to first
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
  const depositAmount = process.env.AMOUNT
    ? ethers.utils.parseUnits(process.env.AMOUNT, 6)
    : ethers.utils.parseUnits("1000000", 6); // 1,000,000 USDT default (reasonable test amount)
  const executionFee = ethers.utils.parseEther("0.01"); // 0.01 ETH

  const marketName = selectedMarket.name;

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
    (e: { event?: string; topics?: string[] }) => e.event === "DepositCreated" || e.topics?.[0]?.includes("DepositCreated")
  );

  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║              DEPOSIT CREATED SUCCESSFULLY!                    ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  console.log("Next steps:");
  console.log("1. Run: npm run local:execute-deposits");
  console.log("2. This will execute the deposit and mint market tokens to your wallet");
  console.log("\nAvailable markets:");
  for (let i = 0; i < markets.length; i++) {
    console.log(`  [${i}] ${markets[i].name}: ${markets[i].marketToken}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
