import { runPrintRolesResolved } from "./printRolesResolved";
import { runVerifySameTokenInvariants } from "./verifySameTokenInvariants";
import { runVerifyVirtualIdAllowlist } from "./verifyVirtualIdAllowlist";

export async function runInvariantChecks() {
  console.log("Running invariant checks...");
  await runPrintRolesResolved();
  await runVerifySameTokenInvariants();
  await runVerifyVirtualIdAllowlist();
  console.log("Completed invariant checks.");
}

async function main() {
  await runInvariantChecks();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((ex) => {
      console.error(ex);
      process.exit(1);
    });
}
