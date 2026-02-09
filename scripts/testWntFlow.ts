/**
 * Test WNT deposit and transfer flow
 */
import { deployments, ethers } from "hardhat";

async function main() {
  console.log("=== Testing WNT Flow ===\n");

  const [signer] = await ethers.getSigners();
  const wntAddress = "0x0165878A594ca255338adfa4d48449f69242Eb8F";
  const orderVaultAddress = "0x4c5859f0F772848b2D91F1D83E2Fe57935348029";
  const exchangeRouterAddress = "0xd6e1afe5cA8D00A2EFC01B89997abE2De47fdfAf";

  const wnt = await ethers.getContractAt("WNT", wntAddress);
  const exchangeRouter = await ethers.getContractAt("ExchangeRouter", exchangeRouterAddress);

  // Test 1: Direct WNT deposit
  console.log("Test 1: Direct WNT deposit...");
  try {
    const tx1 = await wnt.deposit({ value: ethers.utils.parseEther("0.001") });
    await tx1.wait();
    console.log("✅ Direct deposit works");
  } catch (e: any) {
    console.log("❌ Direct deposit failed:", e.message?.slice(0, 100));
  }

  // Test 2: Direct WNT transfer to OrderVault
  console.log("\nTest 2: Direct WNT transfer to OrderVault...");
  try {
    const balance = await wnt.balanceOf(signer.address);
    console.log("WNT balance:", ethers.utils.formatEther(balance));

    const tx2 = await wnt.transfer(orderVaultAddress, ethers.utils.parseEther("0.001"));
    await tx2.wait();
    console.log("✅ Direct transfer works");
  } catch (e: any) {
    console.log("❌ Direct transfer failed:", e.message?.slice(0, 100));
  }

  // Test 3: Check if ExchangeRouter has the right ABI
  console.log("\nTest 3: Checking ExchangeRouter functions...");
  console.log("sendWnt function exists:", typeof exchangeRouter.sendWnt === "function");
  console.log("sendTokens function exists:", typeof exchangeRouter.sendTokens === "function");

  // Test 4: Try sendWnt with a small amount
  console.log("\nTest 4: Calling ExchangeRouter.sendWnt...");
  try {
    // First check if ExchangeRouter can receive ETH
    const erCode = await ethers.provider.getCode(exchangeRouterAddress);
    console.log("ExchangeRouter code length:", erCode.length);

    // Try with explicit gas limit
    const tx4 = await exchangeRouter.sendWnt(orderVaultAddress, ethers.utils.parseEther("0.001"), {
      value: ethers.utils.parseEther("0.001"),
      gasLimit: 1000000,
    });
    await tx4.wait();
    console.log("✅ sendWnt works!");
  } catch (e: any) {
    console.log("❌ sendWnt failed:", e.reason || e.message?.slice(0, 200));

    // Try to understand where it fails
    console.log("\nDebugging...");

    // Check DataStore WNT address
    const dataStore = await ethers.getContractAt("DataStore", (await deployments.get("DataStore")).address);
    const WNT = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("WNT"));
    const storedWnt = await dataStore.getAddress(WNT);
    console.log("DataStore WNT address:", storedWnt);
    console.log("Expected WNT:", wntAddress);
    console.log("Match:", storedWnt.toLowerCase() === wntAddress.toLowerCase());
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
