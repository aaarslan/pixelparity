import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  PROFILE_STORAGE_KEYS,
  STORAGE_KEYS,
} from "../../src/shared/constants";
import {
  migratePreferences,
  normalizePreferences,
  type StorageAreaAdapter,
} from "../../src/shared/storage";

class MemoryStorage implements StorageAreaAdapter {
  values: Record<string, unknown>;
  reads: string[][] = [];
  removals: string[][] = [];

  constructor(initial: Record<string, unknown> = {}) {
    this.values = { ...initial };
  }

  async get(keys: string[]) {
    this.reads.push(keys);
    return Object.fromEntries(keys.map((key) => [key, this.values[key]]));
  }

  async set(items: Record<string, unknown>) {
    Object.assign(this.values, items);
  }

  async remove(keys: string[]) {
    this.removals.push(keys);
    for (const key of keys) delete this.values[key];
  }
}

describe("v1 preference migration", () => {
  it("maps theme and compact mode, then deletes the legacy metrics cache", async () => {
    const sync = new MemoryStorage({
      [STORAGE_KEYS.legacyTheme]: "dark",
      [STORAGE_KEYS.legacyCompactMode]: true,
    });
    const local = new MemoryStorage({
      [STORAGE_KEYS.legacyLastMetrics]: { meta: { url: "https://private.example" } },
    });
    const result = await migratePreferences(sync, local);
    expect(result.theme).toBe("dark");
    expect(result.density).toBe("compact");
    expect(result.activeProfileId).toBe("pixelparity-classic");
    expect(local.values[STORAGE_KEYS.legacyLastMetrics]).toBeUndefined();
    expect(local.reads).toHaveLength(0);
  });

  it("is idempotent and preserves a valid v2 preference object", async () => {
    const expected = { ...structuredClone(DEFAULT_PREFERENCES), theme: "light" as const };
    const sync = new MemoryStorage({ [STORAGE_KEYS.preferences]: expected });
    const local = new MemoryStorage();
    expect(await migratePreferences(sync, local)).toEqual(expected);
    expect(await migratePreferences(sync, local)).toEqual(expected);
  });

  it("shards the maximum profile set below Chrome Sync's per-item quota", async () => {
    const customProfiles = Array.from({ length: 10 }, (_, profileIndex) => ({
      id: `custom-${"p".repeat(24)}-${profileIndex.toString().padStart(8, "0")}`,
      name: `${`Profile ${profileIndex} `.padEnd(40, "x")}`,
      points: Array.from({ length: 12 }, (_, pointIndex) => ({
        id: `point-${profileIndex}-${pointIndex}`,
        label: `BP-${profileIndex}-${pointIndex}`.padEnd(16, "x"),
        minWidth: pointIndex * 1_000_000,
      })),
    }));
    const expected = {
      ...structuredClone(DEFAULT_PREFERENCES),
      activeProfileId: customProfiles[0]?.id ?? "pixelparity-classic",
      customProfiles,
    };
    const sync = new MemoryStorage({ [STORAGE_KEYS.preferences]: expected });
    const local = new MemoryStorage();

    expect(await migratePreferences(sync, local)).toEqual(expected);
    const storedItems = [STORAGE_KEYS.preferences, ...PROFILE_STORAGE_KEYS]
      .filter((key) => key in sync.values)
      .map(
        (key) =>
          Buffer.byteLength(key) + Buffer.byteLength(JSON.stringify(sync.values[key])),
      );
    expect(storedItems).toHaveLength(11);
    expect(Math.max(...storedItems)).toBeLessThanOrEqual(8_192);
    expect(await migratePreferences(sync, local)).toEqual(expected);
  });

  it("rejects malformed preferences", () => {
    expect(normalizePreferences({ schemaVersion: 2, theme: "neon" })).toEqual(
      DEFAULT_PREFERENCES,
    );
    expect(
      normalizePreferences({
        ...DEFAULT_PREFERENCES,
        customProfiles: [null],
      }),
    ).toEqual(DEFAULT_PREFERENCES);
  });
});
