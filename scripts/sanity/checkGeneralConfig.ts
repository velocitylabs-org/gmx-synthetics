import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "ethers";
import generalConfigFn from "../../config/general";

function safeAddress(addr: any): string {
  try {
    return ethers.utils.getAddress(addr);
  } catch {
    return String(addr);
  }
}

async function main() {
  // We don't need an RPC connection: `config/general.ts` only depends on `network.name`
  // for choosing the correct merged config object.
  const networksToCheck = ["base", "baseSepolia", "arbitrum", "avalanche", "botanix"];

  const rows: Array<{ network: string; feeReceiver: string; holdingAddress: string }> = [];

  for (const name of networksToCheck) {
    const cfg = await (generalConfigFn as any)({ network: { name, live: true } } as HardhatRuntimeEnvironment);
    rows.push({
      network: name,
      feeReceiver: safeAddress(cfg.feeReceiver),
      holdingAddress: safeAddress(cfg.holdingAddress),
    });
  }

  // Print a compact table so it’s easy to spot unintended changes.
  // eslint-disable-next-line no-console
  console.log("general.ts sanity check (feeReceiver/holdingAddress)");
  for (const r of rows) {
    // eslint-disable-next-line no-console
    console.log(`${r.network.padEnd(11)} feeReceiver=${r.feeReceiver} holdingAddress=${r.holdingAddress}`);
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

