import hre from "hardhat";
import { BigNumber } from "ethers";

import * as keys from "../../../utils/keys";
import { getMarketKey, getMarketTokenAddresses, getOnchainMarkets } from "../../../utils/market";

type Mismatch = {
  marketLabel: string;
  marketToken: string;
  field: string;
  expected: string;
  actual: string;
};

function toStr(value: BigNumber): string {
  return value.toString();
}

async function main() {
  const failOnMismatch = process.env.FAIL_ON_MISMATCH === "true";
  const requireNonZeroFirstDeposit = process.env.REQUIRE_NONZERO_FIRST_DEPOSIT === "true";
  const showMatches = process.env.SHOW_MATCHES === "true";

  const { read } = hre.deployments;
  const dataStore = await hre.ethers.getContract("DataStore");
  const markets = await hre.gmx.getMarkets();
  const tokens = await hre.gmx.getTokens();
  const onchainMarketsByTokens = await getOnchainMarkets(read, dataStore.address);

  const mismatches: Mismatch[] = [];
  const minFirstDepositZero: Array<{ marketLabel: string; marketToken: string }> = [];

  let checked = 0;
  let skipped = 0;

  for (const market of markets) {
    const [indexToken, longToken, shortToken] = getMarketTokenAddresses(market, tokens);
    const marketKey = getMarketKey(indexToken, longToken, shortToken);
    const onchainMarket = onchainMarketsByTokens[marketKey];

    if (!onchainMarket) {
      skipped++;
      continue;
    }

    checked++;

    const marketToken = onchainMarket.marketToken;
    const marketLabel = `${market.tokens.indexToken || "SWAP-ONLY"} [${market.tokens.longToken}-${market.tokens.shortToken}]`;

    const expectedMaxLongPoolAmount = BigNumber.from(market.maxLongTokenPoolAmount);
    const expectedMaxShortPoolAmount = BigNumber.from(market.maxShortTokenPoolAmount);
    const expectedMaxLongPoolUsdForDeposit = BigNumber.from(market.maxLongTokenPoolUsdForDeposit ?? 0);
    const expectedMaxShortPoolUsdForDeposit = BigNumber.from(market.maxShortTokenPoolUsdForDeposit ?? 0);

    const actualMaxLongPoolAmount = await dataStore.getUint(keys.maxPoolAmountKey(marketToken, longToken));
    const actualMaxShortPoolAmount = await dataStore.getUint(keys.maxPoolAmountKey(marketToken, shortToken));
    const actualMaxLongPoolUsdForDeposit = await dataStore.getUint(keys.maxPoolUsdForDepositKey(marketToken, longToken));
    const actualMaxShortPoolUsdForDeposit = await dataStore.getUint(keys.maxPoolUsdForDepositKey(marketToken, shortToken));

    const minFirstDeposit = await dataStore.getUint(keys.minMarketTokensForFirstDeposit(marketToken));

    const comparisons: Array<{
      field: string;
      expected: BigNumber;
      actual: BigNumber;
    }> = [
      { field: "maxLongTokenPoolAmount", expected: expectedMaxLongPoolAmount, actual: actualMaxLongPoolAmount },
      { field: "maxShortTokenPoolAmount", expected: expectedMaxShortPoolAmount, actual: actualMaxShortPoolAmount },
      {
        field: "maxLongTokenPoolUsdForDeposit",
        expected: expectedMaxLongPoolUsdForDeposit,
        actual: actualMaxLongPoolUsdForDeposit,
      },
      {
        field: "maxShortTokenPoolUsdForDeposit",
        expected: expectedMaxShortPoolUsdForDeposit,
        actual: actualMaxShortPoolUsdForDeposit,
      },
    ];

    for (const c of comparisons) {
      if (!c.expected.eq(c.actual)) {
        mismatches.push({
          marketLabel,
          marketToken,
          field: c.field,
          expected: toStr(c.expected),
          actual: toStr(c.actual),
        });
      } else if (showMatches) {
        console.log(`OK ${marketLabel} ${c.field} expected=${c.expected.toString()} actual=${c.actual.toString()}`);
      }
    }

    if (minFirstDeposit.eq(0)) {
      minFirstDepositZero.push({ marketLabel, marketToken });
    } else if (showMatches) {
      console.log(`OK ${marketLabel} minMarketTokensForFirstDeposit=${minFirstDeposit.toString()}`);
    }
  }

  console.log("==================================================");
  console.log(`Checked markets: ${checked}`);
  console.log(`Skipped markets (not onchain): ${skipped}`);
  console.log(`Cap mismatches: ${mismatches.length}`);
  console.log(`Markets with minMarketTokensForFirstDeposit == 0: ${minFirstDepositZero.length}`);
  console.log("==================================================");

  if (mismatches.length > 0) {
    console.log("CAP MISMATCHES:");
    for (const m of mismatches) {
      console.log(`- ${m.marketLabel} (${m.marketToken}) ${m.field} expected=${m.expected} actual=${m.actual}`);
    }
  }

  if (minFirstDepositZero.length > 0) {
    console.log("MIN FIRST DEPOSIT ZERO:");
    for (const z of minFirstDepositZero) {
      console.log(`- ${z.marketLabel} (${z.marketToken})`);
    }
  }

  if (failOnMismatch && (mismatches.length > 0 || (requireNonZeroFirstDeposit && minFirstDepositZero.length > 0))) {
    throw new Error("Verification failed due to mismatches / zero min first deposit");
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });
