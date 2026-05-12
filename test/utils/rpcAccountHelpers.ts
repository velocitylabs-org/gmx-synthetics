import hre from "hardhat";
import { BigNumberish } from "ethers";

async function tryRpc(method: string, params: unknown[]) {
  return hre.network.provider.request({ method, params });
}

export async function impersonateAccount(address: string) {
  try {
    await tryRpc("hardhat_impersonateAccount", [address]);
  } catch {
    await tryRpc("anvil_impersonateAccount", [address]);
  }
}

export async function stopImpersonatingAccount(address: string) {
  try {
    await tryRpc("hardhat_stopImpersonatingAccount", [address]);
  } catch {
    try {
      await tryRpc("anvil_stopImpersonatingAccount", [address]);
    } catch {
      // ignore if endpoint does not support explicit stop impersonation
    }
  }
}

export async function setBalance(address: string, value: BigNumberish) {
  const hexValue = BigInt(value.toString()).toString(16);
  const prefixedHex = `0x${hexValue}`;

  try {
    await tryRpc("hardhat_setBalance", [address, prefixedHex]);
  } catch {
    await tryRpc("anvil_setBalance", [address, prefixedHex]);
  }
}
