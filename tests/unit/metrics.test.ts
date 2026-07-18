import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_PAGE_METRICS } from "../../store/source/demo-data";
import { CLASSIC_PROFILE } from "../../src/shared/constants";
import { capturePageMetrics, createSnapshot } from "../../src/shared/metrics";

describe("metrics", () => {
  afterEach(() => {
    document.body ?? document.documentElement.append(document.createElement("body"));
    vi.restoreAllMocks();
  });

  it("keeps raw numeric values and separates browser zoom from DPR", () => {
    const page = structuredClone(DEMO_PAGE_METRICS);
    page.viewport.layoutWidth = 1023.75;
    page.viewport.layoutHeight = 0;
    page.display.devicePixelRatio = 1.5;
    const snapshot = createSnapshot(page, 1.25, CLASSIC_PROFILE, 1234);
    expect(snapshot.capturedAt).toBe(1234);
    expect(snapshot.viewport.layout.width).toBe(1023.75);
    expect(snapshot.viewport.layout.aspectRatio).toBe(0);
    expect(snapshot.display.tabZoomPercent).toBe(125);
    expect(snapshot.display.devicePixelRatio).toBe(1.5);
    expect(snapshot.display.renderedPixelEstimate.width).toBe(1535.625);
  });

  it("normalizes non-finite input without leaking it into a snapshot", () => {
    const page = structuredClone(DEMO_PAGE_METRICS);
    page.viewport.layoutWidth = Number.NaN;
    page.display.devicePixelRatio = Number.POSITIVE_INFINITY;
    const snapshot = createSnapshot(page, Number.NaN, CLASSIC_PROFILE);
    expect(snapshot.viewport.layout.width).toBe(0);
    expect(snapshot.display.devicePixelRatio).toBe(1);
    expect(snapshot.display.tabZoom).toBe(1);
  });

  it("copies only whitelisted fields into exported snapshot sections", () => {
    const page = structuredClone(DEMO_PAGE_METRICS) as typeof DEMO_PAGE_METRICS & {
      screen: typeof DEMO_PAGE_METRICS.screen & { url?: string };
    };
    page.screen.url = "https://private.example";
    const snapshot = createSnapshot(page, 1, CLASSIC_PROFILE);
    expect(JSON.stringify(snapshot)).not.toContain("private.example");
    expect("url" in snapshot.screen).toBe(false);
  });

  it("uses the largest layout value for document extent", () => {
    vi.spyOn(document.documentElement, "scrollWidth", "get").mockReturnValue(1_440);
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(3_200);
    if (document.body) {
      vi.spyOn(document.body, "offsetWidth", "get").mockReturnValue(1_280);
      vi.spyOn(document.body, "offsetHeight", "get").mockReturnValue(2_400);
    }
    const metrics = capturePageMetrics();
    expect(metrics?.document).toEqual({ width: 1_440, height: 3_200 });
  });

  it("captures safely without body or visualViewport", () => {
    document.body?.remove();
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: undefined,
    });
    const metrics = capturePageMetrics();
    expect(metrics).not.toBeNull();
    expect(metrics?.typography.rootFontSize).toBeGreaterThan(0);
    expect(metrics?.viewport.visualScale).toBe(1);
  });
});
