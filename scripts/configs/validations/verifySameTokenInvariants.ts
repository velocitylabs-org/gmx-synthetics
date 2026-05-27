import hre from "hardhat";
import { BigNumber } from "ethers";

import * as keys from "../../../utils/keys";
import { getMarketKey, getMarketTokenAddresses } from "../../../utils/market";
import tokensConfig from "../../../config/tokens";
import marketsConfig from "../../../config/markets";
import { getDeployedContract } from "../helpers/getDeployedContract";
import { getConfigHre, getFailOnMismatch, runConfigScript } from "../configRuntime";

const ACTIVE_INDEX_TOKENS = ["GBP", "BRL", "MXN", "COP"];
const INACTIVE_INDEX_TOKENS = ["IDR", "PHP", "PEN", "NGN", "KES", "ZAR", "THB"];
const TARGET_INDEX_TOKENS = new Set([...ACTIVE_INDEX_TOKENS, ...INACTIVE_INDEX_TOKENS]);
const ZERO = BigNumber.from(0);

export async function runVerifySameTokenInvariants() {
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
  let checkedMarkets = 0;

  console.log("=== Same-token invariant check (target markets) ===");
  for (const marketConfig of configuredMarkets) {
    const indexSymbol = marketConfig.tokens.indexToken;
    if (!indexSymbol || !TARGET_INDEX_TOKENS.has(indexSymbol.toUpperCase())) continue;

    const [indexToken, longToken, shortToken] = getMarketTokenAddresses(marketConfig, tokens);
    const market = onchainMarketsByTokens[getMarketKey(indexToken, longToken, shortToken)];
    if (!market) continue;

    if (longToken.toLowerCase() !== shortToken.toLowerCase()) {
      mismatches.push(`${indexSymbol}: expected longToken == shortToken, got ${longToken} != ${shortToken}`);
      continue;
    }

    checkedMarkets++;
    const marketToken = market.marketToken;
    const positiveSwapImpact = await dataStore.getUint(keys.swapImpactFactorKey(marketToken, true));
    const negativeSwapImpact = await dataStore.getUint(keys.swapImpactFactorKey(marketToken, false));
    const isMarketDisabled = await dataStore.getBool(keys.isMarketDisabledKey(marketToken));
    const expectedDisabled = INACTIVE_INDEX_TOKENS.includes(indexSymbol.toUpperCase());

    console.log(
      `${indexSymbol} (${marketToken}) positiveSwapImpact=${positiveSwapImpact.toString()} negativeSwapImpact=${negativeSwapImpact.toString()} disabled=${isMarketDisabled}`
    );

    if (!positiveSwapImpact.eq(ZERO)) {
      mismatches.push(`${indexSymbol}: positive swap impact factor must be 0 for same-token market`);
    }
    if (!negativeSwapImpact.eq(ZERO)) {
      mismatches.push(`${indexSymbol}: negative swap impact factor must be 0 for same-token market`);
    }
    if (isMarketDisabled !== expectedDisabled) {
      mismatches.push(
        `${indexSymbol}: IS_MARKET_DISABLED expected=${expectedDisabled} actual=${isMarketDisabled} for same-token market`
      );
    }
  }

  if (checkedMarkets === 0) {
    mismatches.push("No target same-token markets were checked");
  }

  if (mismatches.length > 0) {
    console.log("\n=== MISMATCHES ===");
    mismatches.forEach((m) => console.log(`- ${m}`));
    if (failOnMismatch) {
      throw new Error(`Same-token invariant check failed with ${mismatches.length} mismatches`);
    }
  } else {
    console.log(`\nSame-token invariant check passed for ${checkedMarkets} markets.`);
  }
}

if (require.main === module) {
  runConfigScript(runVerifySameTokenInvariants);
}
