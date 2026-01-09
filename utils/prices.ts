import fetch from "node-fetch";
import hre from "hardhat";
import { expandDecimals, bigNumberify } from "./math";

export async function fetchTickerPrices() {
  const tickersUrl = getTickersUrl();
  const tokenPricesResponse = await fetch(tickersUrl);
  const tokenPrices = await tokenPricesResponse.json();
  const pricesByTokenAddress = {};

  for (const tokenPrice of tokenPrices) {
    pricesByTokenAddress[tokenPrice.tokenAddress.toLowerCase()] = {
      min: bigNumberify(tokenPrice.minPrice),
      max: bigNumberify(tokenPrice.maxPrice),
    };
  }

  return pricesByTokenAddress;
}

export async function fetchSignedPrices() {
  const signedPricesUrl = getSignedPricesUrl();
  const tokenPricesResponse = await fetch(signedPricesUrl);
  const tokenPrices = await tokenPricesResponse.json();
  const pricesByTokenAddress = {};

  for (const tokenPrice of tokenPrices.signedPrices) {
    pricesByTokenAddress[tokenPrice.tokenAddress.toLowerCase()] = {
      min: bigNumberify(tokenPrice.minPriceFull),
      max: bigNumberify(tokenPrice.maxPriceFull),
      oracleType: tokenPrice.oracleType,
      blob: tokenPrice.blob,
      tokenSymbol: tokenPrice.tokenSymbol,
      address: tokenPrice.tokenAddress,
    };
  }

  return pricesByTokenAddress;
}

export function getGmxInfraUrl(): string {
  if (hre.network.name === "arbitrum") {
    return "https://arbitrum-api.gmxinfra.io/";
  }

  if (hre.network.name === "avalanche") {
    return "https://avalanche-api.gmxinfra.io/";
  }

  if (hre.network.name === "botanix") {
    return "https://botanix-api.gmxinfra.io/";
  }

  throw new Error("Unsupported network");
}

export function getSignedPricesUrl(): string {
  return getGmxInfraUrl() + "signed_prices/latest";
}

export function getTickersUrl() {
  return getGmxInfraUrl() + "prices/tickers";
}

export const prices: Record<string, any> = {};

prices.wnt = {
  contractName: "wnt",
  precision: 8,
  min: expandDecimals(5000, 4),
  max: expandDecimals(5000, 4),
};

prices.wnt.withSpread = {
  contractName: "wnt",
  precision: 8,
  min: expandDecimals(4990, 4),
  max: expandDecimals(5010, 4),
};

prices.wnt.increased = {
  contractName: "wnt",
  precision: 8,
  min: expandDecimals(5020, 4),
  max: expandDecimals(5020, 4),
};

prices.wnt.increased.byFiftyPercent = {
  contractName: "wnt",
  precision: 8,
  min: expandDecimals(7500, 4),
  max: expandDecimals(7500, 4),
};

prices.wnt.increased.withSpread = {
  contractName: "wnt",
  precision: 8,
  min: expandDecimals(5010, 4),
  max: expandDecimals(5030, 4),
};

prices.wnt.decreased = {
  contractName: "wnt",
  precision: 8,
  min: expandDecimals(4980, 4),
  max: expandDecimals(4980, 4),
};

prices.wnt.decreased.withSpread = {
  contractName: "wnt",
  precision: 8,
  min: expandDecimals(4970, 4),
  max: expandDecimals(4990, 4),
};

prices.usdc = {
  contractName: "usdc",
  precision: 18,
  min: expandDecimals(1, 6),
  max: expandDecimals(1, 6),
};

prices.usdt = {
  contractName: "usdt",
  precision: 18,
  min: expandDecimals(1, 6),
  max: expandDecimals(1, 6),
};

prices.wbtc = {
  contractName: "wbtc",
  precision: 20,
  min: expandDecimals(50000, 2),
  max: expandDecimals(50000, 2),
};

prices.sol = {
  contractName: "sol",
  precision: 16,
  min: expandDecimals(50, 5),
  max: expandDecimals(50, 5),
};

// BRL (Brazilian Real) - $0.16 USD per BRL
// BRL has 8 decimals in tokens.ts
// Price format: value * 10^(30-precision) where precision controls granularity
// For $0.16 with precision 8: need final price = 0.16 * 10^22 = 1.6 * 10^21
// Using expandDecimals(16, 13) = 1.6 * 10^14, with precision 8: 1.6 * 10^14 * 10^22 = 1.6 * 10^36 (too high)
// Let's use same pattern as SOL: precision 16, expandDecimals(value, 5)
// SOL at $50: expandDecimals(50, 5) = 5 * 10^6, with precision 16: 5 * 10^6 * 10^14 = 5 * 10^20
// BRL at $0.16: expandDecimals(16, 4) = 1.6 * 10^5, with precision 16: 1.6 * 10^5 * 10^14 = 1.6 * 10^19
prices.brl = {
  contractName: "brl",
  precision: 16,
  min: expandDecimals(16, 4), // $0.16
  max: expandDecimals(16, 4), // $0.16
};

prices.brl.decreased = {
  contractName: "brl",
  precision: 16,
  min: expandDecimals(14, 4), // $0.14 (BRL devalued 12.5%)
  max: expandDecimals(14, 4),
};

prices.brl.increased = {
  contractName: "brl",
  precision: 16,
  min: expandDecimals(18, 4), // $0.18 (BRL strengthened)
  max: expandDecimals(18, 4),
};

prices.ethUsdMarket = {
  indexTokenPrice: {
    min: expandDecimals(5000, 12),
    max: expandDecimals(5000, 12),
  },
  longTokenPrice: {
    min: expandDecimals(5000, 12),
    max: expandDecimals(5000, 12),
  },
  shortTokenPrice: {
    min: expandDecimals(1, 24),
    max: expandDecimals(1, 24),
  },
};

prices.ethUsdSingleTokenMarket = {
  indexTokenPrice: {
    min: expandDecimals(5000, 12),
    max: expandDecimals(5000, 12),
  },
  longTokenPrice: {
    min: expandDecimals(1, 24),
    max: expandDecimals(1, 24),
  },
  shortTokenPrice: {
    min: expandDecimals(1, 24),
    max: expandDecimals(1, 24),
  },
};

prices.ethUsdSingleTokenMarket.increased = {};

prices.ethUsdSingleTokenMarket.increased.byFiftyPercent = {
  indexTokenPrice: {
    min: expandDecimals(7500, 12),
    max: expandDecimals(7500, 12),
  },
  longTokenPrice: {
    min: expandDecimals(1, 24),
    max: expandDecimals(1, 24),
  },
  shortTokenPrice: {
    min: expandDecimals(1, 24),
    max: expandDecimals(1, 24),
  },
};

prices.ethUsdMarket.withSpread = {
  indexTokenPrice: {
    min: expandDecimals(4990, 12),
    max: expandDecimals(5010, 12),
  },
  longTokenPrice: {
    min: expandDecimals(4990, 12),
    max: expandDecimals(5010, 12),
  },
  shortTokenPrice: {
    min: expandDecimals(1, 24),
    max: expandDecimals(1, 24),
  },
};

prices.ethUsdMarket.increased = {
  indexTokenPrice: {
    min: expandDecimals(5020, 12),
    max: expandDecimals(5020, 12),
  },
  longTokenPrice: {
    min: expandDecimals(5020, 12),
    max: expandDecimals(5020, 12),
  },
  shortTokenPrice: {
    min: expandDecimals(1, 24),
    max: expandDecimals(1, 24),
  },
};

prices.ethUsdMarket.decreased = {
  indexTokenPrice: {
    min: expandDecimals(4980, 12),
    max: expandDecimals(4980, 12),
  },
  longTokenPrice: {
    min: expandDecimals(4980, 12),
    max: expandDecimals(4980, 12),
  },
  shortTokenPrice: {
    min: expandDecimals(1, 24),
    max: expandDecimals(1, 24),
  },
};
