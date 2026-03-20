import { HardhatRuntimeEnvironment } from "hardhat/types";
import { TokenConfig } from "../config/tokens";

import * as keys from "../utils/keys";
import { setBytes32IfDifferent, setUintIfDifferent } from "../utils/dataStore";
import { expandDecimals } from "../utils/math";

const func = async ({ gmx }: HardhatRuntimeEnvironment) => {
  const { getTokens } = gmx;
  const tokens: Record<string, TokenConfig> = await getTokens();

  for (const [tokenSymbol, token] of Object.entries(tokens)) {
    if (!token.dataStreamFeedId) {
      continue;
    }

    if (!token.address) {
      throw new Error(`token ${tokenSymbol} has no address`);
    }

    if (!token.decimals) {
      throw new Error(`token ${tokenSymbol} has no decimals`);
    }

    if (!token.dataStreamFeedDecimals) {
      throw new Error(`token ${tokenSymbol} has no dataStreamFeedDecimals`);
    }

    await setBytes32IfDifferent(
      keys.dataStreamIdKey(token.address),
      token.dataStreamFeedId,
      `data stream feed id for ${tokenSymbol} ${token.address}`
    );

    const dataStreamMultiplier = expandDecimals(1, 60 - token.decimals - token.dataStreamFeedDecimals);
    await setUintIfDifferent(
      keys.dataStreamMultiplierKey(token.address),
      dataStreamMultiplier,
      `data stream feed multiplier for ${tokenSymbol} ${token.address}`
    );
  }
};

func.skip = async (hre: HardhatRuntimeEnvironment) => {
  const deployOnFork = process.env.DEPLOY_ON_FORK === "true";
  const rpcUrl = typeof hre.network.config.url === "string" ? hre.network.config.url : "";
  const usesLocalRpc = rpcUrl.includes("127.0.0.1") || rpcUrl.includes("localhost");

  // On Base fork runs, these DataStore writes may be blocked until
  // full controller/admin wiring has been completed.
  return hre.network.name === "base" && (deployOnFork || usesLocalRpc);
};

func.tags = ["ChainlinkDataStreamFeeds"];
func.dependencies = ["Tokens"];
export default func;
