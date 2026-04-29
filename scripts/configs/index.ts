import { runDisableSwapCreate } from "./disableSwapCreate";
import { runDisableSwapExecute } from "./disableSwapExecute";
import { runApplyPoolCapsAndFirstDeposit } from "./applyPoolCapsAndFirstDeposit";

async function main() {
  console.log("Running config patch scripts...");

  // Toggle SCRUM workstreams here for local testing, or control via env vars:
  // RUN_SCRUM225=true|false RUN_SCRUM226=true|false
  const runScrum225 = process.env.RUN_SCRUM225 === undefined ? true : process.env.RUN_SCRUM225 === "true";
  const runScrum226 = process.env.RUN_SCRUM226 === "true";

  if (runScrum225) {
    await runDisableSwapCreate();
    await runDisableSwapExecute();
  }

  if (runScrum226) {
    await runApplyPoolCapsAndFirstDeposit();
  }

  console.log("Completed config patch scripts.");
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((ex) => {
      console.error(ex);
      process.exit(1);
    });
}
