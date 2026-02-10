/**
 * Export Deployment Addresses
 *
 * Reads all deployed contract addresses and market info from the current
 * Hardhat deployment and writes them to a JSON file that the frontend can import.
 *
 * This eliminates hardcoded addresses that break every time the node restarts.
 *
 * Usage: npm run local:export-addresses
 *
 * Output: ../nivo-demo/src/generated/contracts.json
 */
import { deployments, ethers, gmx } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface MarketInfo {
  name: string;
  marketToken: string;
  indexToken: string;
  longToken: string;
  shortToken: string;
}

interface ExportedAddresses {
  generatedAt: string;
  chainId: number;
  contracts: {
    exchangeRouter: string;
    router: string;
    orderVault: string;
    depositVault: string;
    withdrawalVault: string;
    dataStore: string;
    reader: string;
    roleStore: string;
    mockPriceFeed: string;
    weth: string;
    usdt: string;
    usdc: string;
  };
  markets: MarketInfo[];
}

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║              EXPORT DEPLOYMENT ADDRESSES                      ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, `(chainId: ${network.chainId})`);

  // Read core contract addresses from deployments
  const contractNames = [
    "ExchangeRouter",
    "Router",
    "OrderVault",
    "DepositVault",
    "WithdrawalVault",
    "DataStore",
    "Reader",
    "RoleStore",
    "MockPriceFeed",
    "WETH",
    "USDT",
    "USDC",
  ];

  const addresses: Record<string, string> = {};

  for (const name of contractNames) {
    try {
      const deployment = await deployments.get(name);
      addresses[name] = deployment.address;
      console.log(`  ${name}: ${deployment.address}`);
    } catch {
      console.log(`  ${name}: NOT DEPLOYED`);
      addresses[name] = "";
    }
  }

  // Build address -> symbol map from token config (handles synthetic tokens too)
  console.log("\n=== Building Token Map ===\n");
  const tokenAddressToSymbol: Record<string, string> = {};
  try {
    const tokens = await gmx.getTokens();
    for (const [symbol, tokenConfig] of Object.entries(tokens)) {
      if (tokenConfig.address) {
        tokenAddressToSymbol[tokenConfig.address.toLowerCase()] = symbol;
        console.log(`  ${symbol}: ${tokenConfig.address}`);
      }
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message.slice(0, 100) : String(e);
    console.log("  Failed to load token config:", msg);
  }

  // Read markets from Reader
  console.log("\n=== Fetching Markets ===\n");
  const markets: MarketInfo[] = [];

  if (addresses.Reader && addresses.DataStore) {
    try {
      const reader = await ethers.getContractAt("Reader", addresses.Reader);
      const allMarkets = await reader.getMarkets(addresses.DataStore, 0, 100);

      for (const m of allMarkets) {
        let name = m.marketToken;

        // Look up index token symbol from the config map (works for synthetic tokens)
        const indexSymbol = tokenAddressToSymbol[m.indexToken.toLowerCase()];
        if (indexSymbol) {
          name = `${indexSymbol}/USD`;
        } else if (m.indexToken !== ethers.constants.AddressZero) {
          // Fallback: try calling symbol() on the contract (works for deployed tokens)
          try {
            const token = await ethers.getContractAt("MintableToken", m.indexToken);
            const symbol = await token.symbol();
            name = `${symbol}/USD`;
          } catch {
            /* non-contract synthetic token, keep address as name */
          }
        }

        markets.push({
          name,
          marketToken: m.marketToken,
          indexToken: m.indexToken,
          longToken: m.longToken,
          shortToken: m.shortToken,
        });
        console.log(`  ${name}: ${m.marketToken}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message.slice(0, 100) : String(e);
      console.log("  Failed to read markets:", msg);
    }
  }

  if (markets.length === 0) {
    console.log("  No markets found.");
  }

  // Build output
  const output: ExportedAddresses = {
    generatedAt: new Date().toISOString(),
    chainId: network.chainId,
    contracts: {
      exchangeRouter: addresses.ExchangeRouter || "",
      router: addresses.Router || "",
      orderVault: addresses.OrderVault || "",
      depositVault: addresses.DepositVault || "",
      withdrawalVault: addresses.WithdrawalVault || "",
      dataStore: addresses.DataStore || "",
      reader: addresses.Reader || "",
      roleStore: addresses.RoleStore || "",
      mockPriceFeed: addresses.MockPriceFeed || "",
      weth: addresses.WETH || "",
      usdt: addresses.USDT || "",
      usdc: addresses.USDC || "",
    },
    markets,
  };

  // Write to frontend generated directory
  const outputDir = path.resolve(__dirname, "../../../../nivo-demo/src/generated");
  const outputFile = path.join(outputDir, "contracts.json");

  // Create directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`\nCreated directory: ${outputDir}`);
  }

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`\nAddresses exported to: ${outputFile}`);

  // Also write to gmx-synthetics for reference
  const localOutput = path.resolve(__dirname, "../../../deployments/localhost/addresses.json");
  fs.writeFileSync(localOutput, JSON.stringify(output, null, 2));
  console.log(`Also saved to: ${localOutput}`);

  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║                     EXPORT COMPLETE                           ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");
  console.log(`Exported ${Object.values(addresses).filter(Boolean).length} contracts and ${markets.length} markets.`);
  console.log("Frontend will auto-detect these addresses on next load.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
