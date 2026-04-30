import hre from "hardhat";
import type { HardhatRuntimeEnvironment } from "hardhat/types";
import { BigNumber } from "ethers";

import * as keys from "../../utils/keys";
import { OrderType } from "../../utils/order";
import { getMarketKey, getMarketTokenAddresses } from "../../utils/market";
import tokensConfig from "../../config/tokens";
import marketsConfig from "../../config/markets";
import { getDeployedContract } from "./getDeployedContract";

const ACTIVE_INDEX_TOKENS = ["JPY", "GBP", "BRL", "MXN", "COP"];
const INACTIVE_INDEX_TOKENS = ["IDR", "PHP", "PEN", "NGN", "KES", "ZAR", "THB"];
const EXPECTED_MIN_FIRST_DEPOSIT = BigNumber.from("1000000000000000000");
const ORDER_TYPES_TO_VERIFY = [
  OrderType.MarketSwap,
  OrderType.LimitSwap,
  OrderType.StopLossDecrease,
  OrderType.LimitIncrease,
  OrderType.LimitDecrease,
];

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

async function main() {
  const failOnMismatch = process.env.FAIL_ON_MISMATCH === "true";
  const dataStore = await getDeployedContract(hre, "DataStore");
  const orderHandler = await getDeployedContract(hre, "OrderHandler");
  const reader = await getDeployedContract(hre, "Reader");
  const configHre = getConfigHre(hre);
  const tokens = await tokensConfig(configHre);
  const markets = await marketsConfig(configHre);
  const onchainMarkets = await reader.getMarkets(dataStore.address, 0, 1000);
  const onchainMarketsByTokens = Object.fromEntries(
    onchainMarkets.map((market) => [getMarketKey(market.indexToken, market.longToken, market.shortToken), market])
  );

  const mismatches: string[] = [];
  const orderHandlerAddress = orderHandler.address;

  console.log("=== SCRUM225 flags (disabled=true expected) ===");
  for (const orderType of ORDER_TYPES_TO_VERIFY) {
    const createValue = await dataStore.getBool(keys.createOrderFeatureDisabledKey(orderHandlerAddress, orderType));
    const executeValue = await dataStore.getBool(keys.executeOrderFeatureDisabledKey(orderHandlerAddress, orderType));
    console.log(`orderType=${orderType} create=${createValue} execute=${executeValue}`);

    if (!createValue) mismatches.push(`CREATE_ORDER_FEATURE_DISABLED orderType=${orderType} expected=true actual=false`);
    if (!executeValue) {
      mismatches.push(`EXECUTE_ORDER_FEATURE_DISABLED orderType=${orderType} expected=true actual=false`);
    }
  }

  console.log("\n=== SCRUM226 inactive markets (disabled=true expected) ===");
  for (const marketConfig of markets) {
    const indexSymbol = marketConfig.tokens.indexToken;
    if (!indexSymbol || !INACTIVE_INDEX_TOKENS.includes(indexSymbol.toUpperCase())) continue;

    const [indexToken, longToken, shortToken] = getMarketTokenAddresses(marketConfig, tokens);
    const onchain = onchainMarketsByTokens[getMarketKey(indexToken, longToken, shortToken)];
    if (!onchain) continue;

    const marketToken = onchain.marketToken;
    const disabled = await dataStore.getBool(keys.isMarketDisabledKey(marketToken));
    console.log(`${indexSymbol} (${marketToken}) disabled=${disabled}`);
    if (!disabled) mismatches.push(`IS_MARKET_DISABLED ${indexSymbol} expected=true actual=false`);
  }

  console.log("\n=== SCRUM226 active markets min first deposit (1e18 expected) ===");
  for (const marketConfig of markets) {
    const indexSymbol = marketConfig.tokens.indexToken;
    if (!indexSymbol || !ACTIVE_INDEX_TOKENS.includes(indexSymbol.toUpperCase())) continue;

    const [indexToken, longToken, shortToken] = getMarketTokenAddresses(marketConfig, tokens);
    const onchain = onchainMarketsByTokens[getMarketKey(indexToken, longToken, shortToken)];
    if (!onchain) continue;

    const marketToken = onchain.marketToken;
    const minFirstDeposit = await dataStore.getUint(keys.minMarketTokensForFirstDeposit(marketToken));
    console.log(`${indexSymbol} (${marketToken}) minFirstDeposit=${minFirstDeposit.toString()}`);
    if (!minFirstDeposit.eq(EXPECTED_MIN_FIRST_DEPOSIT)) {
      mismatches.push(
        `MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT ${indexSymbol} expected=${EXPECTED_MIN_FIRST_DEPOSIT.toString()} actual=${minFirstDeposit.toString()}`
      );
    }
  }

  if (mismatches.length > 0) {
    console.log("\n=== MISMATCHES ===");
    mismatches.forEach((m) => console.log(`- ${m}`));
    if (failOnMismatch) {
      throw new Error(`Verification failed with ${mismatches.length} mismatches`);
    }
  } else {
    console.log("\nVerification passed: all expected SCRUM225/226 states matched.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });
