import { describe, expect, it } from "vitest";
import { DEMO_PAGE_METRICS } from "../../store/source/demo-data";
import {
  MESSAGE_TYPES,
  isBridgeResponse,
  isLiveBridgeMessage,
  isPageMetrics,
} from "../../src/shared/protocol";

describe("bridge protocol validation", () => {
  it("accepts only complete, finite metric contracts", () => {
    expect(isPageMetrics(DEMO_PAGE_METRICS)).toBe(true);
    expect(
      isPageMetrics({
        ...DEMO_PAGE_METRICS,
        viewport: { ...DEMO_PAGE_METRICS.viewport, layoutWidth: Number.NaN },
      }),
    ).toBe(false);
    expect(isPageMetrics({ viewport: {} })).toBe(false);
  });

  it("rejects malformed snapshot and live responses", () => {
    expect(
      isBridgeResponse({
        type: MESSAGE_TYPES.snapshotResponse,
        ok: true,
        metrics: DEMO_PAGE_METRICS,
      }),
    ).toBe(true);
    expect(isBridgeResponse({ type: MESSAGE_TYPES.snapshotResponse, ok: true })).toBe(
      false,
    );
    expect(isLiveBridgeMessage({ type: MESSAGE_TYPES.metricsUpdate, metrics: {} })).toBe(
      false,
    );
    expect(
      isLiveBridgeMessage({
        type: MESSAGE_TYPES.bridgeError,
        ok: false,
        code: "NOT_A_REAL_ERROR",
      }),
    ).toBe(false);
  });
});
