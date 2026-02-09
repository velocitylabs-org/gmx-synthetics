/**
 * Check token transfer gas limits
 */
import { deployments, ethers } from "hardhat";

function hashString(value: string): string {
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(value));
}

function hashData(types: string[], values: any[]): string {
  return ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(types, values));
}

async function main() {
  console.log("=== Checking Token Transfer Gas Limits ===\n");

  const dataStore = await ethers.getContractAt("DataStore", (await deployments.get("DataStore")).address);

  const TOKEN_TRANSFER_GAS_LIMIT = hashString("TOKEN_TRANSFER_GAS_LIMIT");

  const tokens = {
    "WETH/WNT": "0x0165878A594ca255338adfa4d48449f69242Eb8F",
    USDT: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    USDC: "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e",
    BRL: "0xf3aa2cd2ED74463405cE698f3e2ad12dd2808f90",
  };

  for (const [name, address] of Object.entries(tokens)) {
    const key = hashData(["bytes32", "address"], [TOKEN_TRANSFER_GAS_LIMIT, address]);
    const gasLimit = await dataStore.getUint(key);
    console.log(`${name} (${address}): ${gasLimit.toString()}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
