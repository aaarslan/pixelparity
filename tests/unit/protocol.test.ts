import { describe, expect, it } from "vitest";
import {
  isBridgeResponse,
  isLiveBridgeMessage,
  isPageMetrics,
  MESSAGE_TYPES,
} from "../../src/shared/protocol";
import { DEMO_PAGE_METRICS } from "../fixtures/metrics";

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
