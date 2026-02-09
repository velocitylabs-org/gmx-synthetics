/**
 * Check key hashes
 */
import { ethers } from "hardhat";

async function main() {
  console.log("=== Checking Key Hashes ===\n");

  // My method (WRONG)
  const myWntKey = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("WNT"));
  console.log("My WNT key (toUtf8Bytes):", myWntKey);

  // Solidity method (CORRECT)
  const solidityWntKey = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["string"], ["WNT"]));
  console.log("Solidity WNT key (abi.encode):", solidityWntKey);

  console.log("\nMatch:", myWntKey === solidityWntKey);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
