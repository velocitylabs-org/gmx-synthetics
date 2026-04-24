// Reads deployment artifacts, bumps the chain version, and upserts to Supabase.
// See VELOCITY_DOCS/DEPLOYMENT_SYNC.md for the full operator workflow.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: resolve(__dirname, "../../.env") });

type BumpType = "patch" | "minor" | "major";

interface Args {
  chain: string;
  chainLabel: string;
  bump: BumpType;
  noBump: boolean;
  dryRun: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const chain = get("--chain");
  const chainLabel = get("--chain-label");

  if (!chain || !chainLabel) {
    console.error(
      "Usage: ts-node ci/scripts/upsert-deployments.ts --chain <folder> --chain-label <db-label> [--bump patch|minor|major] [--no-bump] [--dry-run]"
    );
    process.exit(1);
  }

  const bumpArg = get("--bump") ?? "patch";
  if (!["patch", "minor", "major"].includes(bumpArg)) {
    console.error(`Invalid --bump value: ${bumpArg}. Must be patch, minor, or major.`);
    process.exit(1);
  }

  return {
    chain,
    chainLabel,
    bump: bumpArg as BumpType,
    noBump: args.includes("--no-bump") || process.env.CI === "true",
    dryRun: args.includes("--dry-run"),
  };
}

function readVersion(versionFile: string): string {
  if (!existsSync(versionFile)) {
    console.error(`Error: .version file not found at ${versionFile}. Create it with an initial version (e.g. 1.0.0).`);
    process.exit(1);
  }
  return readFileSync(versionFile, "utf-8").trim();
}

function bumpVersion(current: string, bump: BumpType): string {
  const parts = current.split(".").map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    console.error(`Invalid version in .version file: "${current}". Expected semver (e.g. 1.0.0).`);
    process.exit(1);
  }
  const [major, minor, patch] = parts;
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

interface DeploymentRow {
  contractName: string;
  address: string;
  abi: object[];
}

function readDeploymentArtifacts(deploymentsDir: string): DeploymentRow[] {
  const entries = readdirSync(deploymentsDir, { withFileTypes: true });
  const rows: DeploymentRow[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) continue;
    if (!entry.name.endsWith(".json") || entry.name === ".migrations.json") continue;

    const filePath = join(deploymentsDir, entry.name);
    let data: { address?: string; abi?: object[] };
    try {
      data = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch {
      console.warn(`Warning: skipping ${entry.name} (invalid JSON)`);
      continue;
    }

    if (!data.address || !data.abi) continue;

    rows.push({
      contractName: basename(entry.name, ".json"),
      address: data.address,
      abi: data.abi,
    });
  }

  return rows;
}

async function main() {
  const { chain, chainLabel, bump, noBump, dryRun } = parseArgs();

  const repoRoot = resolve(__dirname, "../..");
  const deploymentsDir = join(repoRoot, "deployments", chain);
  const versionFile = join(deploymentsDir, ".version");

  const currentVersion = readVersion(versionFile);
  const nextVersion = noBump ? currentVersion : bumpVersion(currentVersion, bump);

  const contracts = readDeploymentArtifacts(deploymentsDir);

  console.log(`Chain folder : ${chain}`);
  console.log(`Chain label  : ${chainLabel}`);
  console.log(`Version      : ${currentVersion}${noBump ? "" : ` → ${nextVersion} (${bump} bump)`}`);
  console.log(`Contracts    : ${contracts.length} files`);
  console.log(`Dry-run      : ${dryRun}\n`);

  if (dryRun) {
    for (const { contractName, address } of contracts) {
      console.log(`  [dry-run] would upsert ${contractName} @ ${address}`);
    }
    console.log(`\n  [dry-run] would set .version ${currentVersion} → ${nextVersion}`);
    console.log(`  [dry-run] would set pointer ${chainLabel} → ${nextVersion}`);
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const rows = contracts.map(({ contractName, address, abi }) => ({
    chain: chainLabel,
    version: nextVersion,
    contract_name: contractName,
    address,
    abi,
  }));

  console.log(`Upserting ${rows.length} rows into contract_deployments...`);
  const { error: upsertError } = await supabase
    .from("contract_deployments")
    .upsert(rows, { onConflict: "chain,version,contract_name" });

  if (upsertError) {
    console.error("Failed to upsert contract_deployments:", upsertError.message);
    process.exit(1);
  }
  console.log("Upsert complete.");

  console.log(`Updating pointer: ${chainLabel} → ${nextVersion}...`);
  const { error: pointerError } = await supabase
    .from("contract_deployment_pointers")
    .upsert({ chain: chainLabel, version: nextVersion, updated_at: new Date().toISOString() }, { onConflict: "chain" });

  if (pointerError) {
    console.error("Failed to update contract_deployment_pointers:", pointerError.message);
    process.exit(1);
  }
  console.log("Pointer updated.");

  if (!noBump) {
    writeFileSync(versionFile, nextVersion, "utf-8");
    console.log(`\n.version updated: ${currentVersion} → ${nextVersion}`);
    console.log(`Remember to commit deployments/${chain}/.version`);
  }
}

main();
