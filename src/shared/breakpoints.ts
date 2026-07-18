import {
  BUILT_IN_PROFILES,
  CLASSIC_PROFILE,
  MAX_BREAKPOINTS_PER_PROFILE,
  MAX_CUSTOM_PROFILES,
} from "./constants";
import type { ActiveBreakpoint, BreakpointPoint, BreakpointProfile } from "./types";

export interface ProfileValidationResult {
  valid: boolean;
  errors: string[];
}

export function getAllProfiles(customProfiles: BreakpointProfile[]): BreakpointProfile[] {
  return [...BUILT_IN_PROFILES, ...customProfiles];
}

export function findProfile(
  profileId: string,
  customProfiles: BreakpointProfile[],
): BreakpointProfile {
  return (
    getAllProfiles(customProfiles).find((profile) => profile.id === profileId) ??
    CLASSIC_PROFILE
  );
}

export function getActiveBreakpoint(
  width: number,
  profile: BreakpointProfile,
): ActiveBreakpoint {
  const safeWidth = Number.isFinite(width) ? Math.max(0, width) : 0;
  const points = [...profile.points].sort((a, b) => a.minWidth - b.minWidth);
  const fallback: BreakpointPoint = points[0] ?? {
    id: "fallback",
    label: "Base",
    minWidth: 0,
  };
  let active = fallback;

  for (const point of points) {
    if (point.minWidth <= safeWidth) active = point;
    else break;
  }

  const activeIndex = points.findIndex((point) => point.id === active.id);
  const next = activeIndex >= 0 ? points[activeIndex + 1] : undefined;

  return {
    profileId: profile.id,
    profileName: profile.name,
    pointId: active.id,
    label: active.label,
    minWidth: active.minWidth,
    nextMinWidth: next?.minWidth ?? null,
  };
}

export function validateProfile(profile: BreakpointProfile): ProfileValidationResult {
  const errors: string[] = [];
  const name = profile.name.trim();

  if (!profile.id || profile.id.length > 64) {
    errors.push("Profile ID must be between 1 and 64 characters.");
  }
  if (!name) errors.push("Profile name is required.");
  if (name.length > 40) errors.push("Profile name must be 40 characters or fewer.");
  if (profile.points.length === 0) errors.push("Add at least one breakpoint.");
  if (profile.points.length > MAX_BREAKPOINTS_PER_PROFILE) {
    errors.push(`Profiles can contain at most ${MAX_BREAKPOINTS_PER_PROFILE} breakpoints.`);
  }

  const labels = new Set<string>();
  const pointIds = new Set<string>();
  let previous = -1;

  for (const point of profile.points) {
    const label = point.label.trim();
    const normalizedLabel = label.toLocaleLowerCase("en-US");
    if (!label) errors.push("Every breakpoint needs a label.");
    if (label.length > 16) errors.push(`Breakpoint label “${label}” is too long.`);
    if (labels.has(normalizedLabel)) {
      errors.push(`Breakpoint labels must be unique: “${label}”.`);
    }
    labels.add(normalizedLabel);
    if (!point.id || point.id.length > 64 || pointIds.has(point.id)) {
      errors.push("Breakpoint IDs must be unique and between 1 and 64 characters.");
    }
    pointIds.add(point.id);
    if (!Number.isInteger(point.minWidth) || point.minWidth < 0) {
      errors.push(`“${label || "Breakpoint"}” must use a non-negative integer width.`);
    }
    if (point.minWidth <= previous) {
      errors.push("Breakpoint widths must be strictly increasing.");
    }
    previous = point.minWidth;
  }

  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function validateCustomProfiles(
  profiles: BreakpointProfile[],
): ProfileValidationResult {
  const errors: string[] = [];
  if (profiles.length > MAX_CUSTOM_PROFILES) {
    errors.push(`Save at most ${MAX_CUSTOM_PROFILES} custom profiles.`);
  }

  const names = new Set<string>();
  const ids = new Set(BUILT_IN_PROFILES.map((profile) => profile.id));
  for (const profile of profiles) {
    const result = validateProfile(profile);
    errors.push(...result.errors.map((error) => `${profile.name || "Untitled"}: ${error}`));
    const normalizedName = profile.name.trim().toLocaleLowerCase("en-US");
    if (names.has(normalizedName))
      errors.push(`Profile names must be unique: “${profile.name}”.`);
    names.add(normalizedName);
    if (ids.has(profile.id)) errors.push(`Profile ID must be unique: “${profile.id}”.`);
    ids.add(profile.id);
  }

  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export function createProfileId(name: string): string {
  const slug = name
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  const suffix = crypto.randomUUID().slice(0, 8);
  return `custom-${slug || "profile"}-${suffix}`;
}

export function createPointId(): string {
  return `point-${crypto.randomUUID().slice(0, 8)}`;
}
