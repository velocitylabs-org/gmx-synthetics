import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const PROFILE_PATH = path.join(__dirname, "..", "profiles", "feature-validation.env");

const REQUIRED_KEYS = [
  "WRITE",
  "TARGET_DISABLED_STATE",
  "RUN_ORDER_FEATURE_REDACTION",
  "RUN_POOL_RISK_GUARDS",
  "RUN_INVARIANT_VALIDATIONS",
  "RUN_SHIFT_FEATURES",
  "RUN_JIT_FEATURE",
  "RUN_SUBACCOUNT_FEATURE",
  "RUN_GASLESS_FEATURE",
  "RUN_ATOMIC_WITHDRAWAL_FEATURE",
  "RUN_FEATURE_VALIDATIONS",
  "FAIL_ON_MISMATCH",
] as const;

function main() {
  if (!fs.existsSync(PROFILE_PATH)) {
    throw new Error(`Feature validation profile not found: ${PROFILE_PATH}`);
  }

  const env = dotenv.parse(fs.readFileSync(PROFILE_PATH));
  const keys = Object.keys(env);

  const missing = REQUIRED_KEYS.filter((key) => env[key] === undefined);
  const unknown = keys.filter((key) => !REQUIRED_KEYS.includes(key as (typeof REQUIRED_KEYS)[number]));
  const invalidBooleans = REQUIRED_KEYS.filter((key) => !["true", "false"].includes(env[key]));

  console.log(`Validating profile: ${PROFILE_PATH}`);

  if (missing.length > 0) {
    console.log("Missing keys:");
    missing.forEach((key) => console.log(`- ${key}`));
  }

  if (unknown.length > 0) {
    console.log("Unknown keys:");
    unknown.forEach((key) => console.log(`- ${key}`));
  }

  if (invalidBooleans.length > 0) {
    console.log("Invalid boolean values (must be 'true' or 'false'):");
    invalidBooleans.forEach((key) => console.log(`- ${key}=${env[key]}`));
  }

  if (missing.length > 0 || unknown.length > 0 || invalidBooleans.length > 0) {
    throw new Error("Feature validation profile is invalid");
  }

  console.log("Feature validation profile is valid.");
}

if (require.main === module) {
  try {
    main();
    process.exit(0);
  } catch (ex) {
    console.error(ex);
    process.exit(1);
  }
}
