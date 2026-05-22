import { Profile } from "./types";
import { redactAllProfile } from "./redact-all";

export const PROFILES: Record<string, Profile> = {
  "redact-all": redactAllProfile,
};

export function loadProfile(name: string | undefined): Profile {
  if (!name) {
    console.error(`PROFILE env var is required. Available: ${Object.keys(PROFILES).join(", ")}`);
    process.exit(1);
  }
  const profile = PROFILES[name];
  if (!profile) {
    console.error(`Unknown PROFILE "${name}". Available: ${Object.keys(PROFILES).join(", ")}`);
    process.exit(1);
  }
  return profile;
}
