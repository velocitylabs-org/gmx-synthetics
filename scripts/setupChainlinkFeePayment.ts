import hre from "hardhat";
import { ethers } from "hardhat";
import { expandDecimals } from "../utils/math";
import { CHAINLINK_PAYMENT_TOKEN } from "../utils/keys";
import { hashString } from "../utils/hash";

/**
 * Setup script to configure Chainlink fee payment for ChainlinkDataStreamProvider
 *
 * This script:
 * 1. Gets the FeeManager address from the verifier
 * 2. Gets the RewardManager address from the FeeManager
 * 3. Funds the ChainlinkDataStreamProvider contract with LINK tokens
 * 4. Approves the RewardManager to spend LINK tokens on behalf of the contract
 *
 * Usage:
 *   npx hardhat run scripts/setupChainlinkFeePayment.ts --network baseSepolia
 */
async function main() {
  console.log("Network:", hre.network.name);
  console.log("=== Setting up Chainlink Fee Payment ===\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Deployer balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH\n");

  // Get contracts
  const dataStore = await ethers.getContract("DataStore");
  const roleStore = await ethers.getContract("RoleStore");
  const chainlinkDataStreamProvider = await ethers.getContract("ChainlinkDataStreamProvider");
  const verifierAddress = await chainlinkDataStreamProvider.verifier();
  const rewMAddress = await verifierAddress.rewardManager();
  console.log("RewardManager2:", rewMAddress);

  console.log("ChainlinkDataStreamProvider:", chainlinkDataStreamProvider.address);
  console.log("Verifier:", verifierAddress);
  return;
  // Check if deployer has CONTROLLER role (needed to set addresses)
  const CONTROLLER = hashString("CONTROLLER");
  const hasControllerRole = await roleStore.hasRole(deployer.address, CONTROLLER);
  if (!hasControllerRole) {
    console.warn("\n⚠️  WARNING: Deployer does not have CONTROLLER role.");
    console.warn("   Cannot set payment token address. Please use a wallet with CONTROLLER role.");
  }
  console.log("");

  // Get payment token address from DataStore
  const paymentTokenAddress = await dataStore.getAddress(CHAINLINK_PAYMENT_TOKEN);
  console.log("Current Payment Token Address in DataStore:", paymentTokenAddress);

  // Get expected payment token from oracle config
  const oracleConfig = await hre.gmx.getOracle();
  const expectedPaymentToken = oracleConfig.chainlinkPaymentToken;
  console.log("Expected Payment Token from config:", expectedPaymentToken);

  // If payment token is wrong, set it correctly
  if (
    paymentTokenAddress !== expectedPaymentToken &&
    expectedPaymentToken &&
    expectedPaymentToken !== ethers.constants.AddressZero
  ) {
    console.log("\n⚠️  Payment token address is incorrect!");
    console.log("   Setting CHAINLINK_PAYMENT_TOKEN to:", expectedPaymentToken);

    if (!hasControllerRole) {
      throw new Error(
        `Cannot set payment token address: deployer does not have CONTROLLER role. ` +
          `Current: ${paymentTokenAddress}, Expected: ${expectedPaymentToken}`
      );
    }

    // const setTx = await dataStore.setAddress(CHAINLINK_PAYMENT_TOKEN, expectedPaymentToken);
    // await setTx.wait();
    // console.log("   ✓ Payment token updated. Transaction:", setTx.hash);

    // paymentTokenAddress = expectedPaymentToken;
  } else if (paymentTokenAddress === ethers.constants.AddressZero) {
    if (expectedPaymentToken && expectedPaymentToken !== ethers.constants.AddressZero) {
      console.log("\n⚠️  Payment token is set to address(0). Setting it to config value.");

      if (!hasControllerRole) {
        throw new Error(
          `Cannot set payment token address: deployer does not have CONTROLLER role. ` +
            `Current: ${paymentTokenAddress}, Expected: ${expectedPaymentToken}`
        );
      }

      // const setTx = await dataStore.setAddress(CHAINLINK_PAYMENT_TOKEN, expectedPaymentToken);
      // await setTx.wait();
      // console.log("   ✓ Payment token set. Transaction:", setTx.hash);
      // paymentTokenAddress = expectedPaymentToken;
    } else {
      console.log("\n⚠️  Payment token is set to address(0) and config also has address(0).");
      console.log("   Fee payment is disabled. This is OK for networks without FeeManager.");
      return;
    }
  } else {
    console.log("✓ Payment token address is correct");
  }

  console.log("");

  // Get FeeManager from verifier
  const verifierInterface = new ethers.utils.Interface(["function s_feeManager() view returns (address)"]);

  let feeManagerAddress: string;
  try {
    const feeManagerResult = await ethers.provider.call({
      to: verifierAddress,
      data: verifierInterface.encodeFunctionData("s_feeManager", []),
    });
    feeManagerAddress = ethers.utils.defaultAbiCoder.decode(["address"], feeManagerResult)[0];
    console.log("FeeManager Address:", feeManagerAddress);
  } catch (error: any) {
    console.log("⚠️  Could not get FeeManager address. Verifier might not have FeeManager.");
    console.log("   Error:", error.message);
    console.log("   This network might not require fee payment.");
    return;
  }

  if (feeManagerAddress === ethers.constants.AddressZero) {
    console.log("⚠️  FeeManager is address(0). Fee payment might not be required on this network.");
    return;
  }

  // Get RewardManager from FeeManager
  const feeManagerInterface = new ethers.utils.Interface([
    "function i_rewardManager() view returns (address)",
    "function i_linkAddress() view returns (address)",
  ]);

  let rewardManagerAddress: string;
  let linkTokenAddress: string;

  try {
    const rewardManagerResult = await ethers.provider.call({
      to: feeManagerAddress,
      data: feeManagerInterface.encodeFunctionData("i_rewardManager", []),
    });
    rewardManagerAddress = ethers.utils.defaultAbiCoder.decode(["address"], rewardManagerResult)[0];
    console.log("RewardManager Address:", rewardManagerAddress);

    const linkTokenResult = await ethers.provider.call({
      to: feeManagerAddress,
      data: feeManagerInterface.encodeFunctionData("i_linkAddress", []),
    });
    linkTokenAddress = ethers.utils.defaultAbiCoder.decode(["address"], linkTokenResult)[0];
    console.log("LINK Token Address:", linkTokenAddress);
  } catch (error: any) {
    console.log("⚠️  Could not get RewardManager or LINK address from FeeManager.");
    console.log("   Error:", error.message);
    return;
  }

  // Verify payment token matches LINK token
  if (paymentTokenAddress.toLowerCase() !== linkTokenAddress.toLowerCase()) {
    console.log("⚠️  Warning: Payment token address doesn't match LINK token address!");
    console.log("   Payment Token:", paymentTokenAddress);
    console.log("   LINK Token:", linkTokenAddress);
  }

  console.log("");

  // Get LINK token contract
  const linkToken = await ethers.getContractAt(
    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
    linkTokenAddress,
    deployer
  );

  // Check LINK balance of deployer
  const deployerLinkBalance = await linkToken.balanceOf(deployer.address);
  console.log("Deployer LINK Balance:", ethers.utils.formatEther(deployerLinkBalance), "LINK");

  // Check LINK balance of ChainlinkDataStreamProvider
  const providerLinkBalance = await linkToken.balanceOf(chainlinkDataStreamProvider.address);
  console.log("ChainlinkDataStreamProvider LINK Balance:", ethers.utils.formatEther(providerLinkBalance), "LINK");

  // Check current allowance
  const currentAllowance = await linkToken.allowance(chainlinkDataStreamProvider.address, rewardManagerAddress);
  console.log("Current Allowance:", ethers.utils.formatEther(currentAllowance), "LINK");
  console.log("");
  // Determine how much LINK to fund
  const linkAmountToFund = process.env.LINK_AMOUNT
    ? ethers.utils.parseEther(process.env.LINK_AMOUNT)
    : expandDecimals(100, 18); // Default: 100 LINK

  console.log("=== Setup Actions ===");

  // 1. Fund ChainlinkDataStreamProvider with LINK
  // if (providerLinkBalance.lt(linkAmountToFund)) {
  //   const amountNeeded = linkAmountToFund.sub(providerLinkBalance);
  //   console.log(`1. Funding ChainlinkDataStreamProvider with ${ethers.utils.formatEther(amountNeeded)} LINK...`);

  //   if (deployerLinkBalance.lt(amountNeeded)) {
  //     throw new Error(
  //       `Insufficient LINK balance. Need ${ethers.utils.formatEther(amountNeeded)} LINK, ` +
  //       `have ${ethers.utils.formatEther(deployerLinkBalance)} LINK`
  //     );
  //   }

  //   const transferTx = await linkToken.transfer(chainlinkDataStreamProvider.address, amountNeeded);
  //   await transferTx.wait();
  //   console.log("   ✓ Transfer transaction:", transferTx.hash);
  // } else {
  //   console.log("1. ✓ ChainlinkDataStreamProvider already has sufficient LINK balance");
  // }

  // 2. Approve RewardManager to spend LINK
  const approvalAmount = expandDecimals(1000, 18); // Approve 1000 LINK (can be increased later)

  if (currentAllowance.lt(approvalAmount)) {
    console.log(`2. Approving RewardManager to spend ${ethers.utils.formatEther(approvalAmount)} LINK...`);

    // Call approveRewardManager function on ChainlinkDataStreamProvider
    // This requires the oracle address to call it (or we need to add admin access)
    const oracleAddress = await chainlinkDataStreamProvider.oracle();
    console.log("   Oracle address:", oracleAddress);

    // Check if deployer is the oracle
    if (deployer.address.toLowerCase() !== oracleAddress.toLowerCase()) {
      console.log("   ⚠️  Deployer is not the oracle address.");
      console.log("   ⚠️  Need to call approveRewardManager() from the oracle address.");
      console.log("   ⚠️  Or add admin access control to ChainlinkDataStreamProvider.");

      // Try to call it anyway - it will fail if not authorized
      try {
        return;
        // const approveTx = await chainlinkDataStreamProvider.connect(deployer).approveRewardManager(
        //   rewardManagerAddress,
        //   linkTokenAddress,
        //   approvalAmount
        // );
        // await approveTx.wait();
        // console.log("   ✓ Approval transaction:", approveTx.hash);
      } catch (error: any) {
        console.log("   ❌ Failed to approve:", error.message);
        console.log("   ⚠️  You need to call approveRewardManager() from the oracle address.");
      }
    } else {
      console.log("Deployer is the oracle address.");
      return;
      // const approveTx = await chainlinkDataStreamProvider.approveRewardManager(
      //   rewardManagerAddress,
      //   linkTokenAddress,
      //   approvalAmount
      // );
      // await approveTx.wait();
      // console.log("   ✓ Approval transaction:", approveTx.hash);
    }
  } else {
    console.log("2. ✓ RewardManager already has sufficient allowance");
  }

  console.log("\n=== Setup Complete ===");
  console.log("ChainlinkDataStreamProvider is ready to pay fees for report verification.");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });
