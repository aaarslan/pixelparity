import { describe, expect, it, vi } from "vitest";
import {
  createProfileId,
  getActiveBreakpoint,
  validateCustomProfiles,
  validateProfile,
} from "../../src/shared/breakpoints";
import { CLASSIC_PROFILE } from "../../src/shared/constants";
import type { BreakpointProfile } from "../../src/shared/types";

describe("breakpoint profiles", () => {
  it.each([
    [0, "XS"],
    [575, "XS"],
    [576, "SM"],
    [767, "SM"],
    [768, "MD"],
    [991, "MD"],
    [992, "LG"],
    [1199, "LG"],
    [1200, "XL"],
    [1399, "XL"],
    [1400, "XXL"],
  ])("maps width %i to %s at exact boundaries", (width, label) => {
    expect(getActiveBreakpoint(width, CLASSIC_PROFILE).label).toBe(label);
  });

  it("rejects duplicate labels, fractional widths, and unordered points", () => {
    const profile: BreakpointProfile = {
      id: "custom-test",
      name: "Test",
      points: [
        { id: "a", label: "Wide", minWidth: 100 },
        { id: "b", label: "wide", minWidth: 99.5 },
      ],
    };
    const result = validateProfile(profile);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/unique/i);
    expect(result.errors.join(" ")).toMatch(/integer/i);
    expect(result.errors.join(" ")).toMatch(/increasing/i);
  });

  it("caps custom profiles and protects built-in IDs", () => {
    const profiles = Array.from({ length: 11 }, (_, index) => ({
      id: index === 0 ? CLASSIC_PROFILE.id : `custom-${index}`,
      name: `Profile ${index}`,
      points: [{ id: `point-${index}`, label: "Base", minWidth: 0 }],
    }));
    const result = validateCustomProfiles(profiles);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/at most 10/i);
    expect(result.errors.join(" ")).toMatch(/ID must be unique/i);
  });

  it("caps each profile at twelve breakpoint points", () => {
    const profile: BreakpointProfile = {
      id: "custom-too-many",
      name: "Too many",
      points: Array.from({ length: 13 }, (_, index) => ({
        id: `point-${index}`,
        label: `BP${index}`,
        minWidth: index * 100,
      })),
    };
    const result = validateProfile(profile);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/at most 12/i);
  });

  it("creates readable, collision-resistant custom IDs", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "12345678-abcd-4000-8000-000000000000" });
    expect(createProfileId("Product UI")).toBe("custom-product-ui-12345678");
    vi.unstubAllGlobals();
  });
});
