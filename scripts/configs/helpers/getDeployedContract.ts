import fs from "fs";
import path from "path";
import type { Signer } from "ethers";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

export async function getDeployedContract(
  hre: HardhatRuntimeEnvironment,
  contractName: string,
  signer?: Signer
) {
  try {
    if (signer) {
      const contract = await hre.ethers.getContract(contractName);
      return contract.connect(signer);
    }
    return await hre.ethers.getContract(contractName);
  } catch {
    // Fallback for fork networks like `anvil` that may not have per-network deployment files.
    const fallbackPath = path.join(hre.config.paths.root, "deployments", "base", `${contractName}.json`);
    if (!fs.existsSync(fallbackPath)) {
      throw new Error(
        `Could not resolve deployed contract ${contractName}: no hardhat deployment and no fallback at ${fallbackPath}`
      );
    }

    const deployment = JSON.parse(fs.readFileSync(fallbackPath, "utf8"));
    return await hre.ethers.getContractAt(deployment.abi, deployment.address, signer);
  }
}
