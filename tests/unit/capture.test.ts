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
  captureScrollMatches,
  captureScrollTolerance,
  clipCaptureRegion,
  fullCaptureDimensions,
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

function geometryFixture({
  devicePixelRatio = 1.25,
  scrollbar = 0,
  viewportWidth = 803,
  viewportHeight = 901,
  documentWidth = 2251,
  documentHeight = 2487,
  bitmapWidth = Math.round(viewportWidth * devicePixelRatio),
  bitmapHeight = Math.round(viewportHeight * devicePixelRatio),
  edgeX = 0,
  edgeY = 0,
} = {}) {
  const bitmap = { width: bitmapWidth, height: bitmapHeight };
  const content = {
    width: bitmap.width - Math.round(scrollbar * devicePixelRatio),
    height: bitmap.height - Math.round(scrollbar * devicePixelRatio),
  };
  const page = {
    ...state,
    viewportWidth,
    viewportHeight,
    contentWidth: content.width / devicePixelRatio,
    contentHeight: content.height / devicePixelRatio,
    documentWidth,
    documentHeight,
    devicePixelRatio,
  };
  const physical = {
    width: Math.max(content.width, Math.round(documentWidth * devicePixelRatio) + edgeX),
    height: Math.max(content.height, Math.round(documentHeight * devicePixelRatio) + edgeY),
  };
  const at = (x: number, y: number, roundX = Math.floor, roundY = Math.ceil) => ({
    ...page,
    scrollX:
      Math.max(0, Math.min(physical.width - content.width, roundX(x * devicePixelRatio))) /
      devicePixelRatio,
    scrollY:
      Math.max(
        0,
        Math.min(physical.height - content.height, roundY(y * devicePixelRatio)),
      ) / devicePixelRatio,
  });
  return { page, bitmap, content, physical, at };
}

function assertLabelledCapture(
  fixture: ReturnType<typeof geometryFixture>,
  roundX = Math.floor,
  roundY = Math.ceil,
) {
  const { page, bitmap, content, physical, at } = fixture;
  const tiles = planFullCapture(page);
  const last = tiles.at(-1);
  if (!last) throw new Error("Missing final tile");
  const output = fullCaptureDimensions(
    page,
    at(last.scrollX, last.scrollY, roundX, roundY),
    bitmap,
  );
  expect(output).toEqual(physical);
  const labelsX = new Int32Array(output.width).fill(-1);
  const labelsY = new Int32Array(output.height).fill(-1);
  const rows = new Map<number, ReturnType<typeof tileDrawPlan>[]>();
  let paintedPixels = 0;
  for (const tile of tiles) {
    const current = at(tile.scrollX, tile.scrollY, roundX, roundY);
    expect(captureScrollMatches(current, tile.scrollX, tile.scrollY)).toBe(true);
    const draw = tileDrawPlan(tile.area, page, current, bitmap, output);
    const { source, destination } = draw;
    expect(source.x).toBeGreaterThanOrEqual(0);
    expect(source.y).toBeGreaterThanOrEqual(0);
    expect(source.x + source.width).toBeLessThanOrEqual(content.width);
    expect(source.y + source.height).toBeLessThanOrEqual(content.height);
    expect(source.width).toBe(destination.width);
    expect(source.height).toBe(destination.height);
    for (const coordinate of Object.values(source))
      expect(Number.isInteger(coordinate)).toBe(true);
    const originX = Math.round(current.scrollX * page.devicePixelRatio);
    const originY = Math.round(current.scrollY * page.devicePixelRatio);
    if (source.width > 0) expect(originX + source.x).toBe(destination.x);
    if (source.height > 0) expect(originY + source.y).toBe(destination.y);
    if (tile.area.y === 0) {
      for (let x = 0; x < source.width; x += 1)
        labelsX[destination.x + x] = originX + source.x + x;
    }
    if (tile.area.x === 0) {
      for (let y = 0; y < source.height; y += 1)
        labelsY[destination.y + y] = originY + source.y + y;
    }
    const row = rows.get(tile.area.y) ?? [];
    row.push(draw);
    rows.set(tile.area.y, row);
    paintedPixels += destination.width * destination.height;
  }
  let bottom = 0;
  for (const row of rows.values()) {
    let right = 0;
    let height = 0;
    for (const { destination } of row) {
      expect(destination.x).toBe(right);
      expect(destination.y).toBe(bottom);
      right += destination.width;
      height = destination.height;
    }
    expect(right).toBe(output.width);
    bottom += height;
  }
  expect(bottom).toBe(output.height);
  expect(paintedPixels).toBe(output.width * output.height);
  expect(labelsX.findIndex((label, x) => label !== x)).toBe(-1);
  expect(labelsY.findIndex((label, y) => label !== y)).toBe(-1);
}

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

  it("rejects unsafe canvases before allocation and after edge measurement", () => {
    expect(captureDimensions(8000, 6000, 1)).toEqual({ width: 8000, height: 6000 });
    expect(() => captureDimensions(8000, 6001, 1)).toThrow("48 megapixel");
    expect(() => captureDimensions(100, 16_381, 2)).toThrow("32,760");
    expect(() => captureDimensions(Number.POSITIVE_INFINITY, 100, 1)).toThrow("invalid");
    expect(() => captureDimensions(100, 100, 0)).toThrow("invalid");
    expect(() => captureDimensions(8000, 6000, 1, 6001 / 6000)).toThrow("48 megapixel");
    expect(() => captureDimensions(100, 16_381, 1, 2)).toThrow("32,760");
    expect(() => captureDimensions(100, 100, 1, 0)).toThrow("invalid");
    const page = {
      ...state,
      devicePixelRatio: 1,
      documentWidth: 8000,
      documentHeight: 6000,
    };
    expect(() =>
      fullCaptureDimensions(
        page,
        { ...page, scrollX: 7001, scrollY: 5500 },
        { width: 1015, height: 515 },
      ),
    ).toThrow("48 megapixel");
  });

  it("plans overlapping viewports with disjoint final ownership bands", () => {
    const tiles = planFullCapture(state);
    expect(tiles.map((tile) => tile.scrollY)).toEqual([0, 494, 752]);
    expect(tiles.map((tile) => tile.area)).toEqual([
      { x: 0, y: 0, width: 1000, height: 496 },
      { x: 0, y: 496, width: 1000, height: 496 },
      { x: 0, y: 992, width: 1000, height: 258 },
    ]);
    const last = tiles.at(-1);
    if (!last) throw new Error("Missing final tile");
    expect(
      tileDrawPlan(
        last.area,
        state,
        { ...state, scrollY: 750 },
        { width: 2030, height: 1030 },
        { width: 2000, height: 2500 },
      ),
    ).toEqual({
      source: { x: 0, y: 484, width: 2000, height: 516 },
      destination: { x: 0, y: 1984, width: 2000, height: 516 },
    });
    const wide = planFullCapture({ ...state, documentWidth: 1450 });
    expect(wide).toHaveLength(6);
    expect(
      wide.reduce((total, tile) => total + tile.area.width * tile.area.height, 0),
    ).toBe(1450 * 1250);
  });

  it("handles the reported 901 to 900.8 scroll quantization without missing content rows", () => {
    const fixture = geometryFixture({ documentHeight: 18000, documentWidth: 803 });
    expect(captureScrollMatches({ ...fixture.page, scrollY: 900.8 }, 0, 901)).toBe(true);
    expect(fixture.page.contentHeight).toBe(900.8);
    assertLabelledCapture(fixture, Math.floor, Math.floor);
    expect(fixture.physical.height).toBe(22500);
  });

  it.each(
    [0.25, 0.625, 0.8, 1.25, 1.5, 2, 4].flatMap((devicePixelRatio) =>
      [0, 15].flatMap((scrollbar) =>
        ["floor", "ceil"].map((direction) => ({ devicePixelRatio, scrollbar, direction })),
      ),
    ),
  )(
    "preserves physical pixel labels at $devicePixelRatio DPR with $scrollbar CSS-pixel gutters and $direction X quantization",
    ({ devicePixelRatio, scrollbar, direction }) => {
      const fixture = geometryFixture({
        devicePixelRatio,
        scrollbar,
        ...(devicePixelRatio === 4 ? { documentWidth: 1200, documentHeight: 2400 } : {}),
      });
      assertLabelledCapture(
        fixture,
        direction === "floor" ? Math.floor : Math.ceil,
        direction === "floor" ? Math.ceil : Math.floor,
      );
    },
  );

  it.each([-1, 1])(
    "uses a measured terminal edge %s pixel from the rounded DOM extent without moving content",
    (edge) => {
      assertLabelledCapture(
        geometryFixture({ edgeX: edge, edgeY: -edge, documentHeight: 2500 }),
      );
    },
  );

  it.each(["horizontal", "vertical"])(
    "shares canonical physical boundaries across many fractional %s strides",
    (axis) => {
      assertLabelledCapture(
        geometryFixture({
          devicePixelRatio: 0.625,
          scrollbar: 15,
          viewportWidth: axis === "horizontal" ? 1048 : 515,
          viewportHeight: axis === "horizontal" ? 515 : 1048,
          documentWidth: axis === "horizontal" ? 23000 : 500,
          documentHeight: axis === "horizontal" ? 500 : 23000,
        }),
      );
    },
  );

  it("supports a final band smaller than one physical pixel", () => {
    const fixture = geometryFixture({
      devicePixelRatio: 0.8,
      documentWidth: 1596,
      documentHeight: 1793,
    });
    const last = planFullCapture(fixture.page).at(-1);
    expect(last?.area.width).toBeLessThan(1 / 0.8);
    assertLabelledCapture(fixture);
  });

  it.each([
    {
      devicePixelRatio: 3,
      scrollbar: 31 / 3,
      viewportWidth: 268,
      viewportHeight: 300,
      documentWidth: 760,
      documentHeight: 1430,
      bitmapWidth: 803,
      bitmapHeight: 901,
      edgeX: 1,
      edgeY: 1,
    },
    {
      devicePixelRatio: 1.1,
      scrollbar: 0,
      viewportWidth: 730,
      viewportHeight: 819,
      documentWidth: 2178,
      documentHeight: 4075,
      bitmapWidth: 803,
      bitmapHeight: 901,
      edgeX: 0,
      edgeY: 0,
    },
  ])("assigns a rounded terminal boundary once at $devicePixelRatio DPR", (options) => {
    const fixture = geometryFixture(options);
    const tiles = planFullCapture(fixture.page);
    expect(tiles.every((tile) => tile.area.width > 0 && tile.area.height > 0)).toBe(true);
    assertLabelledCapture(fixture, Math.floor, Math.floor);
    assertLabelledCapture(fixture, Math.ceil, Math.ceil);
  });

  it("retains the initial extent through growth and rejects shrink or an unreachable edge", () => {
    const { page, bitmap, at } = geometryFixture({ scrollbar: 15, edgeX: 1, edgeY: -1 });
    const last = planFullCapture(page).at(-1);
    if (!last) throw new Error("Missing final tile");
    const current = at(last.scrollX, last.scrollY);
    const output = fullCaptureDimensions(page, current, bitmap);
    const grown = {
      ...page,
      documentWidth: page.documentWidth + 100,
      documentHeight: page.documentHeight + 100,
      scrollX: Math.floor(last.scrollX * 1.25) / 1.25,
      scrollY: Math.floor(last.scrollY * 1.25) / 1.25,
    };
    expect(captureScrollMatches(grown, last.scrollX, last.scrollY)).toBe(true);
    const nominal = captureDimensions(
      page.documentWidth,
      page.documentHeight,
      page.devicePixelRatio,
    );
    expect(fullCaptureDimensions(page, grown, bitmap)).toEqual(nominal);
    for (const dimensions of [output, nominal]) {
      const draw = tileDrawPlan(last.area, page, grown, bitmap, dimensions);
      expect(draw.source.x + Math.round(grown.scrollX * 1.25)).toBe(draw.destination.x);
      expect(draw.source.y + Math.round(grown.scrollY * 1.25)).toBe(draw.destination.y);
      expect(draw.destination.x + draw.destination.width).toBe(dimensions.width);
      expect(draw.destination.y + draw.destination.height).toBe(dimensions.height);
    }
    expect(() =>
      fullCaptureDimensions(
        page,
        { ...current, documentHeight: page.documentHeight - 1 },
        bitmap,
      ),
    ).toThrow("smaller");
    expect(() =>
      tileDrawPlan(
        last.area,
        page,
        { ...current, documentHeight: page.documentHeight - 1 },
        bitmap,
        output,
      ),
    ).toThrow("layout");
    expect(() =>
      fullCaptureDimensions(page, { ...current, scrollY: current.scrollY - 10 }, bitmap),
    ).toThrow("capture edge");
  });

  it.each([0.25, 0.8, 1.25, 2, 4])(
    "rejects movement beyond the requested-scroll tolerance at %s DPR",
    (devicePixelRatio) => {
      const page = { ...state, documentWidth: 3000, devicePixelRatio };
      const tolerance = captureScrollTolerance(page);
      for (const direction of [-1, 1]) {
        expect(
          captureScrollMatches(
            { ...page, scrollX: 100 + direction * tolerance, scrollY: 100 },
            100,
            100,
          ),
        ).toBe(true);
        expect(
          captureScrollMatches(
            { ...page, scrollX: 100 + direction * (tolerance + 0.01), scrollY: 100 },
            100,
            100,
          ),
        ).toBe(false);
        expect(
          captureScrollMatches(
            { ...page, scrollX: 100, scrollY: 100 + direction * (tolerance + 0.01) },
            100,
            100,
          ),
        ).toBe(false);
      }
    },
  );

  it("bounds frame count and rejects viewports too small for overlap", () => {
    expect(planFullCapture({ ...state, documentHeight: 19840 })).toHaveLength(40);
    expect(() => planFullCapture({ ...state, documentHeight: 19841 })).toThrow("40 frames");
    expect(() =>
      planFullCapture({ ...state, contentHeight: 4, viewportHeight: 4 }),
    ).toThrow("too small");
    expect(() => planFullCapture({ ...state, contentWidth: 4, viewportWidth: 4 })).toThrow(
      "too small",
    );
    expect(() =>
      assertCaptureState(state, { ...state, documentHeight: 50000 }),
    ).not.toThrow();
  });

  it.each([
    {
      viewportWidth: 803,
      viewportHeight: 901,
      width: 1004,
      height: 1126,
      devicePixelRatio: 1.25,
    },
    {
      viewportWidth: 901,
      viewportHeight: 803,
      width: 1126,
      height: 1004,
      devicePixelRatio: 1.25,
    },
    {
      viewportWidth: 803,
      viewportHeight: 901,
      width: 3213,
      height: 3602,
      devicePixelRatio: 4,
    },
  ])(
    "accepts independently rounded bitmap axes at $devicePixelRatio DPR",
    ({ viewportWidth, viewportHeight, width, height, devicePixelRatio }) => {
      const viewport = { viewportWidth, viewportHeight, devicePixelRatio };
      const bitmap = { width, height };
      const scale = captureBitmapScale(viewport, bitmap);
      expect(captureBitmapScale(viewport, bitmap, bitmap)).toEqual(scale);
      expect(captureDimensions(viewportWidth, viewportHeight, scale.x, scale.y)).toEqual(
        bitmap,
      );
      assertLabelledCapture(
        geometryFixture({
          ...viewport,
          bitmapWidth: width,
          bitmapHeight: height,
          ...(devicePixelRatio === 4 ? { documentWidth: 1200, documentHeight: 2400 } : {}),
        }),
      );
    },
  );

  it("rejects changed or incompatible bitmap dimensions", () => {
    const viewport = { viewportWidth: 803, viewportHeight: 901, devicePixelRatio: 1.25 };
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
    const fixture = geometryFixture();
    expect(() =>
      fullCaptureDimensions(fixture.page, fixture.page, { width: 1000, height: 1100 }),
    ).toThrow("does not match");
  });

  it("reads precise usable visual viewport dimensions", () => {
    vi.stubGlobal("visualViewport", {
      width: 803.25,
      height: 900.5,
      scale: 1,
      offsetLeft: 0,
      offsetTop: 0,
    });
    const current = new CapturePage("precise-viewport").read();
    expect(current.contentWidth).toBe(803.25);
    expect(current.contentHeight).toBe(900.5);
    expect(current.viewportWidth).toBe(innerWidth);
    expect(current.viewportHeight).toBe(innerHeight);
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
