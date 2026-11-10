export const OVERLAY_PORT_NAME = "PIXELPARITY/OVERLAY_V3";

export type GridType = "columns" | "square" | "baseline";

export interface OverlaySettings {
  gridEnabled: boolean;
  gridType: GridType;
  columns: number;
  gutter: number;
  margin: number;
  maxWidth: number;
  spacing: number;
  color: string;
  opacity: number;
  rulers: boolean;
  inspect: boolean;
}

export const DEFAULT_OVERLAY_SETTINGS: Readonly<OverlaySettings> = {
  gridEnabled: false,
  gridType: "columns",
  columns: 12,
  gutter: 24,
  margin: 24,
  maxWidth: 1200,
  spacing: 8,
  color: "#6366f1",
  opacity: 0.18,
  rulers: false,
  inspect: false,
};

export interface ColumnGeometry {
  left: number;
  width: number;
  columnWidth: number;
  gutter: number;
  columns: number;
}

export type BoxEdges = [number, number, number, number];

export interface ElementMeasurement {
  tag: string;
  x: number;
  y: number;
  width: number;
  height: number;
  margin: BoxEdges;
  padding: BoxEdges;
  border: BoxEdges;
  rowGap: string;
  columnGap: string;
  fontSize: number;
  lineHeight: number | null;
  display: string;
  position: string;
  boxSizing: "border-box" | "content-box";
  locked: boolean;
}

export type OverlayCommand =
  | { type: "PIXELPARITY/OVERLAY_SET"; settings: OverlaySettings }
  | { type: "PIXELPARITY/OVERLAY_CLEAR" }
  | { type: "PIXELPARITY/OVERLAY_RESUME" };

export type OverlayEvent =
  | { type: "PIXELPARITY/OVERLAY_STATE"; settings: OverlaySettings }
  | { type: "PIXELPARITY/OVERLAY_MEASUREMENT"; measurement: ElementMeasurement | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inRange(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
  );
}

export function isOverlaySettings(value: unknown): value is OverlaySettings {
  if (!isRecord(value)) return false;
  return (
    typeof value.gridEnabled === "boolean" &&
    (value.gridType === "columns" ||
      value.gridType === "square" ||
      value.gridType === "baseline") &&
    inRange(value.columns, 1, 24) &&
    Number.isInteger(value.columns) &&
    inRange(value.gutter, 0, 160) &&
    inRange(value.margin, 0, 400) &&
    inRange(value.maxWidth, 0, 3840) &&
    inRange(value.spacing, 2, 128) &&
    inRange(value.opacity, 0.05, 0.6) &&
    typeof value.color === "string" &&
    /^#[0-9a-f]{6}$/i.test(value.color) &&
    typeof value.rulers === "boolean" &&
    typeof value.inspect === "boolean"
  );
}

export function copyOverlaySettings(value: OverlaySettings): OverlaySettings {
  return {
    gridEnabled: value.gridEnabled,
    gridType: value.gridType,
    columns: value.columns,
    gutter: value.gutter,
    margin: value.margin,
    maxWidth: value.maxWidth,
    spacing: value.spacing,
    color: value.color,
    opacity: value.opacity,
    rulers: value.rulers,
    inspect: value.inspect,
  };
}

export function columnGeometry(
  viewportWidth: number,
  settings: Pick<OverlaySettings, "columns" | "gutter" | "margin" | "maxWidth">,
): ColumnGeometry {
  const viewport = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0;
  const columns = Number.isFinite(settings.columns)
    ? Math.min(24, Math.max(1, Math.round(settings.columns)))
    : DEFAULT_OVERLAY_SETTINGS.columns;
  const margin = Number.isFinite(settings.margin)
    ? Math.min(viewport / 2, Math.max(0, settings.margin))
    : 0;
  const available = Math.max(0, viewport - margin * 2);
  const width =
    Number.isFinite(settings.maxWidth) && settings.maxWidth > 0
      ? Math.min(available, settings.maxWidth)
      : available;
  const requestedGutter = Number.isFinite(settings.gutter)
    ? Math.max(0, settings.gutter)
    : 0;
  const gutter =
    columns > 1
      ? Math.min(requestedGutter, Math.max(0, width - columns) / (columns - 1))
      : 0;
  return {
    left: (viewport - width) / 2,
    width,
    columnWidth: Math.max(0, (width - gutter * (columns - 1)) / columns),
    gutter,
    columns,
  };
}

export function gridOffset(scroll: number, spacing: number): number {
  if (!Number.isFinite(scroll) || !Number.isFinite(spacing) || spacing <= 0) return 0;
  return -(((scroll % spacing) + spacing) % spacing);
}

export function isOverlayCommand(value: unknown): value is OverlayCommand {
  if (!isRecord(value)) return false;
  return (
    value.type === "PIXELPARITY/OVERLAY_CLEAR" ||
    value.type === "PIXELPARITY/OVERLAY_RESUME" ||
    (value.type === "PIXELPARITY/OVERLAY_SET" && isOverlaySettings(value.settings))
  );
}

function isEdges(value: unknown): value is BoxEdges {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((item) => inRange(item, -10_000_000, 10_000_000))
  );
}

function isComputedGap(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 160) return false;
  if (value === "normal" || value === "0") return true;
  if (/^(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?(?:px|%)$/i.test(value)) return true;
  if (!/^(?:calc|min|max|clamp)\([0-9a-z.%+*/(), -]+\)$/i.test(value)) return false;
  return (value.match(/[a-z]+/gi) ?? []).every((word) =>
    ["calc", "min", "max", "clamp", "px", "e", "pi"].includes(word.toLowerCase()),
  );
}

export function isElementMeasurement(value: unknown): value is ElementMeasurement {
  if (!isRecord(value)) return false;
  return (
    typeof value.tag === "string" &&
    /^[a-z][a-z0-9-]{0,63}$/i.test(value.tag) &&
    inRange(value.x, -10_000_000, 10_000_000) &&
    inRange(value.y, -10_000_000, 10_000_000) &&
    inRange(value.width, 0, 10_000_000) &&
    inRange(value.height, 0, 10_000_000) &&
    isEdges(value.margin) &&
    isEdges(value.padding) &&
    isEdges(value.border) &&
    isComputedGap(value.rowGap) &&
    isComputedGap(value.columnGap) &&
    inRange(value.fontSize, 0, 10_000_000) &&
    (value.lineHeight === null || inRange(value.lineHeight, 0, 10_000_000)) &&
    typeof value.display === "string" &&
    /^[a-z-]{1,24}(?: [a-z-]{1,24})?$/.test(value.display) &&
    typeof value.position === "string" &&
    ["static", "relative", "absolute", "sticky", "fixed"].includes(value.position) &&
    (value.boxSizing === "border-box" || value.boxSizing === "content-box") &&
    typeof value.locked === "boolean"
  );
}

export function isOverlayEvent(value: unknown): value is OverlayEvent {
  if (!isRecord(value)) return false;
  return (
    (value.type === "PIXELPARITY/OVERLAY_STATE" && isOverlaySettings(value.settings)) ||
    (value.type === "PIXELPARITY/OVERLAY_MEASUREMENT" &&
      (value.measurement === null || isElementMeasurement(value.measurement)))
  );
}

export function formatMeasurement(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function serializeElementMeasurement(value: ElementMeasurement): string {
  const edges = (items: BoxEdges) => items.map(formatMeasurement).join(" ");
  return [
    `Element: <${value.tag}>`,
    `Bounds: ${formatMeasurement(value.width)} × ${formatMeasurement(value.height)} CSS px`,
    `Viewport position: ${formatMeasurement(value.x)}, ${formatMeasurement(value.y)} CSS px`,
    `Display: ${value.display}; position: ${value.position}; box-sizing: ${value.boxSizing}`,
    `Margin (top right bottom left): ${edges(value.margin)} px`,
    `Padding (top right bottom left): ${edges(value.padding)} px`,
    `Border (top right bottom left): ${edges(value.border)} px`,
    `Gap (row / column): ${value.rowGap} / ${value.columnGap}`,
    `Font size: ${formatMeasurement(value.fontSize)} px; line height: ${value.lineHeight === null ? "normal" : `${formatMeasurement(value.lineHeight)} px`}`,
  ].join("\n");
}
