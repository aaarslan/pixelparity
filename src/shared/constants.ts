import type { BreakpointProfile, PreferencesV2 } from "./types";

export const MAX_CUSTOM_PROFILES = 10;
export const MAX_BREAKPOINTS_PER_PROFILE = 12;

export const STORAGE_KEYS = {
  preferences: "pixelparity_preferences_v2",
  profileSlotPrefix: "pixelparity_profile_v2_",
  legacyTheme: "pixelparity_theme",
  legacyCompactMode: "pixelparity_compact_mode",
  legacyLastMetrics: "pixelparity_last_metrics",
} as const;

export const PROFILE_STORAGE_KEYS = Array.from(
  { length: MAX_CUSTOM_PROFILES },
  (_, index) => `${STORAGE_KEYS.profileSlotPrefix}${index}`,
);
export const LIVE_UPDATE_INTERVAL_MS = 100;
export const LIVE_PORT_NAME = "pixelparity-live-v2";

export const CLASSIC_PROFILE: BreakpointProfile = {
  id: "pixelparity-classic",
  name: "PixelParity Classic",
  points: [
    { id: "classic-xs", label: "XS", minWidth: 0 },
    { id: "classic-sm", label: "SM", minWidth: 576 },
    { id: "classic-md", label: "MD", minWidth: 768 },
    { id: "classic-lg", label: "LG", minWidth: 992 },
    { id: "classic-xl", label: "XL", minWidth: 1200 },
    { id: "classic-xxl", label: "XXL", minWidth: 1400 },
  ],
};

export const TAILWIND_PROFILE: BreakpointProfile = {
  id: "tailwind-style",
  name: "Tailwind-style",
  points: [
    { id: "tailwind-base", label: "Base", minWidth: 0 },
    { id: "tailwind-sm", label: "sm", minWidth: 640 },
    { id: "tailwind-md", label: "md", minWidth: 768 },
    { id: "tailwind-lg", label: "lg", minWidth: 1024 },
    { id: "tailwind-xl", label: "xl", minWidth: 1280 },
    { id: "tailwind-2xl", label: "2xl", minWidth: 1536 },
  ],
};

export const BUILT_IN_PROFILES: readonly BreakpointProfile[] = [
  CLASSIC_PROFILE,
  TAILWIND_PROFILE,
];

export const DEFAULT_PREFERENCES: PreferencesV2 = {
  schemaVersion: 2,
  theme: "system",
  density: "comfortable",
  activeProfileId: CLASSIC_PROFILE.id,
  customProfiles: [],
  defaultExportFormat: "json",
};
