import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "ethers";
import { getDeployedContract } from "./getDeployedContract";

const DEFAULT_BASE_CONFIG_KEEPER = "0xAed31d3C8942B38eec87Fe5830a671C1A3D0d967";

function isLocalForkNetwork(hre: HardhatRuntimeEnvironment): boolean {
  return ["anvil", "localhost", "hardhat"].includes(hre.network.name);
}

async function tryRpc(hre: HardhatRuntimeEnvironment, method: string, params: any[]) {
  await hre.network.provider.request({ method, params });
}

async function impersonateIfNeeded(hre: HardhatRuntimeEnvironment, address: string) {
  if (!isLocalForkNetwork(hre)) {
    return;
  }

  try {
    await tryRpc(hre, "hardhat_impersonateAccount", [address]);
  } catch {
    await tryRpc(hre, "anvil_impersonateAccount", [address]);
  }

  try {
    await tryRpc(hre, "hardhat_setBalance", [address, "0x56BC75E2D63100000"]); // 100 ETH
  } catch {
    await tryRpc(hre, "anvil_setBalance", [address, "0x56BC75E2D63100000"]);
  }
}

async function resolveConfigKeeperRoleAddress(hre: HardhatRuntimeEnvironment): Promise<string> {
  if (process.env.CONFIG_KEEPER) {
    return process.env.CONFIG_KEEPER;
  }

  if (isLocalForkNetwork(hre)) {
    return DEFAULT_BASE_CONFIG_KEEPER;
  }

  throw new Error(
    "Unable to resolve CONFIG_KEEPER. Set CONFIG_KEEPER env var or ensure a CONFIG_KEEPER signer is loaded."
  );
}

export async function getConfigKeeperRoleSigner(hre: HardhatRuntimeEnvironment) {
  const roleStore = await getDeployedContract(hre, "RoleStore");
  const configKeeperRoleKey = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(["string"], ["CONFIG_KEEPER"])
  );
  const signers = await hre.ethers.getSigners();

  if (!process.env.CONFIG_KEEPER && !isLocalForkNetwork(hre)) {
    const signerWithRole = (
      await Promise.all(
        signers.map(async (signer) => {
          const hasRole = await roleStore.hasRole(signer.address, configKeeperRoleKey);
          return hasRole ? signer : undefined;
        })
      )
    ).find(Boolean);

    if (signerWithRole) {
      return { configKeeperRoleAddress: signerWithRole.address, configKeeperRoleSigner: signerWithRole };
    }

    throw new Error(
      "None of the loaded signers has CONFIG_KEEPER on-chain. Set CONFIG_KEEPER and load matching private key."
    );
  }

  const configKeeperRoleAddress = await resolveConfigKeeperRoleAddress(hre);
  const directSigner = signers.find((signer) => signer.address.toLowerCase() === configKeeperRoleAddress.toLowerCase());

  if (directSigner) {
    const hasConfigKeeperRole = await roleStore.hasRole(directSigner.address, configKeeperRoleKey);
    if (!hasConfigKeeperRole) {
      throw new Error(
        `Loaded signer ${directSigner.address} does not have CONFIG_KEEPER on-chain. ` +
          `Use a wallet with full CONFIG_KEEPER or set CONFIG_KEEPER and load the matching private key.`
      );
    }
    return { configKeeperRoleAddress, configKeeperRoleSigner: directSigner };
  }

  await impersonateIfNeeded(hre, configKeeperRoleAddress);
  const configKeeperRoleSigner = await hre.ethers.getSigner(configKeeperRoleAddress);

  if (!isLocalForkNetwork(hre)) {
    throw new Error(
      `No signer available for CONFIG_KEEPER ${configKeeperRoleAddress}. Ensure the keeper key is loaded in your network account config.`
    );
  }

  const hasConfigKeeperRole = await roleStore.hasRole(configKeeperRoleSigner.address, configKeeperRoleKey);

  if (!hasConfigKeeperRole) {
    throw new Error(
      `Selected signer ${configKeeperRoleSigner.address} is not CONFIG_KEEPER on-chain. ` +
        `Set CONFIG_KEEPER to a full CONFIG_KEEPER address and run with the matching private key loaded.`
    );
  }

  return { configKeeperRoleAddress, configKeeperRoleSigner };
}
