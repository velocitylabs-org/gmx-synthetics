/**
 * Check WNT contract details
 */
import { ethers } from "hardhat";

async function main() {
  console.log("=== Checking WNT Contract ===\n");

  const wethAddress = "0x0165878A594ca255338adfa4d48449f69242Eb8F";

  // Check if there's code at the address
  const code = await ethers.provider.getCode(wethAddress);
  console.log("Code at WETH address:", `${code.slice(0, 100)}...`);
  console.log("Code length:", code.length);

  if (code === "0x") {
    console.log("❌ No contract code at this address!");
    return;
  }

  // Try to get contract as WNT
  try {
    const wnt = await ethers.getContractAt("WNT", wethAddress);
    console.log("\n✅ Contract responds as WNT");

    // Check name/symbol
    try {
      const name = await wnt.name();
      const symbol = await wnt.symbol();
      console.log("Name:", name);
      console.log("Symbol:", symbol);
    } catch (e: any) {
      console.log("Could not get name/symbol:", e.message?.slice(0, 50));
    }

    // Check if deposit exists
    console.log("\nTrying to check deposit function...");
    console.log("deposit function exists:", typeof wnt.deposit === "function");

    // Try to call deposit with 0 ETH just to see if it works
    const [signer] = await ethers.getSigners();
    try {
      const tx = await wnt.deposit({ value: ethers.utils.parseEther("0.001") });
      await tx.wait();
      console.log("✅ deposit() called successfully");

      // Check balance
      const balance = await wnt.balanceOf(signer.address);
      console.log("WNT balance after deposit:", ethers.utils.formatEther(balance));
    } catch (e: any) {
      console.log("❌ deposit() failed:", e.message?.slice(0, 100));
    }
  } catch (e: any) {
    console.log("❌ Failed to get as WNT:", e.message?.slice(0, 100));
  }

  // Try as MintableToken
  try {
    const token = await ethers.getContractAt("MintableToken", wethAddress);
    const name = await token.name();
    const symbol = await token.symbol();
    console.log("\nAs MintableToken:");
    console.log("Name:", name);
    console.log("Symbol:", symbol);
  } catch (e: any) {
    console.log("\nNot a MintableToken:", e.message?.slice(0, 50));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
