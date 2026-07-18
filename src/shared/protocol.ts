import type { PageMetrics, StableErrorCode } from "./types";

export const MESSAGE_TYPES = {
  snapshotRequest: "PIXELPARITY/SNAPSHOT_REQUEST",
  snapshotResponse: "PIXELPARITY/SNAPSHOT_RESPONSE",
  liveStart: "PIXELPARITY/LIVE_START",
  liveStop: "PIXELPARITY/LIVE_STOP",
  metricsUpdate: "PIXELPARITY/METRICS_UPDATE",
  bridgeError: "PIXELPARITY/BRIDGE_ERROR",
} as const;

export interface SnapshotRequest {
  type: typeof MESSAGE_TYPES.snapshotRequest;
}

export interface SnapshotSuccessResponse {
  type: typeof MESSAGE_TYPES.snapshotResponse;
  ok: true;
  metrics: PageMetrics;
}

export interface BridgeErrorResponse {
  type: typeof MESSAGE_TYPES.bridgeError;
  ok: false;
  code: StableErrorCode;
}

export interface LiveStartMessage {
  type: typeof MESSAGE_TYPES.liveStart;
}

export interface LiveStopMessage {
  type: typeof MESSAGE_TYPES.liveStop;
}

export interface MetricsUpdateMessage {
  type: typeof MESSAGE_TYPES.metricsUpdate;
  metrics: PageMetrics;
}

export type BridgeRequest = SnapshotRequest;
export type BridgeResponse = SnapshotSuccessResponse | BridgeErrorResponse;
export type LiveControlMessage = LiveStartMessage | LiveStopMessage;
export type LiveBridgeMessage = MetricsUpdateMessage | BridgeErrorResponse;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasFiniteNumbers(value: unknown, keys: readonly string[]): boolean {
  return (
    isRecord(value) &&
    keys.every((key) => typeof value[key] === "number" && Number.isFinite(value[key]))
  );
}

export function isPageMetrics(value: unknown): value is PageMetrics {
  if (!isRecord(value)) return false;
  const environment = value.environment;
  const screen = value.screen;
  return (
    hasFiniteNumbers(value.viewport, [
      "layoutWidth",
      "layoutHeight",
      "visualWidth",
      "visualHeight",
      "visualOffsetLeft",
      "visualOffsetTop",
      "visualScale",
      "outerWidth",
      "outerHeight",
      "scrollbarWidth",
      "scrollbarHeight",
    ]) &&
    hasFiniteNumbers(value.display, ["devicePixelRatio"]) &&
    hasFiniteNumbers(screen, [
      "width",
      "height",
      "availableWidth",
      "availableHeight",
      "colorDepth",
      "pixelDepth",
      "orientationAngle",
    ]) &&
    isRecord(screen) &&
    typeof screen.orientationType === "string" &&
    hasFiniteNumbers(value.document, ["width", "height"]) &&
    hasFiniteNumbers(value.typography, ["rootFontSize", "bodyFontSize"]) &&
    isRecord(environment) &&
    (environment.colorScheme === "light" || environment.colorScheme === "dark") &&
    typeof environment.reducedMotion === "boolean" &&
    typeof environment.forcedColors === "boolean" &&
    (environment.pointer === "fine" ||
      environment.pointer === "coarse" ||
      environment.pointer === "none") &&
    (environment.hover === "hover" || environment.hover === "none") &&
    (environment.colorGamut === "srgb" ||
      environment.colorGamut === "p3" ||
      environment.colorGamut === "rec2020" ||
      environment.colorGamut === "unknown")
  );
}

const STABLE_ERROR_CODES: ReadonlySet<StableErrorCode> = new Set([
  "RESTRICTED_PAGE",
  "ACCESS_REVOKED",
  "DOCUMENT_NOT_READY",
  "INJECTION_FAILED",
  "NO_ACTIVE_TAB",
  "BRIDGE_UNAVAILABLE",
  "INVALID_MESSAGE",
  "COPY_FAILED",
  "DOWNLOAD_FAILED",
  "UNKNOWN",
]);

function isBridgeError(value: unknown): value is BridgeErrorResponse {
  if (!isRecord(value)) return false;
  return (
    value.type === MESSAGE_TYPES.bridgeError &&
    value.ok === false &&
    typeof value.code === "string" &&
    STABLE_ERROR_CODES.has(value.code as StableErrorCode)
  );
}

export function isSnapshotRequest(value: unknown): value is SnapshotRequest {
  return isRecord(value) && value.type === MESSAGE_TYPES.snapshotRequest;
}

export function isLiveControlMessage(value: unknown): value is LiveControlMessage {
  if (!isRecord(value)) return false;
  return value.type === MESSAGE_TYPES.liveStart || value.type === MESSAGE_TYPES.liveStop;
}

export function isBridgeResponse(value: unknown): value is BridgeResponse {
  if (!isRecord(value)) return false;
  return (
    (value.type === MESSAGE_TYPES.snapshotResponse &&
      value.ok === true &&
      isPageMetrics(value.metrics)) ||
    isBridgeError(value)
  );
}

export function isLiveBridgeMessage(value: unknown): value is LiveBridgeMessage {
  if (!isRecord(value)) return false;
  return (
    (value.type === MESSAGE_TYPES.metricsUpdate && isPageMetrics(value.metrics)) ||
    isBridgeError(value)
  );
}
