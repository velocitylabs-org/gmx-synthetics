import { deployments, ethers } from "hardhat";

/**
 * Manually registers a market token in the DataStore.
 * This is needed when MarketFactory doesn't automatically add to MARKET_LIST.
 */
async function main() {
  console.log("=== Registering Market in DataStore ===\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  // Get contracts
  const dataStoreDeployment = await deployments.get("DataStore");
  const dataStore = await ethers.getContractAt("DataStore", dataStoreDeployment.address);

  // Market token created by MarketFactory
  const marketTokenAddress = "0x25413bA58D07cf34369ae410dd77700F186a48c4";

  // Token addresses
  const wethAddress = (await deployments.get("WETH")).address;
  const usdcAddress = (await deployments.get("USDC")).address;

  console.log("Market Token:", marketTokenAddress);
  console.log("WETH:", wethAddress);
  console.log("USDC:", usdcAddress);

  // 1. Add market to MARKET_LIST
  console.log("\n1. Adding market to MARKET_LIST...");
  const MARKET_LIST_KEY = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MARKET_LIST"));

  try {
    const tx1 = await dataStore.addAddress(MARKET_LIST_KEY, marketTokenAddress);
    await tx1.wait();
    console.log("✅ Added to MARKET_LIST");
  } catch (e: any) {
    console.log("Error:", e.message?.slice(0, 100));
  }

  // 2. Set market tokens (INDEX_TOKEN, LONG_TOKEN, SHORT_TOKEN)
  console.log("\n2. Setting market tokens...");

  // Keys are structured as: keccak256(abi.encode(baseKey, market))
  // INDEX_TOKEN
  const INDEX_TOKEN_BASE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("INDEX_TOKEN"));
  const indexTokenKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [INDEX_TOKEN_BASE, marketTokenAddress])
  );

  // LONG_TOKEN
  const LONG_TOKEN_BASE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("LONG_TOKEN"));
  const longTokenKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [LONG_TOKEN_BASE, marketTokenAddress])
  );

  // SHORT_TOKEN
  const SHORT_TOKEN_BASE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("SHORT_TOKEN"));
  const shortTokenKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [SHORT_TOKEN_BASE, marketTokenAddress])
  );

  try {
    let tx = await dataStore.setAddress(indexTokenKey, wethAddress);
    await tx.wait();
    console.log("✅ Set INDEX_TOKEN to WETH");

    tx = await dataStore.setAddress(longTokenKey, wethAddress);
    await tx.wait();
    console.log("✅ Set LONG_TOKEN to WETH");

    tx = await dataStore.setAddress(shortTokenKey, usdcAddress);
    await tx.wait();
    console.log("✅ Set SHORT_TOKEN to USDC");
  } catch (e: any) {
    console.log("Error setting tokens:", e.message?.slice(0, 200));
  }

  // 3. Set basic market configuration
  console.log("\n3. Setting market configuration...");

  // IS_MARKET_DISABLED - set to false (market is enabled)
  const IS_DISABLED_BASE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("IS_MARKET_DISABLED"));
  const isDisabledKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["bytes32", "address"], [IS_DISABLED_BASE, marketTokenAddress])
  );

  try {
    const tx = await dataStore.setBool(isDisabledKey, false);
    await tx.wait();
    console.log("✅ Market enabled (IS_MARKET_DISABLED = false)");
  } catch (e: any) {
    console.log("Error enabling market:", e.message?.slice(0, 100));
  }

  // 4. Set max open interest
  console.log("\n4. Setting max open interest...");

  // MAX_OPEN_INTEREST (for both long and short)
  // Use keys utility if available, otherwise construct manually
  const MAX_OI_LONG_BASE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("MAX_OPEN_INTEREST"));
  const maxOILongKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "bool"],
      [MAX_OI_LONG_BASE, marketTokenAddress, true] // isLong = true
    )
  );
  const maxOIShortKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32", "address", "bool"],
      [MAX_OI_LONG_BASE, marketTokenAddress, false] // isLong = false
    )
  );

  const maxOI = ethers.utils.parseUnits("1000000", 30); // $1M max OI

  try {
    let tx = await dataStore.setUint(maxOILongKey, maxOI);
    await tx.wait();
    console.log("✅ Set MAX_OPEN_INTEREST (long) = $1M");

    tx = await dataStore.setUint(maxOIShortKey, maxOI);
    await tx.wait();
    console.log("✅ Set MAX_OPEN_INTEREST (short) = $1M");
  } catch (e: any) {
    console.log("Error setting max OI:", e.message?.slice(0, 100));
  }

  // 5. Verify
  console.log("\n=== Verification ===");

  const count = await dataStore.getAddressCount(MARKET_LIST_KEY);
  console.log("Markets in MARKET_LIST:", count.toString());

  const indexToken = await dataStore.getAddress(indexTokenKey);
  console.log("Index Token:", indexToken);

  const longToken = await dataStore.getAddress(longTokenKey);
  console.log("Long Token:", longToken);

  const shortToken = await dataStore.getAddress(shortTokenKey);
  console.log("Short Token:", shortToken);

  console.log("\n=== Market Registration Complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
