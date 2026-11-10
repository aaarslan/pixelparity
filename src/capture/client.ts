import {
  assertCaptureState,
  CAPTURE_INTERVAL_MS,
  CAPTURE_PORT,
  CAPTURE_SCROLL_EPSILON,
  type CaptureBitmapDimensions,
  type CaptureOptions,
  type CaptureRect,
  type CaptureResult,
  captureBitmapScale,
  captureDimensions,
  captureScrollMatches,
  clipCaptureRegion,
  fullCaptureDimensions,
  isCapturePageState,
  isCaptureRect,
  planFullCapture,
  tileDrawPlan,
} from "../shared/capture";
import { abortableDelay, throwIfAborted } from "./async";
import { CaptureConnection } from "./connection";

export interface CaptureProgress {
  message: string;
  completed: number;
  total: number;
}

interface CaptureRun {
  tabId: number;
  options: CaptureOptions;
  signal: AbortSignal;
  onProgress: (progress: CaptureProgress) => void;
}

async function assertForeground(
  tabId: number,
  windowId: number,
  zoom: number,
): Promise<void> {
  const [tab, windowInfo, currentZoom] = await Promise.all([
    chrome.tabs.get(tabId),
    chrome.windows.get(windowId),
    chrome.tabs.getZoom(tabId),
  ]);
  if (!tab.active || tab.windowId !== windowId || !windowInfo.focused || tab.discarded) {
    throw new Error(
      "Keep the inspected tab and its Chrome window in the foreground while capturing.",
    );
  }
  if (currentZoom !== zoom)
    throw new Error("Browser zoom changed during capture. Retry with a fixed zoom.");
  if (tab.status === "loading")
    throw new Error("The page is loading. Wait for it to finish and retry.");
}

function watchCaptureTarget(
  tabId: number,
  windowId: number,
  controller: AbortController,
): () => void {
  const stop = () =>
    controller.abort(
      new Error("Capture stopped because the tab, page, window, or zoom changed."),
    );
  const activated = (info: chrome.tabs.OnActivatedInfo) => {
    if (info.windowId === windowId && info.tabId !== tabId) stop();
  };
  const updated = (id: number, change: chrome.tabs.OnUpdatedInfo) => {
    if (id === tabId && (change.status === "loading" || change.url)) stop();
  };
  const removed = (id: number) => {
    if (id === tabId) stop();
  };
  const zoomed = (info: chrome.tabs.OnZoomChangeInfo) => {
    if (info.tabId === tabId) stop();
  };
  const focused = (id: number) => {
    if (id !== windowId) stop();
  };
  chrome.tabs.onActivated.addListener(activated);
  chrome.tabs.onUpdated.addListener(updated);
  chrome.tabs.onRemoved.addListener(removed);
  chrome.tabs.onZoomChange.addListener(zoomed);
  chrome.windows.onFocusChanged.addListener(focused);
  return () => {
    chrome.tabs.onActivated.removeListener(activated);
    chrome.tabs.onUpdated.removeListener(updated);
    chrome.tabs.onRemoved.removeListener(removed);
    chrome.tabs.onZoomChange.removeListener(zoomed);
    chrome.windows.onFocusChanged.removeListener(focused);
  };
}

export function pngDataUrlToBlob(dataUrl: string): Blob {
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix))
    throw new Error("Chrome returned an unsupported screenshot format.");
  const binary = atob(dataUrl.slice(prefix.length));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: "image/png" });
}

async function captureLocked(run: CaptureRun): Promise<CaptureResult> {
  const controller = new AbortController();
  const relayAbort = () => controller.abort(run.signal.reason);
  run.signal.addEventListener("abort", relayAbort, { once: true });
  if (run.signal.aborted) relayAbort();
  const signal = controller.signal;
  let connection: CaptureConnection | null = null;
  let stopWatching = () => {};
  let canvas: OffscreenCanvas | null = null;
  let lastCapture = 0;
  try {
    throwIfAborted(signal);
    const tab = await chrome.tabs.get(run.tabId);
    const windowId = tab.windowId;
    const zoom = await chrome.tabs.getZoom(run.tabId);
    await assertForeground(run.tabId, windowId, zoom);
    stopWatching = watchCaptureTarget(run.tabId, windowId, controller);
    const injection = await chrome.scripting.executeScript({
      target: { tabId: run.tabId },
      files: ["capture-bridge.js"],
      world: "ISOLATED",
    });
    throwIfAborted(signal);
    const documentId = injection.find((frame) => frame.frameId === 0)?.documentId;
    const port = chrome.tabs.connect(run.tabId, {
      name: CAPTURE_PORT,
      ...(documentId ? { documentId } : { frameId: 0 }),
    });
    connection = new CaptureConnection(port);
    const original = await connection.state(signal);
    if (
      original.visualScale !== 1 ||
      original.visualOffsetX !== 0 ||
      original.visualOffsetY !== 0
    ) {
      throw new Error(
        "Reset pinch zoom before capturing. Regular Chrome browser zoom is supported.",
      );
    }
    let region: CaptureRect | null = null;
    if (run.options.mode === "region") {
      run.onProgress({
        message: "Draw a region on the page, then select Capture region.",
        completed: 0,
        total: 1,
      });
      const selection = await connection.request({ action: "select" }, signal);
      if (!isCaptureRect(selection.region) || !isCapturePageState(selection.state))
        throw new Error("The selected region is invalid. Try again.");
      assertCaptureState(original, selection.state);
      region = clipCaptureRegion(
        selection.region,
        original.viewportWidth,
        original.viewportHeight,
      );
    }
    const prepared = await connection.request(
      { action: "prepare", options: run.options },
      signal,
    );
    if (!isCapturePageState(prepared.state))
      throw new Error("The page returned invalid capture dimensions.");
    const initial = prepared.state;
    assertCaptureState(original, initial);
    const fullPage = run.options.mode === "full";
    const outputArea = fullPage
      ? { x: 0, y: 0, width: initial.documentWidth, height: initial.documentHeight }
      : (region ?? {
          x: 0,
          y: 0,
          width: initial.viewportWidth,
          height: initial.viewportHeight,
        });
    captureDimensions(outputArea.width, outputArea.height, initial.devicePixelRatio);
    const tiles = fullPage
      ? planFullCapture(initial).reverse()
      : [{ scrollX: initial.scrollX, scrollY: initial.scrollY, area: outputArea }];
    let firstBitmap: CaptureBitmapDimensions | undefined;
    let completed = 0;
    let extentChanged = false;
    for (const tile of tiles) {
      throwIfAborted(signal);
      run.onProgress({
        message: `Capturing frame ${completed + 1} of ${tiles.length}…`,
        completed,
        total: tiles.length,
      });
      if (fullPage) {
        const scrolled = await connection.request(
          { action: "scroll", x: tile.scrollX, y: tile.scrollY },
          signal,
        );
        if (!isCapturePageState(scrolled.state))
          throw new Error("The page could not be scrolled for capture.");
        assertCaptureState(initial, scrolled.state);
        if (!captureScrollMatches(scrolled.state, tile.scrollX, tile.scrollY)) {
          throw new Error(
            "The page changed size or uses a custom scrolling layout. Capture a viewport or region instead.",
          );
        }
      }
      await abortableDelay(
        lastCapture
          ? Math.max(180, CAPTURE_INTERVAL_MS - (performance.now() - lastCapture))
          : CAPTURE_INTERVAL_MS,
        signal,
      );
      await assertForeground(run.tabId, windowId, zoom);
      const before = await connection.state(signal);
      assertCaptureState(initial, before);
      if (
        fullPage
          ? !captureScrollMatches(before, tile.scrollX, tile.scrollY)
          : Math.abs(before.scrollX - tile.scrollX) > CAPTURE_SCROLL_EPSILON ||
            Math.abs(before.scrollY - tile.scrollY) > CAPTURE_SCROLL_EPSILON
      ) {
        throw new Error("The page moved during capture. Keep it still and retry.");
      }
      throwIfAborted(signal);
      lastCapture = performance.now();
      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
      await assertForeground(run.tabId, windowId, zoom);
      const after = await connection.state(signal);
      assertCaptureState(initial, after);
      extentChanged ||=
        after.documentWidth !== initial.documentWidth ||
        after.documentHeight !== initial.documentHeight;
      if (
        Math.abs(before.scrollX - after.scrollX) > CAPTURE_SCROLL_EPSILON ||
        Math.abs(before.scrollY - after.scrollY) > CAPTURE_SCROLL_EPSILON
      ) {
        throw new Error(
          "The page moved while Chrome was capturing. Keep it still and retry.",
        );
      }
      throwIfAborted(signal);
      const bitmap = await createImageBitmap(pngDataUrlToBlob(dataUrl));
      try {
        throwIfAborted(signal);
        const scale = captureBitmapScale(initial, bitmap, firstBitmap);
        if (!canvas) {
          firstBitmap = { width: bitmap.width, height: bitmap.height };
          const dimensions = fullPage
            ? fullCaptureDimensions(initial, after, bitmap)
            : captureDimensions(outputArea.width, outputArea.height, scale.x, scale.y);
          canvas = new OffscreenCanvas(dimensions.width, dimensions.height);
        }
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Chrome could not create the screenshot canvas.");
        if (fullPage) {
          const draw = tileDrawPlan(tile.area, initial, after, bitmap, canvas);
          const { source, destination } = draw;
          if (destination.width > 0 && destination.height > 0) {
            context.drawImage(
              bitmap,
              source.x,
              source.y,
              source.width,
              source.height,
              destination.x,
              destination.y,
              destination.width,
              destination.height,
            );
          }
        } else {
          context.drawImage(
            bitmap,
            outputArea.x * scale.x,
            outputArea.y * scale.y,
            outputArea.width * scale.x,
            outputArea.height * scale.y,
            0,
            0,
            canvas.width,
            canvas.height,
          );
        }
      } finally {
        bitmap.close();
      }
      completed += 1;
    }
    await connection.request({ action: "finish" }, signal);
    if (!canvas) throw new Error("Chrome did not return a screenshot.");
    run.onProgress({
      message: "Preparing your PNG…",
      completed: tiles.length,
      total: tiles.length,
    });
    const blob = await canvas.convertToBlob({ type: "image/png" });
    throwIfAborted(signal);
    return {
      blob,
      width: canvas.width,
      height: canvas.height,
      mode: run.options.mode,
      tiles: tiles.length,
      ...(fullPage && extentChanged
        ? {
            notice:
              "The page changed size while scrolling. This image covers the document area measured when capture began.",
          }
        : {}),
    };
  } finally {
    stopWatching();
    if (connection) {
      await connection.request({ action: "finish" }).catch(() => {});
      connection.close();
    }
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }
    run.signal.removeEventListener("abort", relayAbort);
    const remaining = CAPTURE_INTERVAL_MS - (performance.now() - lastCapture);
    if (lastCapture && remaining > 0)
      await new Promise<void>((resolve) => setTimeout(resolve, remaining));
  }
}

export async function runCapture(run: CaptureRun): Promise<CaptureResult> {
  throwIfAborted(run.signal);
  if (!navigator.locks)
    throw new Error(
      "This Chrome version cannot safely coordinate captures. Update Chrome and retry.",
    );
  return navigator.locks.request(
    "pixelparity-capture",
    { ifAvailable: true },
    async (lock) => {
      if (!lock)
        throw new Error(
          "Another PixelParity capture is running. Finish or cancel it first.",
        );
      return captureLocked(run);
    },
  );
}

export function captureFilename(date = new Date()): string {
  return `pixelparity-${date
    .toISOString()
    .replaceAll(":", "-")
    .replace(/\.\d{3}Z$/, "Z")}.png`;
}
