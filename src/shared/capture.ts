export const CAPTURE_PORT = "pixelparity-capture-v3";
export const CAPTURE_INTERVAL_MS = 650;
export const MAX_CAPTURE_PIXELS = 48_000_000;
export const MAX_CAPTURE_DIMENSION = 32_760;
export const MAX_CAPTURE_TILES = 40;
export const CAPTURE_SCROLL_EPSILON = 1e-7;

export type CaptureMode = "viewport" | "region" | "full";

export interface CaptureRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CapturePageState {
  documentToken: string;
  viewportWidth: number;
  viewportHeight: number;
  contentWidth: number;
  contentHeight: number;
  documentWidth: number;
  documentHeight: number;
  scrollX: number;
  scrollY: number;
  devicePixelRatio: number;
  visualScale: number;
  visualOffsetX: number;
  visualOffsetY: number;
}

export interface CaptureOptions {
  mode: CaptureMode;
  includeOverlays: boolean;
  hideFixed: boolean;
}

export interface CaptureTile {
  scrollX: number;
  scrollY: number;
  area: CaptureRect;
}

export interface CaptureBitmapDimensions {
  width: number;
  height: number;
}

export interface CaptureResult {
  blob: Blob;
  width: number;
  height: number;
  mode: CaptureMode;
  tiles: number;
  notice?: string;
}

export type CaptureRequest =
  | { id: number; action: "state" | "select" | "finish" | "ping" }
  | { id: number; action: "prepare"; options: CaptureOptions }
  | { id: number; action: "scroll"; x: number; y: number };

export interface CaptureResponse {
  id: number;
  ok: boolean;
  state?: CapturePageState;
  region?: CaptureRect;
  error?: string;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isCaptureRequest(value: unknown): value is CaptureRequest {
  if (!record(value) || !Number.isSafeInteger(value.id) || (value.id as number) < 1) {
    return false;
  }
  if (["state", "select", "finish", "ping"].includes(String(value.action))) return true;
  if (value.action === "scroll") return finite(value.x) && finite(value.y);
  if (value.action !== "prepare" || !record(value.options)) return false;
  return (
    ["viewport", "region", "full"].includes(String(value.options.mode)) &&
    typeof value.options.includeOverlays === "boolean" &&
    typeof value.options.hideFixed === "boolean"
  );
}

export function isCapturePageState(value: unknown): value is CapturePageState {
  if (!record(value) || typeof value.documentToken !== "string") return false;
  const positive = [
    "viewportWidth",
    "viewportHeight",
    "contentWidth",
    "contentHeight",
    "documentWidth",
    "documentHeight",
    "devicePixelRatio",
    "visualScale",
  ];
  return (
    positive.every((key) => finite(value[key]) && value[key] > 0) &&
    ["scrollX", "scrollY", "visualOffsetX", "visualOffsetY"].every((key) =>
      finite(value[key]),
    )
  );
}

export function isCaptureRect(value: unknown): value is CaptureRect {
  return (
    record(value) &&
    ["x", "y", "width", "height"].every((key) => finite(value[key])) &&
    (value.width as number) > 0 &&
    (value.height as number) > 0
  );
}

export function clipCaptureRegion(
  region: CaptureRect,
  width: number,
  height: number,
): CaptureRect {
  if (!isCaptureRect(region) || !finite(width) || !finite(height)) {
    throw new Error("The selected region is invalid. Draw a new selection.");
  }
  const x = Math.max(0, region.x);
  const y = Math.max(0, region.y);
  const right = Math.min(width, region.x + region.width);
  const bottom = Math.min(height, region.y + region.height);
  if (right - x < 2 || bottom - y < 2) {
    throw new Error("Choose a region at least 2 CSS pixels wide and tall.");
  }
  return { x, y, width: right - x, height: bottom - y };
}

export function captureDimensions(
  width: number,
  height: number,
  scaleX: number,
  scaleY = scaleX,
) {
  if (![width, height, scaleX, scaleY].every((value) => finite(value) && value > 0)) {
    throw new Error("The page has invalid capture dimensions.");
  }
  const pixelWidth = Math.round(width * scaleX);
  const pixelHeight = Math.round(height * scaleY);
  if (
    pixelWidth < 1 ||
    pixelHeight < 1 ||
    pixelWidth > MAX_CAPTURE_DIMENSION ||
    pixelHeight > MAX_CAPTURE_DIMENSION ||
    pixelWidth * pixelHeight > MAX_CAPTURE_PIXELS
  ) {
    throw new Error(
      "This image exceeds the 48 megapixel or 32,760 pixel limit. Capture a region or use a smaller browser zoom.",
    );
  }
  return { width: pixelWidth, height: pixelHeight };
}

export function planFullCapture(state: CapturePageState): CaptureTile[] {
  if (!isCapturePageState(state))
    throw new Error("The page has invalid capture dimensions.");
  const margin = 2 * captureScrollTolerance(state);
  const columnWidth =
    state.documentWidth <= state.contentWidth
      ? state.contentWidth
      : state.contentWidth - 2 * margin;
  const rowHeight =
    state.documentHeight <= state.contentHeight
      ? state.contentHeight
      : state.contentHeight - 2 * margin;
  if (columnWidth <= 0 || rowHeight <= 0) {
    throw new Error("The viewport is too small for full-page capture. Make it larger.");
  }
  const columnCount = state.documentWidth / columnWidth;
  const rowCount = state.documentHeight / rowHeight;
  const columns = Math.max(1, Math.ceil(columnCount - 4 * Number.EPSILON * columnCount));
  const rows = Math.max(1, Math.ceil(rowCount - 4 * Number.EPSILON * rowCount));
  if (!Number.isFinite(columns * rows) || columns * rows > MAX_CAPTURE_TILES) {
    throw new Error("This page needs more than 40 frames. Capture a viewport or region.");
  }
  const tiles: CaptureTile[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = column * columnWidth;
      const y = row * rowHeight;
      const maximumX = Math.max(0, state.documentWidth - state.contentWidth);
      const maximumY = Math.max(0, state.documentHeight - state.contentHeight);
      tiles.push({
        scrollX: Math.max(0, Math.min(x - margin, maximumX + margin)),
        scrollY: Math.max(0, Math.min(y - margin, maximumY + margin)),
        area: {
          x,
          y,
          width:
            (column === columns - 1 ? state.documentWidth : (column + 1) * columnWidth) - x,
          height: (row === rows - 1 ? state.documentHeight : (row + 1) * rowHeight) - y,
        },
      });
    }
  }
  return tiles;
}

export function captureScrollTolerance(state: Pick<CapturePageState, "devicePixelRatio">) {
  return Math.max(1, 1 / state.devicePixelRatio);
}

export function captureScrollMatches(state: CapturePageState, x: number, y: number) {
  const expectedX = Math.max(0, Math.min(x, state.documentWidth - state.contentWidth));
  const expectedY = Math.max(0, Math.min(y, state.documentHeight - state.contentHeight));
  const tolerance = captureScrollTolerance(state) + CAPTURE_SCROLL_EPSILON;
  return (
    Math.abs(state.scrollX - expectedX) <= tolerance &&
    Math.abs(state.scrollY - expectedY) <= tolerance
  );
}

export function captureBitmapScale(
  viewport: Pick<CapturePageState, "viewportWidth" | "viewportHeight" | "devicePixelRatio">,
  bitmap: CaptureBitmapDimensions,
  previous?: CaptureBitmapDimensions,
) {
  const rounding = Math.ceil(viewport.devicePixelRatio);
  if (
    !finite(viewport.viewportWidth) ||
    viewport.viewportWidth <= 0 ||
    !finite(viewport.viewportHeight) ||
    viewport.viewportHeight <= 0 ||
    !finite(viewport.devicePixelRatio) ||
    viewport.devicePixelRatio <= 0 ||
    !Number.isSafeInteger(bitmap.width) ||
    bitmap.width < 1 ||
    !Number.isSafeInteger(bitmap.height) ||
    bitmap.height < 1 ||
    Math.abs(bitmap.width - viewport.viewportWidth * viewport.devicePixelRatio) >
      rounding ||
    Math.abs(bitmap.height - viewport.viewportHeight * viewport.devicePixelRatio) >
      rounding ||
    (previous && (bitmap.width !== previous.width || bitmap.height !== previous.height))
  ) {
    throw new Error(
      "Screenshot dimensions changed during capture. Keep the viewport fixed and retry.",
    );
  }
  return {
    x: bitmap.width / viewport.viewportWidth,
    y: bitmap.height / viewport.viewportHeight,
  };
}

export function tileDrawPlan(
  area: CaptureRect,
  initial: CapturePageState,
  current: CapturePageState,
  bitmap: CaptureBitmapDimensions,
  output: CaptureBitmapDimensions,
) {
  const content = captureContentPixels(initial, bitmap);
  const horizontal = tileDrawAxis(
    area.x,
    area.width,
    initial.documentWidth,
    current.documentWidth,
    content.width,
    current.scrollX,
    initial.devicePixelRatio,
    output.width,
  );
  const vertical = tileDrawAxis(
    area.y,
    area.height,
    initial.documentHeight,
    current.documentHeight,
    content.height,
    current.scrollY,
    initial.devicePixelRatio,
    output.height,
  );
  return {
    source: {
      x: horizontal.source,
      y: vertical.source,
      width: horizontal.size,
      height: vertical.size,
    },
    destination: {
      x: horizontal.destination,
      y: vertical.destination,
      width: horizontal.size,
      height: vertical.size,
    },
  };
}

function captureContentPixels(state: CapturePageState, bitmap: CaptureBitmapDimensions) {
  const width = Math.round(state.contentWidth * state.devicePixelRatio);
  const height = Math.round(state.contentHeight * state.devicePixelRatio);
  if (width < 1 || height < 1 || width > bitmap.width || height > bitmap.height) {
    throw new Error(
      "The screenshot does not match the page viewport. Reconnect and retry.",
    );
  }
  return { width, height };
}

export function fullCaptureDimensions(
  initial: CapturePageState,
  current: CapturePageState,
  bitmap: CaptureBitmapDimensions,
) {
  const content = captureContentPixels(initial, bitmap);
  const dimensions = captureDimensions(
    initial.documentWidth,
    initial.documentHeight,
    initial.devicePixelRatio,
  );
  const tolerance =
    Math.ceil(captureScrollTolerance(initial) * initial.devicePixelRatio) + 1;
  for (const [dimension, extent, scroll] of [
    ["width", "documentWidth", "scrollX"],
    ["height", "documentHeight", "scrollY"],
  ] as const) {
    if (current[extent] < initial[extent]) {
      throw new Error("The page became smaller during capture. Keep it still and retry.");
    }
    if (current[extent] === initial[extent]) {
      const observed =
        Math.round(current[scroll] * initial.devicePixelRatio) + content[dimension];
      if (Math.abs(observed - dimensions[dimension]) > tolerance) {
        throw new Error(
          "The page did not reach its capture edge. Keep it still and retry.",
        );
      }
      dimensions[dimension] = observed;
    }
  }
  return captureDimensions(dimensions.width, dimensions.height, 1);
}

function tileDrawAxis(
  start: number,
  size: number,
  initialExtent: number,
  currentExtent: number,
  contentPixels: number,
  scroll: number,
  scale: number,
  outputExtent: number,
) {
  const destination = Math.min(outputExtent, Math.round(start * scale));
  const end =
    start + size === initialExtent
      ? outputExtent
      : Math.min(outputExtent, Math.round((start + size) * scale));
  const origin = Math.round(scroll * scale);
  const source = destination - origin;
  const pixelSize = end - destination;
  if (
    currentExtent < initialExtent ||
    (pixelSize > 0 && source < 0) ||
    pixelSize < 0 ||
    (pixelSize > 0 && source + pixelSize > contentPixels)
  ) {
    throw new Error(
      "The page changed its layout during capture. Retry after it finishes loading.",
    );
  }
  return { source: pixelSize > 0 ? source : 0, destination, size: pixelSize };
}

export function assertCaptureState(
  initial: CapturePageState,
  current: CapturePageState,
): void {
  if (initial.documentToken !== current.documentToken) {
    throw new Error("The page navigated during capture. Reconnect and try again.");
  }
  if (
    [
      "viewportWidth",
      "viewportHeight",
      "contentWidth",
      "contentHeight",
      "devicePixelRatio",
      "visualScale",
      "visualOffsetX",
      "visualOffsetY",
    ].some(
      (key) =>
        initial[key as keyof CapturePageState] !== current[key as keyof CapturePageState],
    )
  ) {
    throw new Error(
      "The viewport or zoom changed during capture. Keep its size fixed and retry.",
    );
  }
}
