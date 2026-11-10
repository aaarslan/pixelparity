export const CAPTURE_PORT = "pixelparity-capture-v3";
export const CAPTURE_INTERVAL_MS = 650;
export const MAX_CAPTURE_PIXELS = 48_000_000;
export const MAX_CAPTURE_DIMENSION = 32_760;
export const MAX_CAPTURE_TILES = 40;

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
  const columns = Math.ceil(state.documentWidth / state.contentWidth);
  const rows = Math.ceil(state.documentHeight / state.contentHeight);
  if (!Number.isFinite(columns * rows) || columns * rows > MAX_CAPTURE_TILES) {
    throw new Error("This page needs more than 40 frames. Capture a viewport or region.");
  }
  const tiles: CaptureTile[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = column * state.contentWidth;
      const y = row * state.contentHeight;
      tiles.push({
        scrollX: Math.min(x, Math.max(0, state.documentWidth - state.contentWidth)),
        scrollY: Math.min(y, Math.max(0, state.documentHeight - state.contentHeight)),
        area: {
          x,
          y,
          width: Math.min(state.contentWidth, state.documentWidth - x),
          height: Math.min(state.contentHeight, state.documentHeight - y),
        },
      });
    }
  }
  return tiles;
}

export function captureBitmapScale(
  viewport: Pick<CapturePageState, "viewportWidth" | "viewportHeight">,
  bitmap: CaptureBitmapDimensions,
  previous?: CaptureBitmapDimensions,
) {
  const minimumScale = Math.max(
    (bitmap.width - 1) / viewport.viewportWidth,
    (bitmap.height - 1) / viewport.viewportHeight,
  );
  const maximumScale = Math.min(
    (bitmap.width + 1) / viewport.viewportWidth,
    (bitmap.height + 1) / viewport.viewportHeight,
  );
  if (
    !finite(viewport.viewportWidth) ||
    viewport.viewportWidth <= 0 ||
    !finite(viewport.viewportHeight) ||
    viewport.viewportHeight <= 0 ||
    !Number.isSafeInteger(bitmap.width) ||
    bitmap.width < 1 ||
    !Number.isSafeInteger(bitmap.height) ||
    bitmap.height < 1 ||
    minimumScale >= maximumScale ||
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
  scrollX: number,
  scrollY: number,
  scaleX: number,
  scaleY = scaleX,
) {
  const destinationX = Math.round(area.x * scaleX);
  const destinationY = Math.round(area.y * scaleY);
  const width = Math.round((area.x + area.width) * scaleX) - destinationX;
  const height = Math.round((area.y + area.height) * scaleY) - destinationY;
  return {
    source: {
      x: (area.x - scrollX) * scaleX,
      y: (area.y - scrollY) * scaleY,
      width: area.width * scaleX,
      height: area.height * scaleY,
    },
    destination: { x: destinationX, y: destinationY, width, height },
  };
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
