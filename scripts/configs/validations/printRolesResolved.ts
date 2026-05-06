import fs from "fs";
import path from "path";
import hre from "hardhat";

import { hashString } from "../../../utils/hash";
import { getDeployedContract } from "../helpers/getDeployedContract";

const knownRoles = Object.fromEntries(
  [
    "ROLE_ADMIN",
    "TIMELOCK_ADMIN",
    "TIMELOCK_MULTISIG",
    "CONFIG_KEEPER",
    "LIMITED_CONFIG_KEEPER",
    "CONTROLLER",
    "GOV_TOKEN_CONTROLLER",
    "ROUTER_PLUGIN",
    "MARKET_KEEPER",
    "FEE_KEEPER",
    "FEE_DISTRIBUTION_KEEPER",
    "ORDER_KEEPER",
    "FROZEN_ORDER_KEEPER",
    "PRICING_KEEPER",
    "LIQUIDATION_KEEPER",
    "ADL_KEEPER",
    "CONTRIBUTOR_KEEPER",
    "CONTRIBUTOR_DISTRIBUTOR",
    "CLAIM_ADMIN",
  ].map((role) => [hashString(role), role])
);

function loadAddressToNameFromFallbackDeployments(): Record<string, string> {
  const result: Record<string, string> = {};
  const baseDeploymentsDir = path.join(hre.config.paths.root, "deployments", "base");
  if (!fs.existsSync(baseDeploymentsDir)) {
    return result;
  }

  for (const fileName of fs.readdirSync(baseDeploymentsDir)) {
    if (!fileName.endsWith(".json")) continue;
    const filePath = path.join(baseDeploymentsDir, fileName);
    try {
      const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (content.address) {
        result[content.address] = fileName.replace(".json", "");
      }
    } catch {
      // Ignore malformed deployment artifacts.
    }
  }

  return result;
}

async function loadAddressToNameMap() {
  try {
    const deployments = await hre.deployments.all();
    const mapped = Object.fromEntries(Object.entries(deployments).map(([name, d]) => [d.address, name]));
    if (Object.keys(mapped).length > 0) {
      return mapped;
    }
  } catch {
    // Fall through to fallback deployment artifacts
  }

  return loadAddressToNameFromFallbackDeployments();
}

export async function runPrintRolesResolved() {
  const roleStore = await getDeployedContract(hre, "RoleStore");
  const roleCount = await roleStore.getRoleCount();
  const roles = await roleStore.getRoles(0, roleCount);
  const addressToName = await loadAddressToNameMap();

  for (const [roleHash, role] of Object.entries(knownRoles)) {
    console.log("%s %s", role, roleHash);
  }
  console.log("");

  const sortedRoles = [...roles].sort((a, b) => {
    const aName = knownRoles[a] || a;
    const bName = knownRoles[b] || b;
    return aName.localeCompare(bName);
  });

  for (const role of sortedRoles) {
    const roleMemberCount = await roleStore.getRoleMemberCount(role);
    const roleMembers = await roleStore.getRoleMembers(role, 0, roleMemberCount);
    const sortedMembers = [...roleMembers].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    const roleData = sortedMembers.map((m) => (addressToName[m] ? `${m} (${addressToName[m]})` : m));
    console.log("%s:\n\t%s", knownRoles[role] || role, roleData.join("\n\t"));
  }
}

async function main() {
  await runPrintRolesResolved();
}

if (require.main === module) {
  main()
    .then(() => {
      console.log("done");
      process.exit(0);
    })
    .catch((ex) => {
      console.error(ex);
      process.exit(1);
    });
}
