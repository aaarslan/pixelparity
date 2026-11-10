import { afterEach, describe, expect, it, vi } from "vitest";
import { runCapture } from "../../src/capture/client";
import type {
  CapturePageState,
  CaptureRequest,
  CaptureResponse,
  CaptureResult,
} from "../../src/shared/capture";

interface CaptureFixture {
  axis: "vertical" | "horizontal";
  viewportWidth: number;
  viewportHeight: number;
  documentWidth: number;
  documentHeight: number;
  bitmapWidth: number;
  bitmapHeight: number;
  outputWidth: number;
  outputHeight: number;
  devicePixelRatio: number;
  quantization: "nearest" | "floor";
}

const fixtures = [
  {
    axis: "vertical",
    viewportWidth: 803,
    viewportHeight: 901,
    documentWidth: 803,
    documentHeight: 2500,
    bitmapWidth: 1004,
    bitmapHeight: 1126,
    outputWidth: 1004,
    outputHeight: 3125,
    devicePixelRatio: 1.25,
    quantization: "nearest",
  },
  {
    axis: "horizontal",
    viewportWidth: 901,
    viewportHeight: 803,
    documentWidth: 2500,
    documentHeight: 803,
    bitmapWidth: 1126,
    bitmapHeight: 1004,
    outputWidth: 3125,
    outputHeight: 1004,
    devicePixelRatio: 1.25,
    quantization: "nearest",
  },
  {
    axis: "vertical",
    viewportWidth: 803,
    viewportHeight: 901,
    documentWidth: 803,
    documentHeight: 2500,
    bitmapWidth: 642,
    bitmapHeight: 721,
    outputWidth: 642,
    outputHeight: 2000,
    devicePixelRatio: 0.8,
    quantization: "floor",
  },
  {
    axis: "vertical",
    viewportWidth: 803,
    viewportHeight: 901,
    documentWidth: 803,
    documentHeight: 2500,
    bitmapWidth: 1004,
    bitmapHeight: 1126,
    outputWidth: 1004,
    outputHeight: 3126,
    devicePixelRatio: 1.25,
    quantization: "nearest",
  },
  {
    axis: "horizontal",
    viewportWidth: 901,
    viewportHeight: 803,
    documentWidth: 2500,
    documentHeight: 803,
    bitmapWidth: 721,
    bitmapHeight: 642,
    outputWidth: 2000,
    outputHeight: 642,
    devicePixelRatio: 0.8,
    quantization: "floor",
  },
] as const satisfies readonly CaptureFixture[];

function captureHarness(
  fixture: CaptureFixture = fixtures[0],
  failure?: "movement" | "subpixel-movement" | "bitmap-resize",
) {
  vi.useFakeTimers();
  const original: CapturePageState = {
    documentToken: "capture-document",
    viewportWidth: fixture.viewportWidth,
    viewportHeight: fixture.viewportHeight,
    contentWidth: fixture.viewportWidth,
    contentHeight: fixture.viewportHeight,
    documentWidth: fixture.documentWidth,
    documentHeight: fixture.documentHeight,
    scrollX: fixture.axis === "horizontal" ? 73.6 : 0,
    scrollY: fixture.axis === "vertical" ? 73.6 : 0,
    devicePixelRatio: fixture.devicePixelRatio,
    visualScale: 1,
    visualOffsetX: 0,
    visualOffsetY: 0,
  };
  let state = { ...original };
  let prepared = false;
  let captureCount = 0;
  const requests: CaptureRequest[] = [];
  const scrolls: { requested: number; actual: number }[] = [];
  const messages = new Set<(response: CaptureResponse) => void>();
  const disconnects = new Set<() => void>();
  const frames: { originX: number; originY: number }[] = [];
  const quantize = fixture.quantization === "floor" ? Math.floor : Math.round;
  const scrollOffset = (requested: number, maximum: number) =>
    quantize(Math.max(0, Math.min(requested, maximum)) * state.devicePixelRatio) /
    state.devicePixelRatio;
  const port = {
    onMessage: {
      addListener: (listener: (response: CaptureResponse) => void) =>
        messages.add(listener),
      removeListener: (listener: (response: CaptureResponse) => void) =>
        messages.delete(listener),
    },
    onDisconnect: {
      addListener: (listener: () => void) => disconnects.add(listener),
      removeListener: (listener: () => void) => disconnects.delete(listener),
    },
    postMessage: vi.fn((request: CaptureRequest) => {
      requests.push(request);
      if (request.action === "prepare") prepared = true;
      if (request.action === "scroll") {
        state.scrollX = scrollOffset(
          request.x,
          (fixture.outputWidth - fixture.bitmapWidth) / fixture.devicePixelRatio,
        );
        state.scrollY = scrollOffset(
          request.y,
          (fixture.outputHeight - fixture.bitmapHeight) / fixture.devicePixelRatio,
        );
        scrolls.push({
          requested: fixture.axis === "vertical" ? request.y : request.x,
          actual: fixture.axis === "vertical" ? state.scrollY : state.scrollX,
        });
      }
      if (request.action === "finish") {
        state = { ...original };
        prepared = false;
      }
      for (const listener of messages)
        listener({ id: request.id, ok: true, state: { ...state } });
    }),
    disconnect: vi.fn(),
  };
  const events = Array.from({ length: 5 }, () => ({
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
  const captureVisibleTab = vi.fn(async () => {
    captureCount += 1;
    if (captureCount === 2 && failure === "movement") state.scrollY += 3;
    if (captureCount === 2 && failure === "subpixel-movement") state.scrollY += 0.25;
    frames.push({
      originX: Math.round(state.scrollX * fixture.devicePixelRatio),
      originY: Math.round(state.scrollY * fixture.devicePixelRatio),
    });
    return "data:image/png;base64,iVBORw0KGgo=";
  });
  vi.stubGlobal("chrome", {
    runtime: { id: "test-extension" },
    scripting: {
      executeScript: vi.fn(async () => [{ frameId: 0, documentId: "capture-document" }]),
    },
    tabs: {
      get: vi.fn(async () => ({ id: 42, windowId: 7, active: true, status: "complete" })),
      getZoom: vi.fn(async () => fixture.devicePixelRatio),
      connect: vi.fn(() => port),
      captureVisibleTab,
      onActivated: events[0],
      onUpdated: events[1],
      onRemoved: events[2],
      onZoomChange: events[3],
    },
    windows: {
      get: vi.fn(async () => ({ id: 7, focused: true })),
      onFocusChanged: events[4],
    },
  });
  vi.stubGlobal("navigator", {
    locks: {
      request: vi.fn(
        async (name: string, _options: unknown, callback: (lock: Lock) => unknown) =>
          callback({ name, mode: "exclusive" }),
      ),
    },
  });
  const bitmaps: { width: number; height: number; close: ReturnType<typeof vi.fn> }[] = [];
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => {
      const frame = frames[captureCount - 1];
      if (!frame) throw new Error("No captured frame to decode.");
      const bitmap = {
        ...frame,
        width: fixture.bitmapWidth,
        height:
          fixture.bitmapHeight +
          (captureCount === 2 && failure === "bitmap-resize" ? 1 : 0),
        close: vi.fn(),
      };
      bitmaps.push(bitmap);
      return bitmap;
    }),
  );
  const canvases: { width: number; height: number }[] = [];
  const painted: { x: number; y: number; width: number; height: number }[] = [];
  const drawImage = vi.fn(
    (
      bitmap: { width: number; height: number; originX: number; originY: number },
      x: number,
      y: number,
      width: number,
      height: number,
      destinationX: number,
      destinationY: number,
      destinationWidth: number,
      destinationHeight: number,
    ) => {
      if (
        x < 0 ||
        y < 0 ||
        width <= 0 ||
        height <= 0 ||
        x + width > bitmap.width + 1e-7 ||
        y + height > bitmap.height + 1e-7
      ) {
        throw new Error("Canvas source extends outside the captured bitmap.");
      }
      if (
        ![x, y, width, height, destinationX, destinationY].every(Number.isSafeInteger) ||
        width !== destinationWidth ||
        height !== destinationHeight ||
        bitmap.originX + x !== destinationX ||
        bitmap.originY + y !== destinationY
      ) {
        throw new Error("Captured document pixel coordinates were shifted or rescaled.");
      }
      const canvas = canvases.at(-1);
      if (
        !canvas ||
        destinationX < 0 ||
        destinationY < 0 ||
        destinationX + width > canvas.width ||
        destinationY + height > canvas.height ||
        painted.some(
          (area) =>
            Math.max(area.x, destinationX) <
              Math.min(area.x + area.width, destinationX + width) &&
            Math.max(area.y, destinationY) <
              Math.min(area.y + area.height, destinationY + height),
        )
      ) {
        throw new Error("A document pixel was drawn outside the output or more than once.");
      }
      painted.push({ x: destinationX, y: destinationY, width, height });
    },
  );
  const blob = new Blob(["captured pixels"], { type: "image/png" });
  vi.stubGlobal(
    "OffscreenCanvas",
    class {
      constructor(
        public width: number,
        public height: number,
      ) {
        canvases.push(this);
      }

      getContext() {
        return { drawImage };
      }

      async convertToBlob() {
        if (
          painted.reduce(
            (area, rectangle) => area + rectangle.width * rectangle.height,
            0,
          ) !==
          this.width * this.height
        ) {
          throw new Error("The output is missing document pixels.");
        }
        return blob;
      }
    },
  );
  return {
    blob,
    drawImage,
    scrolls,
    captureVisibleTab,
    run: async () => {
      const outcome = runCapture({
        tabId: 42,
        options: { mode: "full", includeOverlays: false, hideFixed: true },
        signal: new AbortController().signal,
        onProgress: vi.fn(),
      }).then(
        (result) => ({ result }),
        (error: unknown) => ({
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      await vi.advanceTimersByTimeAsync(5000);
      return outcome;
    },
    expectRestored: () => {
      expect(requests.at(-1)?.action).toBe("finish");
      expect(state).toEqual(original);
      expect(prepared).toBe(false);
      expect(port.disconnect).toHaveBeenCalledOnce();
      expect(messages.size).toBe(0);
      expect(disconnects.size).toBe(0);
      for (const event of events) {
        expect(event.addListener).toHaveBeenCalledOnce();
        expect(event.removeListener).toHaveBeenCalledExactlyOnceWith(
          event.addListener.mock.calls[0]?.[0],
        );
      }
      for (const bitmap of bitmaps) expect(bitmap.close).toHaveBeenCalledOnce();
      for (const canvas of canvases) expect(canvas).toMatchObject({ width: 1, height: 1 });
      expect(vi.getTimerCount()).toBe(0);
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("full-page capture client", () => {
  it.each(fixtures)(
    "preserves every pixel of $outputWidth × $outputHeight after $quantization-quantized $axis scrolling",
    async (fixture) => {
      const capture = captureHarness(fixture);
      const outcome = await capture.run();
      expect(outcome).toEqual({
        result: {
          blob: capture.blob,
          width: fixture.outputWidth,
          height: fixture.outputHeight,
          mode: "full",
          tiles: capture.captureVisibleTab.mock.calls.length,
        } satisfies CaptureResult,
      });
      const maximumScroll =
        fixture.axis === "vertical"
          ? fixture.documentHeight - fixture.viewportHeight
          : fixture.documentWidth - fixture.viewportWidth;
      expect(
        capture.scrolls.some(
          ({ requested, actual }) =>
            requested > 0 && requested < maximumScroll && requested !== actual,
        ),
      ).toBe(true);
      expect(capture.drawImage.mock.calls.length).toBeGreaterThan(1);
      expect(capture.drawImage).toHaveBeenCalledTimes(
        capture.captureVisibleTab.mock.calls.length,
      );
      expect(
        capture.drawImage.mock.calls.reduce((area, draw) => area + draw[7] * draw[8], 0),
      ).toBe(fixture.outputWidth * fixture.outputHeight);
      capture.expectRestored();
    },
  );

  it.each([
    {
      failure: "movement",
      fixture: fixtures[0],
      error: "The page moved while Chrome was capturing",
    },
    {
      failure: "subpixel-movement",
      fixture: {
        ...fixtures[0],
        devicePixelRatio: 4,
        bitmapWidth: 3212,
        bitmapHeight: 3604,
        outputWidth: 3212,
        outputHeight: 10000,
      },
      error: "The page moved while Chrome was capturing",
    },
    {
      failure: "bitmap-resize",
      fixture: fixtures[0],
      error: "Screenshot dimensions changed during capture",
    },
  ] as const)(
    "rejects $failure and restores the page and capture resources",
    async ({ failure, fixture, error }) => {
      const capture = captureHarness(fixture, failure);
      expect(await capture.run()).toEqual({ error: expect.stringContaining(error) });
      expect(capture.captureVisibleTab).toHaveBeenCalledTimes(2);
      expect(capture.drawImage).toHaveBeenCalledOnce();
      capture.expectRestored();
    },
  );
});
