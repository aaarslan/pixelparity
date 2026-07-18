import { formatBoolean, formatNumber, formatTimestamp } from "./format";
import type { ExportFormat, MetricsSnapshotV2 } from "./types";

interface ExportRow {
  key: string;
  label: string;
  value: string;
  cssValue: string;
}

export function snapshotRows(snapshot: MetricsSnapshotV2): ExportRow[] {
  const row = (
    key: string,
    label: string,
    value: number | string,
    unit = "",
  ): ExportRow => {
    const formatted = typeof value === "number" ? formatNumber(value) : value;
    return { key, label, value: `${formatted}${unit}`, cssValue: `${formatted}${unit}` };
  };

  return [
    row(
      "viewport-layout-width",
      "Layout viewport width",
      snapshot.viewport.layout.width,
      "px",
    ),
    row(
      "viewport-layout-height",
      "Layout viewport height",
      snapshot.viewport.layout.height,
      "px",
    ),
    row(
      "viewport-aspect-ratio",
      "Layout viewport aspect ratio",
      snapshot.viewport.layout.aspectRatio,
    ),
    row(
      "viewport-visual-width",
      "Visual viewport width",
      snapshot.viewport.visual.width,
      "px",
    ),
    row(
      "viewport-visual-height",
      "Visual viewport height",
      snapshot.viewport.visual.height,
      "px",
    ),
    row(
      "viewport-visual-offset-left",
      "Visual viewport left offset",
      snapshot.viewport.visual.offsetLeft,
      "px",
    ),
    row(
      "viewport-visual-offset-top",
      "Visual viewport top offset",
      snapshot.viewport.visual.offsetTop,
      "px",
    ),
    row("viewport-visual-scale", "Visual viewport scale", snapshot.viewport.visual.scale),
    row("viewport-outer-width", "Outer window width", snapshot.viewport.outer.width, "px"),
    row(
      "viewport-outer-height",
      "Outer window height",
      snapshot.viewport.outer.height,
      "px",
    ),
    row("scrollbar-width", "Scrollbar width", snapshot.viewport.scrollbar.width, "px"),
    row("scrollbar-height", "Scrollbar height", snapshot.viewport.scrollbar.height, "px"),
    row("browser-zoom", "Browser zoom", snapshot.display.tabZoomPercent, "%"),
    row("device-pixel-ratio", "Device pixel ratio", snapshot.display.devicePixelRatio),
    row(
      "rendered-width-estimate",
      "Rendered width estimate",
      snapshot.display.renderedPixelEstimate.width,
      "px",
    ),
    row(
      "rendered-height-estimate",
      "Rendered height estimate",
      snapshot.display.renderedPixelEstimate.height,
      "px",
    ),
    row("screen-width", "Screen width (CSS pixels)", snapshot.screen.width, "px"),
    row("screen-height", "Screen height (CSS pixels)", snapshot.screen.height, "px"),
    row(
      "screen-available-width",
      "Available screen width (CSS pixels)",
      snapshot.screen.availableWidth,
      "px",
    ),
    row(
      "screen-available-height",
      "Available screen height (CSS pixels)",
      snapshot.screen.availableHeight,
      "px",
    ),
    row("screen-color-depth", "Color depth", snapshot.screen.colorDepth, "bit"),
    row("screen-pixel-depth", "Pixel depth", snapshot.screen.pixelDepth, "bit"),
    row("screen-orientation", "Orientation", snapshot.screen.orientationType),
    row(
      "screen-orientation-angle",
      "Orientation angle",
      snapshot.screen.orientationAngle,
      "deg",
    ),
    row("document-width", "Document width", snapshot.document.width, "px"),
    row("document-height", "Document height", snapshot.document.height, "px"),
    row("root-font-size", "Root font size", snapshot.typography.rootFontSize, "px"),
    row("body-font-size", "Body font size", snapshot.typography.bodyFontSize, "px"),
    row("color-scheme", "Preferred color scheme", snapshot.environment.colorScheme),
    row(
      "reduced-motion",
      "Reduced motion",
      formatBoolean(snapshot.environment.reducedMotion),
    ),
    row("forced-colors", "Forced colors", formatBoolean(snapshot.environment.forcedColors)),
    row("pointer", "Primary pointer", snapshot.environment.pointer),
    row("hover", "Hover capability", snapshot.environment.hover),
    row("color-gamut", "Color gamut", snapshot.environment.colorGamut),
    row("breakpoint", "Active breakpoint", snapshot.breakpoint.label),
    row(
      "breakpoint-min-width",
      "Active breakpoint minimum",
      snapshot.breakpoint.minWidth,
      "px",
    ),
    row("breakpoint-profile", "Breakpoint profile", snapshot.breakpoint.profileName),
  ];
}

export function serializeJson(snapshot: MetricsSnapshotV2): string {
  return JSON.stringify(snapshot, null, 2);
}

export function serializeCss(snapshot: MetricsSnapshotV2): string {
  const variables = snapshotRows(snapshot)
    .map(({ key, cssValue }) => `  --pixelparity-${key}: ${cssValue};`)
    .join("\n");
  return `/* PixelParity snapshot schema v${snapshot.schemaVersion}\n   Captured ${formatTimestamp(snapshot.capturedAt)} */\n:root {\n${variables}\n}\n`;
}

function escapeMarkdown(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function serializeMarkdown(snapshot: MetricsSnapshotV2): string {
  const rows = snapshotRows(snapshot)
    .map(({ label, value }) => `| ${escapeMarkdown(label)} | ${escapeMarkdown(value)} |`)
    .join("\n");
  return `<!-- PixelParity snapshot schema v${snapshot.schemaVersion}; ${formatTimestamp(snapshot.capturedAt)} -->\n| Metric | Value |\n| --- | ---: |\n${rows}\n`;
}

function escapeTsv(value: string): string {
  return value.replaceAll("\t", " ").replaceAll("\r", " ").replaceAll("\n", " ");
}

export function serializeTsv(snapshot: MetricsSnapshotV2): string {
  const rows = snapshotRows(snapshot)
    .map(({ label, value }) => `${escapeTsv(label)}\t${escapeTsv(value)}`)
    .join("\n");
  return `Metric\tValue\n${rows}\n`;
}

export function serializeSnapshot(
  snapshot: MetricsSnapshotV2,
  format: ExportFormat,
): string {
  switch (format) {
    case "json":
      return serializeJson(snapshot);
    case "css":
      return serializeCss(snapshot);
    case "markdown":
      return serializeMarkdown(snapshot);
    case "tsv":
      return serializeTsv(snapshot);
  }
}

export const EXPORT_LABELS: Record<ExportFormat, string> = {
  json: "JSON",
  css: "CSS variables",
  markdown: "Markdown table",
  tsv: "TSV",
};

export function downloadJson(snapshot: MetricsSnapshotV2): void {
  const blob = new Blob([serializeJson(snapshot)], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `pixelparity-snapshot-${new Date(snapshot.capturedAt).toISOString().replaceAll(":", "-")}.json`;
  anchor.rel = "noopener";
  anchor.click();
  queueMicrotask(() => URL.revokeObjectURL(objectUrl));
}
