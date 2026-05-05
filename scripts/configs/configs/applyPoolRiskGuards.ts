import hre from "hardhat";
import { BigNumber } from "ethers";

import { encodeData } from "../../../utils/hash";
import * as keys from "../../../utils/keys";
import { getMarketKey, getMarketTokenAddresses } from "../../../utils/market";
import tokensConfig from "../../../config/tokens";
import marketsConfig from "../../../config/markets";
import { getDeployedContract } from "../helpers/getDeployedContract";
import { getConfigKeeperSigner } from "../helpers/getConfigKeeperSigner";
import { getConfigHre, isTruthy } from "../helpers/configRuntime";

type MarketPolicy = {
  minMarketTokensForFirstDeposit: string;
};

const DEFAULT_TARGET_INDEX_TOKENS = ["JPY", "GBP", "BRL", "MXN", "COP"];
const DEFAULT_INACTIVE_INDEX_TOKENS = ["IDR", "PHP", "PEN", "NGN", "KES", "ZAR", "THB"];
const DEFAULT_MIN_FIRST_DEPOSIT = "1000000000000000000";
const MARKET_POLICY_BY_INDEX_SYMBOL: Record<string, MarketPolicy> = {};

function getTargetIndexTokens(): Set<string> {
  const override = process.env.TARGET_INDEX_TOKENS;
  if (!override) {
    return new Set(DEFAULT_TARGET_INDEX_TOKENS);
  }

  return new Set(
    override
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean)
  );
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

function getMarketPolicy(indexTokenSymbol: string): MarketPolicy {
  const defaultMin = process.env.DEFAULT_MIN_FIRST_DEPOSIT ?? DEFAULT_MIN_FIRST_DEPOSIT;
  return (
    MARKET_POLICY_BY_INDEX_SYMBOL[indexTokenSymbol] ?? {
      minMarketTokensForFirstDeposit: defaultMin,
    }
  );
}

export async function runApplyPoolRiskGuards() {
  const write = isTruthy(process.env.WRITE);
  const targetIndexTokens = getTargetIndexTokens();
  const inactiveIndexTokens = getInactiveIndexTokens();
  const disableInactiveMarkets =
    process.env.DISABLE_INACTIVE_MARKETS === undefined ? true : isTruthy(process.env.DISABLE_INACTIVE_MARKETS);
  // IS_DISABLED being `true` means the feature being configured would be disabled.
  // Vice versa, if `IS_DISABLED = false` is passed in, the feature is therefore active/enabled.
  const inactiveDisableValue = process.env.IS_DISABLED === undefined ? true : process.env.IS_DISABLED === "true";
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
  let selectedActiveMarkets = 0;
  let selectedInactiveMarkets = 0;

  for (const market of markets) {
    const indexTokenSymbol = market.tokens.indexToken;
    const longTokenSymbol = market.tokens.longToken;
    const shortTokenSymbol = market.tokens.shortToken;

    if (!indexTokenSymbol) {
      continue;
    }
    const indexTokenUpper = indexTokenSymbol.toUpperCase();

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

    const label = `${indexTokenSymbol} [${longTokenSymbol}-${shortTokenSymbol}] (${marketToken})`;

    if (targetIndexTokens.has(indexTokenUpper)) {
      selectedActiveMarkets++;

      const maxLongPoolAmount = BigNumber.from(market.maxLongTokenPoolAmount ?? 0);
      const maxShortPoolAmount = BigNumber.from(market.maxShortTokenPoolAmount ?? 0);
      const maxLongPoolUsdForDeposit = BigNumber.from(market.maxLongTokenPoolUsdForDeposit ?? 0);
      const maxShortPoolUsdForDeposit = BigNumber.from(market.maxShortTokenPoolUsdForDeposit ?? 0);
      const marketPolicy = getMarketPolicy(indexTokenUpper);
      const minFirstDeposit = BigNumber.from(marketPolicy.minMarketTokensForFirstDeposit);

      console.log(`Preparing pool risk guard updates for ${label}`);

      multicallWriteParams.push(
        config.interface.encodeFunctionData("setUint", [
          keys.MAX_POOL_AMOUNT,
          encodeData(["address", "address"], [marketToken, longToken]),
          maxLongPoolAmount,
        ])
      );
      multicallWriteParams.push(
        config.interface.encodeFunctionData("setUint", [
          keys.MAX_POOL_AMOUNT,
          encodeData(["address", "address"], [marketToken, shortToken]),
          maxShortPoolAmount,
        ])
      );
      multicallWriteParams.push(
        config.interface.encodeFunctionData("setUint", [
          keys.MAX_POOL_USD_FOR_DEPOSIT,
          encodeData(["address", "address"], [marketToken, longToken]),
          maxLongPoolUsdForDeposit,
        ])
      );
      multicallWriteParams.push(
        config.interface.encodeFunctionData("setUint", [
          keys.MAX_POOL_USD_FOR_DEPOSIT,
          encodeData(["address", "address"], [marketToken, shortToken]),
          maxShortPoolUsdForDeposit,
        ])
      );
      multicallWriteParams.push(
        config.interface.encodeFunctionData("setUint", [
          keys.MIN_MARKET_TOKENS_FOR_FIRST_DEPOSIT,
          encodeData(["address"], [marketToken]),
          minFirstDeposit,
        ])
      );
      continue;
    }

    if (disableInactiveMarkets && inactiveIndexTokens.has(indexTokenUpper)) {
      selectedInactiveMarkets++;
      console.log(`Preparing inactive-market disable update for ${label}`);
      multicallWriteParams.push(
        config.interface.encodeFunctionData("setBool", [
          keys.IS_MARKET_DISABLED,
          encodeData(["address"], [marketToken]),
          inactiveDisableValue,
        ])
      );
    }
  }

  if (selectedActiveMarkets === 0 && selectedInactiveMarkets === 0) {
    throw new Error("No markets matched selection for pool risk guard updates");
  }

  console.log(`ConfigKeeper: ${configKeeperAddress}`);
  console.log(`Selected active markets for caps/min: ${selectedActiveMarkets}`);
  console.log(`Selected inactive markets for disable: ${selectedInactiveMarkets}`);
  console.log(`Prepared config calls: ${multicallWriteParams.length}`);

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
  await runApplyPoolRiskGuards();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((ex) => {
      console.error(ex);
      process.exit(1);
    });
}
