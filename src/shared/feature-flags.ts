// src/shared/feature-flags.ts

export const features = {
  // Batch overrides editor UI foldouts (Canvas/Typography/Media)
  // Disabled by default; backend functionality remains enabled.
  batchOverridesUI: false,
} as const;
