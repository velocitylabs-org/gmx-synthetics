import { runPrintRolesResolved } from "./configs/validations/printRolesResolved";

// Deprecated wrapper: prefer scripts/configs/validations/printRolesResolved.ts directly.
async function main() {
  await runPrintRolesResolved();
  console.log("done");
}

if (require.main === module) {
  main().catch((ex) => {
    console.error(ex);
    process.exit(1);
  });
}
