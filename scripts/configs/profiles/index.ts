import { Profile } from "./types";
import { allProfile } from "./all";

export const PROFILES: Record<string, Profile> = {
  all: allProfile,
};

export function loadProfile(name: string | undefined): Profile {
  if (!name) {
    console.error(`FEATURES env var is required. Available: ${Object.keys(PROFILES).join(", ")}`);
    process.exit(1);
  }
  const profile = PROFILES[name];
  if (!profile) {
    console.error(`Unknown FEATURES "${name}". Available: ${Object.keys(PROFILES).join(", ")}`);
    process.exit(1);
  }
  return profile;
}
