/**
 * Extracts smart contract addresses (and deployment block) from deployment artifacts
 * and writes them to versions/<network>/vX.Y.Z.json.
 *
 * Usage: npm run extract -- --base-sepolia | --arbitrum | --botanix | ...
 */

import * as fs from "fs";
import * as path from "path";

const DEPLOYMENTS_DIR = path.join(process.cwd(), "deployments");
const VERSIONS_DIR = path.join(process.cwd(), "versions");

const FLAG_TO_NETWORK: Record<string, string> = {
  "base-sepolia": "baseSepolia",
  arbitrum: "arbitrum",
  botanix: "botanix",
};

interface DeploymentArtifact {
  address?: string;
  receipt?: { blockNumber?: number };
}

interface VersionPayload {
  version: string;
  network: string;
  extractedAt: string;
  deploymentBlock: number | null;
  contracts: Record<string, string>;
}

function getNetworkFromArgs(): string | null {
  const args = process.argv.slice(2);
  const flag = args.find((a) => a.startsWith("--") && a.length > 2);
  if (!flag || args.filter((a) => a.startsWith("--")).length !== 1) return null;
  const key = flag.replace(/^--/, "");
  return FLAG_TO_NETWORK[key] ?? key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function nextVersion(network: string): string {
  const dir = path.join(VERSIONS_DIR, network);
  if (!fs.existsSync(dir)) return "1.0.1";
  const files = fs.readdirSync(dir);
  const versionRegex = /^v(\d+)\.(\d+)\.(\d+)\.json$/;
  let maxPatch = 0;
  let major = 1;
  let minor = 0;
  for (const f of files) {
    const m = f.match(versionRegex);
    if (m) {
      const [, ma, mi, pa] = m.map(Number);
      if (ma === 1 && mi === 0 && pa > maxPatch) {
        maxPatch = pa;
        major = ma;
        minor = mi;
      }
    }
  }
  return `${major}.${minor}.${maxPatch + 1}`;
}

function extractAddresses(network: string): { contracts: Record<string, string>; deploymentBlock: number | null } {
  const dir = path.join(DEPLOYMENTS_DIR, network);
  if (!fs.existsSync(dir)) {
    throw new Error(`Deployments directory not found: ${dir}`);
  }

  const contracts: Record<string, string> = {};
  let deploymentBlock: number | null = null;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory() && e.name === "solcInputs") continue;
    if (!e.isFile() || !e.name.endsWith(".json") || e.name === ".migrations.json") continue;

    const filePath = path.join(dir, e.name);
    let data: DeploymentArtifact;
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      data = JSON.parse(raw) as DeploymentArtifact;
    } catch (err) {
      console.warn(`Warning: skipping ${e.name} (invalid JSON):`, (err as Error).message);
      continue;
    }

    if (data.address) {
      const name = e.name.replace(/\.json$/, "");
      contracts[name] = data.address;
      const block = data.receipt?.blockNumber;
      if (typeof block === "number") {
        deploymentBlock = deploymentBlock == null ? block : Math.max(deploymentBlock, block);
      }
    }
  }

  return { contracts, deploymentBlock };
}

function main(): void {
  const network = getNetworkFromArgs();
  if (!network) {
    console.error("Usage: npm run extract -- --<network>");
    console.error("Example: npm run extract -- --base-sepolia");
    console.error("Supported flags (others derived from name): --base-sepolia, --arbitrum, --botanix");
    process.exit(1);
  }

  const deploymentsPath = path.join(DEPLOYMENTS_DIR, network);
  if (!fs.existsSync(deploymentsPath)) {
    console.error(`Deployments folder not found: ${deploymentsPath}`);
    process.exit(1);
  }

  const { contracts, deploymentBlock } = extractAddresses(network);
  const count = Object.keys(contracts).length;
  if (count === 0) {
    console.warn("Warning: no contracts with addresses found.");
  }

  const version = nextVersion(network);
  const outDir = path.join(VERSIONS_DIR, network);
  fs.mkdirSync(outDir, { recursive: true });

  const payload: VersionPayload = {
    version,
    network,
    extractedAt: new Date().toISOString(),
    deploymentBlock,
    contracts: Object.keys(contracts)
      .sort()
      .reduce<Record<string, string>>((acc, k) => {
        acc[k] = contracts[k];
        return acc;
      }, {}),
  };

  const outPath = path.join(outDir, `v${version}.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");

  console.log(`Wrote ${outPath} (${count} contracts${deploymentBlock != null ? `, deploymentBlock: ${deploymentBlock}` : ""})`);
}

main();
