import { afterEach, describe, expect, it, vi } from "vitest";
import { abortableDelay, throwIfAborted } from "../../src/capture/async";
import { captureFilename, pngDataUrlToBlob, runCapture } from "../../src/capture/client";
import { CaptureConnection } from "../../src/capture/connection";
import { CapturePage } from "../../src/capture/page";
import {
  assertCaptureState,
  type CapturePageState,
  captureBitmapScale,
  captureDimensions,
  clipCaptureRegion,
  isCapturePageState,
  isCaptureRequest,
  planFullCapture,
  tileDrawPlan,
} from "../../src/shared/capture";

const state: CapturePageState = {
  documentToken: "document-a",
  viewportWidth: 1015,
  viewportHeight: 515,
  contentWidth: 1000,
  contentHeight: 500,
  documentWidth: 1000,
  documentHeight: 1250,
  scrollX: 0,
  scrollY: 0,
  devicePixelRatio: 2,
  visualScale: 1,
  visualOffsetX: 0,
  visualOffsetY: 0,
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("capture geometry and limits", () => {
  it("clips a selection to the visible viewport", () => {
    expect(clipCaptureRegion({ x: -10, y: 20, width: 90, height: 500 }, 320, 240)).toEqual({
      x: 0,
      y: 20,
      width: 80,
      height: 220,
    });
    expect(() =>
      clipCaptureRegion({ x: 400, y: 10, width: 30, height: 20 }, 320, 240),
    ).toThrow("at least 2");
    expect(() =>
      clipCaptureRegion({ x: Number.NaN, y: 10, width: 30, height: 20 }, 320, 240),
    ).toThrow("invalid");
  });

  it("preserves physical output size at fractional and high pixel ratios", () => {
    expect(captureDimensions(800, 600, 1)).toEqual({ width: 800, height: 600 });
    expect(captureDimensions(800, 600, 1.25)).toEqual({ width: 1000, height: 750 });
    expect(captureDimensions(800, 600, 2)).toEqual({ width: 1600, height: 1200 });
  });

  it("rejects unsafe canvases before allocation", () => {
    expect(captureDimensions(8000, 6000, 1)).toEqual({ width: 8000, height: 6000 });
    expect(() => captureDimensions(8000, 6001, 1)).toThrow("48 megapixel");
    expect(() => captureDimensions(100, 16_381, 2)).toThrow("32,760");
    expect(() => captureDimensions(Number.POSITIVE_INFINITY, 100, 1)).toThrow("invalid");
    expect(() => captureDimensions(100, 100, 0)).toThrow("invalid");
    expect(() => captureDimensions(8000, 6000, 1, 6001 / 6000)).toThrow("48 megapixel");
    expect(() => captureDimensions(100, 16_381, 1, 2)).toThrow("32,760");
    expect(() => captureDimensions(100, 100, 1, 0)).toThrow("invalid");
  });

  it("plans the final clamped tile without duplicating the overlap band", () => {
    const tiles = planFullCapture(state);
    expect(tiles.map((tile) => tile.scrollY)).toEqual([0, 500, 750]);
    expect(tiles.map((tile) => tile.area)).toEqual([
      { x: 0, y: 0, width: 1000, height: 500 },
      { x: 0, y: 500, width: 1000, height: 500 },
      { x: 0, y: 1000, width: 1000, height: 250 },
    ]);
    const last = tiles[2];
    if (!last) throw new Error("Missing final tile");
    expect(tileDrawPlan(last.area, 0, 750, 2)).toEqual({
      source: { x: 0, y: 500, width: 2000, height: 500 },
      destination: { x: 0, y: 2000, width: 2000, height: 500 },
    });
  });

  it("covers horizontal overflow and partial final rows exactly once", () => {
    const wide = { ...state, documentWidth: 1450, documentHeight: 1250 };
    const tiles = planFullCapture(wide);
    expect(tiles).toHaveLength(6);
    expect(tiles.map((tile) => [tile.scrollX, tile.scrollY])).toEqual([
      [0, 0],
      [450, 0],
      [0, 500],
      [450, 500],
      [0, 750],
      [450, 750],
    ]);
    expect(
      tiles.reduce((total, tile) => total + tile.area.width * tile.area.height, 0),
    ).toBe(1450 * 1250);
    expect(tiles.at(-1)?.area).toEqual({ x: 1000, y: 1000, width: 450, height: 250 });
  });

  it("uses shared rounded boundaries without seams at fractional scale", () => {
    const top = tileDrawPlan({ x: 0, y: 0, width: 803, height: 501 }, 0, 0, 1.25);
    const bottom = tileDrawPlan({ x: 0, y: 501, width: 803, height: 213 }, 0, 213, 1.25);
    expect(top.destination.y + top.destination.height).toBe(bottom.destination.y);
    expect(bottom.destination.y + bottom.destination.height).toBe(Math.round(714 * 1.25));
  });

  it.each([
    { viewportWidth: 803, viewportHeight: 901, width: 1004, height: 1126 },
    { viewportWidth: 901, viewportHeight: 803, width: 1126, height: 1004 },
  ])(
    "fits independently rounded bitmap axes for $viewportWidth × $viewportHeight CSS pixels",
    ({ viewportWidth, viewportHeight, width, height }) => {
      const bitmap = { width, height };
      const viewport = { viewportWidth, viewportHeight };
      const { x: scaleX, y: scaleY } = captureBitmapScale(viewport, bitmap);
      expect(captureBitmapScale(viewport, bitmap, bitmap)).toEqual({
        x: scaleX,
        y: scaleY,
      });
      const draw = tileDrawPlan(
        { x: 0, y: 0, width: viewportWidth, height: viewportHeight },
        0,
        0,
        scaleX,
        scaleY,
      );
      expect(captureDimensions(viewportWidth, viewportHeight, scaleX, scaleY)).toEqual({
        width,
        height,
      });
      expect(draw.source.x).toBe(0);
      expect(draw.source.y).toBe(0);
      expect(draw.source.width).toBeCloseTo(width, 10);
      expect(draw.source.height).toBeCloseTo(height, 10);
      expect(draw.destination).toEqual({ x: 0, y: 0, width, height });
    },
  );

  it.each([
    { devicePixelRatio: 0.8, finalWidth: 137, finalHeight: 219, scrollbar: 0 },
    { devicePixelRatio: 1.1, finalWidth: 137, finalHeight: 219, scrollbar: 15 },
    { devicePixelRatio: 1.25, finalWidth: 137, finalHeight: 219, scrollbar: 0 },
    { devicePixelRatio: 1.5, finalWidth: 137, finalHeight: 219, scrollbar: 15 },
    { devicePixelRatio: 0.8, finalWidth: 1, finalHeight: 1, scrollbar: 0 },
  ])(
    "covers clamped final tiles at $devicePixelRatio DPR with a $finalWidth × $finalHeight final band",
    ({ devicePixelRatio, finalWidth, finalHeight, scrollbar }) => {
      const viewportWidth = 803;
      const viewportHeight = 901;
      const contentWidth = viewportWidth - scrollbar;
      const contentHeight = viewportHeight - scrollbar;
      const page = {
        ...state,
        viewportWidth,
        viewportHeight,
        contentWidth,
        contentHeight,
        documentWidth: contentWidth * 2 + finalWidth,
        documentHeight: contentHeight * 2 + finalHeight,
        devicePixelRatio,
      };
      const bitmap = {
        width: Math.round(viewportWidth * devicePixelRatio),
        height: Math.round(viewportHeight * devicePixelRatio),
      };
      const scale = captureBitmapScale(page, bitmap);
      const dimensions = captureDimensions(
        page.documentWidth,
        page.documentHeight,
        scale.x,
        scale.y,
      );
      const tiles = planFullCapture(page);
      const draws = tiles.map((tile) =>
        tileDrawPlan(tile.area, tile.scrollX, tile.scrollY, scale.x, scale.y),
      );
      expect(draws).toHaveLength(9);
      for (const [index, draw] of draws.entries()) {
        expect(draw.source.x).toBeGreaterThanOrEqual(0);
        expect(draw.source.y).toBeGreaterThanOrEqual(0);
        expect(draw.source.width).toBeGreaterThan(0);
        expect(draw.source.height).toBeGreaterThan(0);
        expect(draw.source.x + draw.source.width).toBeLessThanOrEqual(bitmap.width + 1e-7);
        expect(draw.source.y + draw.source.height).toBeLessThanOrEqual(
          bitmap.height + 1e-7,
        );
        expect(draw.destination.width).toBeGreaterThanOrEqual(0);
        expect(draw.destination.height).toBeGreaterThanOrEqual(0);
        const previousColumn = index % 3 ? draws[index - 1]?.destination : undefined;
        const previousRow = index >= 3 ? draws[index - 3]?.destination : undefined;
        expect(draw.destination.x).toBe(
          previousColumn ? previousColumn.x + previousColumn.width : 0,
        );
        expect(draw.destination.y).toBe(
          previousRow ? previousRow.y + previousRow.height : 0,
        );
      }
      const last = draws.at(-1);
      if (!last) throw new Error("Missing final tile");
      expect(last.source.x).toBeGreaterThan(0);
      expect(last.source.y).toBeGreaterThan(0);
      expect(last.destination.x + last.destination.width).toBe(dimensions.width);
      expect(last.destination.y + last.destination.height).toBe(dimensions.height);
      expect(
        draws.reduce(
          (total, draw) => total + draw.destination.width * draw.destination.height,
          0,
        ),
      ).toBe(dimensions.width * dimensions.height);
    },
  );

  it("rejects any bitmap dimension change after the first frame", () => {
    const viewport = { viewportWidth: 803, viewportHeight: 901 };
    const first = { width: 1004, height: 1126 };
    for (const bitmap of [
      { width: 1003, height: 1126 },
      { width: 1005, height: 1126 },
      { width: 1004, height: 1125 },
      { width: 1004, height: 1127 },
      { width: 1606, height: 1802 },
    ]) {
      expect(() => captureBitmapScale(viewport, bitmap, first)).toThrow(
        "Screenshot dimensions changed",
      );
    }
  });

  it("rejects bitmap axes that cannot describe one rounded viewport scale", () => {
    const viewport = { viewportWidth: 803, viewportHeight: 901 };
    for (const bitmap of [
      { width: 1004, height: 1130 },
      { width: 1008, height: 1126 },
      { width: 0, height: 1126 },
      { width: 1004, height: Number.NaN },
    ]) {
      expect(() => captureBitmapScale(viewport, bitmap)).toThrow(
        "Screenshot dimensions changed",
      );
    }
  });

  it("bounds the initial document extent without chasing an infinite feed", () => {
    expect(planFullCapture({ ...state, documentHeight: 20_000 })).toHaveLength(40);
    expect(() => planFullCapture({ ...state, documentHeight: 20_001 })).toThrow(
      "40 frames",
    );
    const plan = planFullCapture(state);
    const grown = { ...state, documentHeight: 50_000 };
    expect(() => assertCaptureState(state, grown)).not.toThrow();
    expect(plan).toHaveLength(3);
    expect(plan.at(-1)?.area.y).toBe(1000);
  });

  it("rejects navigation, pinch zoom, viewport changes and scale changes", () => {
    expect(() => assertCaptureState(state, { ...state, documentToken: "new" })).toThrow(
      "navigated",
    );
    for (const update of [
      { viewportWidth: 800 },
      { contentWidth: 980 },
      { devicePixelRatio: 1.25 },
      { visualScale: 1.5 },
      { visualOffsetX: 10 },
    ]) {
      expect(() => assertCaptureState(state, { ...state, ...update })).toThrow(
        "viewport or zoom",
      );
    }
    expect(() => assertCaptureState(state, { ...state, scrollY: 400 })).not.toThrow();
  });
});

describe("capture boundaries", () => {
  it("validates finite messages and complete page state", () => {
    expect(isCaptureRequest({ id: 1, action: "scroll", x: 0, y: 500 })).toBe(true);
    expect(
      isCaptureRequest({
        id: 2,
        action: "prepare",
        options: { mode: "full", includeOverlays: false, hideFixed: true },
      }),
    ).toBe(true);
    expect(isCaptureRequest({ id: 1, action: "scroll", x: 0, y: Number.NaN })).toBe(false);
    expect(isCaptureRequest({ id: -1, action: "finish" })).toBe(false);
    expect(
      isCaptureRequest({ id: 1, action: "prepare", options: { mode: "all-tabs" } }),
    ).toBe(false);
    expect(isCapturePageState(state)).toBe(true);
    expect(isCapturePageState({ ...state, viewportWidth: Number.POSITIVE_INFINITY })).toBe(
      false,
    );
    expect(isCapturePageState({ ...state, devicePixelRatio: 0 })).toBe(false);
  });

  it("decodes PNG bytes directly without a network fetch", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const blob = pngDataUrlToBlob("data:image/png;base64,iVBORw0KGgo=");
    expect(blob.type).toBe("image/png");
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
    expect(fetch).not.toHaveBeenCalled();
    expect(() => pngDataUrlToBlob("https://example.com/image.png")).toThrow("unsupported");
  });

  it("uses generic timestamp filenames without page identifiers", () => {
    expect(captureFilename(new Date("2026-11-10T13:14:15.123Z"))).toBe(
      "pixelparity-2026-11-10T13-14-15Z.png",
    );
  });

  it("cancels an in-progress rate-limit wait promptly and clears its timer", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const delay = abortableDelay(650, controller.signal);
    const rejection = expect(delay).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejection;
    expect(vi.getTimerCount()).toBe(0);
    expect(() => throwIfAborted(controller.signal)).toThrow();
  });

  it("does not start a capture that is already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      runCapture({
        tabId: 42,
        options: { mode: "viewport", includeOverlays: false, hideFixed: true },
        signal: controller.signal,
        onProgress: vi.fn(),
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  it("rejects a second panel capture when the origin lock is occupied", async () => {
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request: vi.fn(async (_name, _options, callback) => callback(null)) },
    });
    await expect(
      runCapture({
        tabId: 42,
        options: { mode: "viewport", includeOverlays: false, hideFixed: true },
        signal: new AbortController().signal,
        onProgress: vi.fn(),
      }),
    ).rejects.toThrow("Another PixelParity capture");
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    Reflect.deleteProperty(navigator, "locks");
  });
});

describe("page restoration", () => {
  it("restores original style values, priorities, and both scroll axes idempotently", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("visualViewport", null);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 16),
    );
    vi.stubGlobal("cancelAnimationFrame", clearTimeout);
    const priorX = Object.getOwnPropertyDescriptor(window, "scrollX");
    const priorY = Object.getOwnPropertyDescriptor(window, "scrollY");
    Object.defineProperty(window, "scrollX", { configurable: true, value: 37 });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 212 });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const rootStyle = document.documentElement.getAttribute("style");
    document.documentElement.style.setProperty("scroll-behavior", "smooth", "important");
    document.documentElement.style.setProperty(
      "scroll-snap-type",
      "y mandatory",
      "important",
    );
    const overlay = document.createElement("div");
    overlay.dataset.pixelparityOverlay = "";
    overlay.style.setProperty("visibility", "visible", "important");
    const fixed = document.createElement("header");
    fixed.style.position = "fixed";
    const sticky = document.createElement("nav");
    sticky.style.setProperty("position", "sticky", "important");
    sticky.style.setProperty("inset", "8px 10px", "important");
    sticky.style.setProperty("inset-block-start", "12px", "important");
    document.body.append(overlay, fixed, sticky);
    try {
      const page = new CapturePage("test-document");
      const preparation = page.prepare({
        mode: "full",
        includeOverlays: false,
        hideFixed: true,
      });
      await vi.advanceTimersByTimeAsync(200);
      await preparation;
      expect(document.documentElement.style.scrollBehavior).toBe("auto");
      expect(overlay.style.visibility).toBe("hidden");
      expect(fixed.style.visibility).toBe("hidden");
      expect(sticky.style.position).toBe("relative");
      expect(sticky.style.getPropertyValue("inset")).toBe("auto");
      expect(sticky.style.getPropertyValue("inset-block")).toBe("auto");
      page.restore();
      page.restore();
      expect(scrollTo).toHaveBeenCalledExactlyOnceWith({
        left: 37,
        top: 212,
        behavior: "instant",
      });
      expect(document.documentElement.style.scrollBehavior).toBe("smooth");
      expect(document.documentElement.style.getPropertyPriority("scroll-behavior")).toBe(
        "important",
      );
      expect(document.documentElement.style.scrollSnapType).toBe("y mandatory");
      expect(overlay.style.visibility).toBe("visible");
      expect(overlay.style.getPropertyPriority("visibility")).toBe("important");
      expect(fixed.style.getPropertyValue("visibility")).toBe("");
      expect(sticky.style.position).toBe("sticky");
      expect(sticky.style.getPropertyValue("inset")).toBe("8px 10px");
      expect(sticky.style.getPropertyValue("inset-block-start")).toBe("12px");
      expect(sticky.style.getPropertyPriority("inset")).toBe("important");
      expect(sticky.style.getPropertyPriority("position")).toBe("important");
    } finally {
      overlay.remove();
      fixed.remove();
      sticky.remove();
      if (rootStyle === null) document.documentElement.removeAttribute("style");
      else document.documentElement.setAttribute("style", rootStyle);
      if (priorX) Object.defineProperty(window, "scrollX", priorX);
      if (priorY) Object.defineProperty(window, "scrollY", priorY);
    }
  });
});

function fakePort() {
  const messages = new Set<(value: unknown) => void>();
  const disconnects = new Set<() => void>();
  const port = {
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    onMessage: {
      addListener: (listener: (value: unknown) => void) => messages.add(listener),
      removeListener: (listener: (value: unknown) => void) => messages.delete(listener),
    },
    onDisconnect: {
      addListener: (listener: () => void) => disconnects.add(listener),
      removeListener: (listener: () => void) => disconnects.delete(listener),
    },
  };
  return { port: port as unknown as chrome.runtime.Port, messages, disconnects };
}

describe("capture port lifecycle", () => {
  it("rejects pending work on page disconnect and releases heartbeat timers", async () => {
    vi.useFakeTimers();
    const fake = fakePort();
    const connection = new CaptureConnection(fake.port);
    const request = connection.request({ action: "state" });
    const rejected = expect(request).rejects.toThrow("tab, page, or viewport changed");
    for (const callback of fake.disconnects) callback();
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
    connection.close();
  });

  it("ignores unrelated responses and stops waiting when cancelled", async () => {
    vi.useFakeTimers();
    const fake = fakePort();
    const connection = new CaptureConnection(fake.port);
    const controller = new AbortController();
    const request = connection.request({ action: "select" }, controller.signal);
    for (const callback of fake.messages) callback({ id: 999, ok: true, region: { x: 0 } });
    const rejected = expect(request).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await rejected;
    connection.close();
    expect(fake.messages.size).toBe(0);
    expect(fake.disconnects.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
