import hre from "hardhat";
import { ethers } from "ethers";

import * as keys from "../../../utils/keys";
import { getMarketKey, getMarketTokenAddresses } from "../../../utils/market";
import tokensConfig from "../../../config/tokens";
import marketsConfig from "../../../config/markets";
import { getDeployedContract } from "../helpers/getDeployedContract";
import { getConfigHre, getFailOnMismatch, runConfigScript } from "../configRuntime";

const TARGET_INDEX_TOKENS = ["JPY", "GBP", "BRL", "MXN", "COP", "IDR", "PHP", "PEN", "NGN", "KES", "ZAR", "THB"];
const TARGET_INDEX_SET = new Set(TARGET_INDEX_TOKENS);

export async function runVerifyVirtualIdAllowlist() {
  const failOnMismatch = getFailOnMismatch();
  const dataStore = await getDeployedContract(hre, "DataStore");
  const reader = await getDeployedContract(hre, "Reader");
  const configHre = getConfigHre(hre);

  const tokens = await tokensConfig(configHre);
  const configuredMarkets = await marketsConfig(configHre);
  const onchainMarkets = await reader.getMarkets(dataStore.address, 0, 1000);
  const onchainMarketsByTokens = Object.fromEntries(
    onchainMarkets.map((market) => [getMarketKey(market.indexToken, market.longToken, market.shortToken), market])
  );

  const mismatches: string[] = [];
  const allowlistedVirtualTokenIds = new Set<string>();
  const allowlistedVirtualMarketIds = new Set<string>();

  let checkedMarkets = 0;
  console.log("=== Virtual ID allowlist check (target markets) ===");

  for (const marketConfig of configuredMarkets) {
    const indexSymbol = marketConfig.tokens.indexToken;
    if (!indexSymbol || !TARGET_INDEX_SET.has(indexSymbol.toUpperCase())) continue;

    const [indexToken, longToken, shortToken] = getMarketTokenAddresses(marketConfig, tokens);
    const market = onchainMarketsByTokens[getMarketKey(indexToken, longToken, shortToken)];
    if (!market) continue;

    checkedMarkets++;

    const expectedVirtualTokenId = (
      marketConfig.virtualTokenIdForIndexToken ?? ethers.constants.HashZero
    ).toLowerCase();
    const expectedVirtualMarketId = (marketConfig.virtualMarketId ?? ethers.constants.HashZero).toLowerCase();
    allowlistedVirtualTokenIds.add(expectedVirtualTokenId);
    allowlistedVirtualMarketIds.add(expectedVirtualMarketId);

    const actualVirtualTokenId = (await dataStore.getBytes32(keys.virtualTokenIdKey(indexToken))).toLowerCase();
    const actualVirtualMarketId = (
      await dataStore.getBytes32(keys.virtualMarketIdKey(market.marketToken))
    ).toLowerCase();

    console.log(
      `${indexSymbol} (${market.marketToken}) virtualTokenId=${actualVirtualTokenId} virtualMarketId=${actualVirtualMarketId}`
    );

    if (actualVirtualTokenId !== expectedVirtualTokenId) {
      mismatches.push(
        `${indexSymbol}: virtualTokenId mismatch expected=${expectedVirtualTokenId} actual=${actualVirtualTokenId}`
      );
    }
    if (actualVirtualMarketId !== expectedVirtualMarketId) {
      mismatches.push(
        `${indexSymbol}: virtualMarketId mismatch expected=${expectedVirtualMarketId} actual=${actualVirtualMarketId}`
      );
    }
    if (!allowlistedVirtualTokenIds.has(actualVirtualTokenId)) {
      mismatches.push(`${indexSymbol}: virtualTokenId ${actualVirtualTokenId} is outside allowlist`);
    }
    if (!allowlistedVirtualMarketIds.has(actualVirtualMarketId)) {
      mismatches.push(`${indexSymbol}: virtualMarketId ${actualVirtualMarketId} is outside allowlist`);
    }
  }

  if (checkedMarkets === 0) {
    mismatches.push("No target markets were checked for virtual ID policy");
  }

  if (mismatches.length > 0) {
    console.log("\n=== MISMATCHES ===");
    mismatches.forEach((m) => console.log(`- ${m}`));
    if (failOnMismatch) {
      throw new Error(`Virtual ID allowlist check failed with ${mismatches.length} mismatches`);
    }
  } else {
    console.log(`\nVirtual ID allowlist check passed for ${checkedMarkets} markets.`);
  }
}

if (require.main === module) {
  runConfigScript(runVerifyVirtualIdAllowlist);
}
