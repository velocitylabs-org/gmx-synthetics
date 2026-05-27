import type { HardhatRuntimeEnvironment } from "hardhat/types";
import tokensConfig from "../../config/tokens";

export function isTruthy(value?: string): boolean {
  return value === "true";
}

export function getConfigHre(sourceHre: HardhatRuntimeEnvironment): HardhatRuntimeEnvironment {
  if (!["anvil", "localhost"].includes(sourceHre.network.name)) {
    return sourceHre;
  }

  // On local fork RPCs we still want Base market/token config resolution,
  // since these scripts operate on forked Base state rather than local defaults.
  const patchedHre = {
    ...sourceHre,
    network: {
      ...sourceHre.network,
      name: "base",
      live: true,
      config: sourceHre.config.networks.base,
    },
  } as HardhatRuntimeEnvironment;

  patchedHre.gmx = {
    ...sourceHre.gmx,
    getTokens: async () => tokensConfig(patchedHre),
  };

  return patchedHre;
}

export function getWriteMode(): boolean {
  return isTruthy(process.env.WRITE);
}

/**
 * Check whether the env var `IS_DISABLED` is set to True.
 * True -> It is (to be) disabled
 * False or Undefined -> Not (to be) disabled
 *
 * @returns True If it is specifically set to True, false otherwise.
 */
export function getIsDisabled(): boolean {
  return isTruthy(process.env.IS_DISABLED);
}

export function getFailOnMismatch(): boolean {
  return isTruthy(process.env.FAIL_ON_MISMATCH);
}

export function runConfigScript(fn: () => Promise<void>): void {
  fn()
    .then(() => process.exit(0))
    .catch((ex) => {
      console.error(ex);
      process.exit(1);
    });
}
