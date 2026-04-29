import hre from "hardhat";
import type { HardhatRuntimeEnvironment } from "hardhat/types";

import { encodeData } from "../../utils/hash";
import * as keys from "../../utils/keys";
import { getMarketKey, getMarketTokenAddresses } from "../../utils/market";
import tokensConfig from "../../config/tokens";
import marketsConfig from "../../config/markets";
import { getDeployedContract } from "./getDeployedContract";
import { getConfigKeeperSigner } from "./getConfigKeeperSigner";

const DEFAULT_INACTIVE_INDEX_TOKENS = ["IDR", "PHP", "PEN", "NGN", "KES", "ZAR", "THB"];

function isTruthy(value?: string): boolean {
  return value === "true";
}

function getConfigHre(sourceHre: HardhatRuntimeEnvironment): HardhatRuntimeEnvironment {
  if (!["anvil", "localhost"].includes(sourceHre.network.name)) {
    return sourceHre;
  }

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

function getInactiveIndexTokens(): Set<string> {
  const override = process.env.INACTIVE_INDEX_TOKENS;
  if (!override) {
    return new Set(DEFAULT_INACTIVE_INDEX_TOKENS);
  }

  return new Set(
    override
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean)
  );
}

export async function runDisableInactiveNivoMarkets() {
  const write = isTruthy(process.env.WRITE);
  const disableValue = process.env.IS_DISABLED === undefined ? true : process.env.IS_DISABLED === "true";
  const inactiveIndexTokens = getInactiveIndexTokens();
  const targetMarketToken = process.env.MARKET?.toLowerCase();

  const config = await getDeployedContract(hre, "Config");
  const dataStore = await getDeployedContract(hre, "DataStore");
  const reader = await getDeployedContract(hre, "Reader");
  const configHre = getConfigHre(hre);
  const tokens = await tokensConfig(configHre);
  const markets = await marketsConfig(configHre);
  const onchainMarkets = await reader.getMarkets(dataStore.address, 0, 1000);
  const onchainMarketsByTokens = Object.fromEntries(
    onchainMarkets.map((market) => {
      const marketKey = getMarketKey(market.indexToken, market.longToken, market.shortToken);
      return [marketKey, market];
    })
  );

  const { configKeeperAddress, configKeeperSigner } = await getConfigKeeperSigner(hre);
  const configAsKeeper = config.connect(configKeeperSigner);

  const multicallWriteParams: string[] = [];
  let selectedMarkets = 0;

  for (const market of markets) {
    const indexTokenSymbol = market.tokens.indexToken;
    const longTokenSymbol = market.tokens.longToken;
    const shortTokenSymbol = market.tokens.shortToken;

    if (!indexTokenSymbol || !inactiveIndexTokens.has(indexTokenSymbol.toUpperCase())) {
      continue;
    }

    const [indexToken, longToken, shortToken] = getMarketTokenAddresses(market, tokens);
    const marketKey = getMarketKey(indexToken, longToken, shortToken);
    const onchainMarket = onchainMarketsByTokens[marketKey];
    if (!onchainMarket) {
      continue;
    }

    const marketToken = onchainMarket.marketToken;
    if (targetMarketToken && marketToken.toLowerCase() !== targetMarketToken) {
      continue;
    }

    selectedMarkets++;

    const label = `${indexTokenSymbol} [${longTokenSymbol}-${shortTokenSymbol}] (${marketToken})`;
    console.log(`Preparing market disabled update for ${label}`);

    multicallWriteParams.push(
      config.interface.encodeFunctionData("setBool", [
        keys.IS_MARKET_DISABLED,
        encodeData(["address"], [marketToken]),
        disableValue,
      ])
    );
  }

  if (selectedMarkets === 0) {
    throw new Error("No markets matched selection for inactive market updates");
  }

  console.log(`ConfigKeeper: ${configKeeperAddress}`);
  console.log(`Disable value: ${disableValue}`);
  console.log(`Selected markets: ${selectedMarkets}`);
  console.log(`Prepared setBool calls: ${multicallWriteParams.length}`);

  await configAsKeeper.callStatic.multicall(multicallWriteParams);
  console.log("callStatic passed");

  if (!write) {
    console.log("NOTE: executed in read-only mode, no transactions were sent");
    return;
  }

  const tx = await configAsKeeper.multicall(multicallWriteParams);
  console.log(`tx sent: ${tx.hash}`);
  await tx.wait();
  console.log("tx mined");
}

async function main() {
  await runDisableInactiveNivoMarkets();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((ex) => {
      console.error(ex);
      process.exit(1);
    });
}
