import { FeatureFlags } from "./types";
import { defaultPreset } from "./default";

export const PRESET: Record<string, FeatureFlags> = {
  default: defaultPreset,
};

export function loadPreset(name: string | undefined): FeatureFlags {
  if (!name) {
    console.error(`FEATURES env var is required. Available: ${Object.keys(PRESET).join(", ")}`);
    process.exit(1);
  }
  const preset = PRESET[name];
  if (!preset) {
    console.error(`Unknown FEATURES "${name}". Available: ${Object.keys(PRESET).join(", ")}`);
    process.exit(1);
  }
  return preset;
}
