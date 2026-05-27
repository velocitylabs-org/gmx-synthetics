import hre from "hardhat";

import { encodeData } from "../../../utils/hash";
import * as keys from "../../../utils/keys";
import { getMarketKey, getMarketTokenAddresses } from "../../../utils/market";
import tokensConfig from "../../../config/tokens";
import marketsConfig from "../../../config/markets";
import { getDeployedContract } from "../helpers/getDeployedContract";
import { getConfigKeeperRoleSigner } from "../helpers/getConfigKeeperRoleSigner";
import { getConfigHre, getIsDisabled, getWriteMode, runConfigScript } from "../configRuntime";

const DEFAULT_INACTIVE_INDEX_TOKENS = ["IDR", "PHP", "PEN", "NGN", "KES", "ZAR", "THB"];

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

export async function runDisableInactiveMarkets() {
  const write = getWriteMode();
  const disableValue = getIsDisabled();
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

  const { configKeeperRoleAddress, configKeeperRoleSigner } = await getConfigKeeperRoleSigner(hre);
  const signedConfig = config.connect(configKeeperRoleSigner);

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

  console.log(`Config keeper role address: ${configKeeperRoleAddress}`);
  console.log(`Disable value: ${disableValue}`);
  console.log(`Selected markets: ${selectedMarkets}`);
  console.log(`Prepared setBool calls: ${multicallWriteParams.length}`);

  await signedConfig.callStatic.multicall(multicallWriteParams);
  console.log("callStatic passed");

  if (!write) {
    console.log("NOTE: executed in read-only mode, no transactions were sent");
    return;
  }

  const tx = await signedConfig.multicall(multicallWriteParams);
  console.log(`tx sent: ${tx.hash}`);
  await tx.wait();
  console.log("tx mined");
}

if (require.main === module) {
  runConfigScript(runDisableInactiveMarkets);
}
