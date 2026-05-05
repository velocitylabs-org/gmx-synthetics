import type { HardhatRuntimeEnvironment } from "hardhat/types";
import tokensConfig from "../../../config/tokens";

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
