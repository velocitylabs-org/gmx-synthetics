import { runConfigScript } from "../configRuntime";
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

if (require.main === module) {
  runConfigScript(runInvariantChecks);
}
