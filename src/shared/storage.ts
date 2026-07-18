import { findProfile, validateCustomProfiles } from "./breakpoints";
import {
  BUILT_IN_PROFILES,
  DEFAULT_PREFERENCES,
  MAX_CUSTOM_PROFILES,
  PROFILE_STORAGE_KEYS,
  STORAGE_KEYS,
} from "./constants";
import type {
  BreakpointProfile,
  DensityPreference,
  ExportFormat,
  PreferencesV2,
  ThemePreference,
} from "./types";

type StorageRecord = Record<string, unknown>;

interface StoredPreferencesIndexV2 {
  schemaVersion: 2;
  storageLayout: "profile-slots-v1";
  theme: ThemePreference;
  density: DensityPreference;
  activeProfileId: string;
  customProfileCount: number;
  defaultExportFormat: ExportFormat;
}

export interface StorageAreaAdapter {
  get(keys: string[]): Promise<StorageRecord>;
  set(items: StorageRecord): Promise<void>;
  remove(keys: string[]): Promise<void>;
  setAccessLevel?(options: { accessLevel: "TRUSTED_CONTEXTS" }): Promise<void>;
}

function isTheme(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function isDensity(value: unknown): value is DensityPreference {
  return value === "comfortable" || value === "compact";
}

function isExportFormat(value: unknown): value is ExportFormat {
  return value === "json" || value === "css" || value === "markdown" || value === "tsv";
}

function asProfile(value: unknown): BreakpointProfile | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<BreakpointProfile>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.name !== "string" ||
    !Array.isArray(candidate.points)
  ) {
    return null;
  }
  const points = candidate.points.map((point) => {
    if (typeof point !== "object" || point === null) return null;
    const pointCandidate = point as Partial<BreakpointProfile["points"][number]>;
    if (
      typeof pointCandidate.id !== "string" ||
      typeof pointCandidate.label !== "string" ||
      typeof pointCandidate.minWidth !== "number"
    ) {
      return null;
    }
    return {
      id: pointCandidate.id,
      label: pointCandidate.label,
      minWidth: pointCandidate.minWidth,
    };
  });
  if (points.some((point) => point === null)) return null;
  return {
    id: candidate.id,
    name: candidate.name,
    points: points as BreakpointProfile["points"],
  };
}

function asPreferences(value: unknown): PreferencesV2 | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<PreferencesV2>;
  if (
    candidate.schemaVersion !== 2 ||
    !isTheme(candidate.theme) ||
    !isDensity(candidate.density) ||
    typeof candidate.activeProfileId !== "string" ||
    !Array.isArray(candidate.customProfiles) ||
    !isExportFormat(candidate.defaultExportFormat)
  ) {
    return null;
  }
  const profiles = candidate.customProfiles.map(asProfile);
  if (profiles.some((profile) => profile === null)) return null;
  const customProfiles = profiles as BreakpointProfile[];
  const validation = validateCustomProfiles(customProfiles);
  if (!validation.valid) return null;
  return { ...candidate, customProfiles } as PreferencesV2;
}

function asPreferencesIndex(value: unknown): StoredPreferencesIndexV2 | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<StoredPreferencesIndexV2>;
  if (
    candidate.schemaVersion !== 2 ||
    candidate.storageLayout !== "profile-slots-v1" ||
    !isTheme(candidate.theme) ||
    !isDensity(candidate.density) ||
    typeof candidate.activeProfileId !== "string" ||
    !Number.isInteger(candidate.customProfileCount) ||
    (candidate.customProfileCount ?? -1) < 0 ||
    (candidate.customProfileCount ?? MAX_CUSTOM_PROFILES + 1) > MAX_CUSTOM_PROFILES ||
    !isExportFormat(candidate.defaultExportFormat)
  ) {
    return null;
  }
  return candidate as StoredPreferencesIndexV2;
}

function readStoredPreferences(stored: StorageRecord): PreferencesV2 | null {
  const primary = stored[STORAGE_KEYS.preferences];
  const legacySingleItem = asPreferences(primary);
  if (legacySingleItem) return normalizePreferences(legacySingleItem);

  const index = asPreferencesIndex(primary);
  if (!index) return null;
  const customProfiles = PROFILE_STORAGE_KEYS.slice(0, index.customProfileCount).map(
    (key) => stored[key],
  );
  return asPreferences({
    schemaVersion: index.schemaVersion,
    theme: index.theme,
    density: index.density,
    activeProfileId: index.activeProfileId,
    customProfiles,
    defaultExportFormat: index.defaultExportFormat,
  });
}

export function normalizePreferences(value: unknown): PreferencesV2 {
  const parsed = asPreferences(value);
  if (!parsed) return structuredClone(DEFAULT_PREFERENCES);
  const profile = findProfile(parsed.activeProfileId, parsed.customProfiles);
  return {
    ...parsed,
    activeProfileId: profile.id,
    customProfiles: structuredClone(parsed.customProfiles),
  };
}

function chromeStorageAdapter(area: chrome.storage.StorageArea): StorageAreaAdapter {
  const adapter: StorageAreaAdapter = {
    async get(keys) {
      return area.get(keys);
    },
    async set(items) {
      await area.set(items);
    },
    async remove(keys) {
      await area.remove(keys);
    },
  };
  if ("setAccessLevel" in area) {
    adapter.setAccessLevel = async (options) => {
      await area.setAccessLevel(options);
    };
  }
  return adapter;
}

async function persistPreferences(
  sync: StorageAreaAdapter,
  preferences: PreferencesV2,
): Promise<PreferencesV2> {
  const normalized = normalizePreferences(preferences);
  const index: StoredPreferencesIndexV2 = {
    schemaVersion: 2,
    storageLayout: "profile-slots-v1",
    theme: normalized.theme,
    density: normalized.density,
    activeProfileId: normalized.activeProfileId,
    customProfileCount: normalized.customProfiles.length,
    defaultExportFormat: normalized.defaultExportFormat,
  };
  const items: StorageRecord = { [STORAGE_KEYS.preferences]: index };
  normalized.customProfiles.forEach((profile, profileIndex) => {
    const key = PROFILE_STORAGE_KEYS[profileIndex];
    if (key) items[key] = profile;
  });
  await sync.set(items);
  const staleProfileKeys = PROFILE_STORAGE_KEYS.slice(normalized.customProfiles.length);
  if (staleProfileKeys.length > 0) await sync.remove(staleProfileKeys);
  return normalized;
}

export async function migratePreferences(
  sync: StorageAreaAdapter,
  local: StorageAreaAdapter,
): Promise<PreferencesV2> {
  const legacyKeys = [
    STORAGE_KEYS.legacyTheme,
    STORAGE_KEYS.legacyCompactMode,
    STORAGE_KEYS.legacyLastMetrics,
  ];

  const stored = await sync.get([
    STORAGE_KEYS.preferences,
    STORAGE_KEYS.legacyTheme,
    STORAGE_KEYS.legacyCompactMode,
    ...PROFILE_STORAGE_KEYS,
  ]);
  const existing = readStoredPreferences(stored);
  const legacyTheme = stored[STORAGE_KEYS.legacyTheme];
  const legacyCompact = stored[STORAGE_KEYS.legacyCompactMode];
  const preferences = existing
    ? normalizePreferences(existing)
    : {
        ...structuredClone(DEFAULT_PREFERENCES),
        theme: isTheme(legacyTheme) ? legacyTheme : DEFAULT_PREFERENCES.theme,
        density: legacyCompact === true ? "compact" : DEFAULT_PREFERENCES.density,
      };

  const persisted = await persistPreferences(sync, preferences);
  await Promise.all([sync.remove(legacyKeys), local.remove(legacyKeys)]);
  return persisted;
}

export async function initializeStorage(): Promise<PreferencesV2> {
  const sync = chromeStorageAdapter(chrome.storage.sync);
  const local = chromeStorageAdapter(chrome.storage.local);
  await Promise.all([
    sync.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" }),
    local.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" }),
  ]);
  return migratePreferences(sync, local);
}

export async function savePreferences(preferences: PreferencesV2): Promise<PreferencesV2> {
  return persistPreferences(chromeStorageAdapter(chrome.storage.sync), preferences);
}

export function isBuiltInProfile(profileId: string): boolean {
  return BUILT_IN_PROFILES.some((profile) => profile.id === profileId);
}
