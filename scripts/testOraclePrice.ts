/**
 * Test Oracle Price Provider
 */
import { deployments, ethers } from "hardhat";

async function main() {
  console.log("=== Test Oracle Price ===\n");

  const chainlinkProvider = await ethers.getContractAt(
    "ChainlinkPriceFeedProvider",
    (
      await deployments.get("ChainlinkPriceFeedProvider")
    ).address
  );

  const indexToken = "0xf3aa2cd2ED74463405cE698f3e2ad12dd2808f90";
  const usdt = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

  console.log("Testing ChainlinkPriceFeedProvider.getOraclePrice()...\n");

  try {
    console.log("Index Token:", indexToken);
    const indexPrice = await chainlinkProvider.getOraclePrice(indexToken, "0x");
    console.log("  Price min:", ethers.utils.formatUnits(indexPrice.min, 30));
    console.log("  Price max:", ethers.utils.formatUnits(indexPrice.max, 30));
    console.log("  Timestamp:", indexPrice.timestamp.toString());
    console.log("  Provider:", indexPrice.provider);
  } catch (e: any) {
    console.log("  ERROR:", e.reason || e.message);
  }

  console.log("");

  try {
    console.log("USDT:", usdt);
    const usdtPrice = await chainlinkProvider.getOraclePrice(usdt, "0x");
    console.log("  Price min:", ethers.utils.formatUnits(usdtPrice.min, 30));
    console.log("  Price max:", ethers.utils.formatUnits(usdtPrice.max, 30));
    console.log("  Timestamp:", usdtPrice.timestamp.toString());
    console.log("  Provider:", usdtPrice.provider);
  } catch (e: any) {
    console.log("  ERROR:", e.reason || e.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
