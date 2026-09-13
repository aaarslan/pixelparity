import { formatDelta, formatDimensions, formatNumber, formatTimestamp } from "./format";
import type { MetricsSnapshotV2 } from "./types";

interface ComparisonRow {
  metric: string;
  baseline: string;
  reproduced: string;
  difference: string;
}

function escapeMarkdownInline(value: string): string {
  const withoutControlCharacters = Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    const isControlCharacter =
      codePoint <= 0x1f ||
      (codePoint >= 0x7f && codePoint <= 0x9f) ||
      codePoint === 0x2028 ||
      codePoint === 0x2029;
    return isControlCharacter ? " " : character;
  }).join("");

  return withoutControlCharacters
    .replace(/\s+/g, " ")
    .trim()
    .replace(/([\\`*_[\]{}()#+\-.!|<>])/g, "\\$1");
}

function layoutDifference(baseline: MetricsSnapshotV2, current: MetricsSnapshotV2): string {
  const width = current.viewport.layout.width - baseline.viewport.layout.width;
  const height = current.viewport.layout.height - baseline.viewport.layout.height;
  return `${formatDelta(width, " px")} wide; ${formatDelta(height, " px")} tall`;
}

function comparisonRows(
  baseline: MetricsSnapshotV2,
  current: MetricsSnapshotV2,
): ComparisonRow[] {
  return [
    {
      metric: "Layout viewport",
      baseline: formatDimensions(
        baseline.viewport.layout.width,
        baseline.viewport.layout.height,
      ),
      reproduced: formatDimensions(
        current.viewport.layout.width,
        current.viewport.layout.height,
      ),
      difference: layoutDifference(baseline, current),
    },
    {
      metric: "Browser zoom",
      baseline: `${formatNumber(baseline.display.tabZoomPercent)}%`,
      reproduced: `${formatNumber(current.display.tabZoomPercent)}%`,
      difference: `${formatDelta(current.display.tabZoomPercent - baseline.display.tabZoomPercent, " percentage points")}`,
    },
    {
      metric: "Device pixel ratio",
      baseline: `${formatNumber(baseline.display.devicePixelRatio)}×`,
      reproduced: `${formatNumber(current.display.devicePixelRatio)}×`,
      difference: formatDelta(
        current.display.devicePixelRatio - baseline.display.devicePixelRatio,
      ),
    },
    {
      metric: "Visual viewport scale",
      baseline: `${formatNumber(baseline.viewport.visual.scale)}×`,
      reproduced: `${formatNumber(current.viewport.visual.scale)}×`,
      difference: formatDelta(
        current.viewport.visual.scale - baseline.viewport.visual.scale,
      ),
    },
    {
      metric: "Responsive range",
      baseline: `${escapeMarkdownInline(baseline.breakpoint.label)} (${formatNumber(baseline.breakpoint.minWidth)} px+)`,
      reproduced: `${escapeMarkdownInline(current.breakpoint.label)} (${formatNumber(current.breakpoint.minWidth)} px+)`,
      difference:
        baseline.breakpoint.pointId === current.breakpoint.pointId
          ? "Unchanged"
          : "Changed",
    },
  ];
}

/**
 * Creates a paste-ready report from the in-memory baseline and live snapshot.
 * It intentionally leaves page and product context for the author to add, because
 * PixelParity does not collect URLs, titles, or page content.
 */
export function serializeIssueReport(
  baseline: MetricsSnapshotV2,
  current: MetricsSnapshotV2,
): string {
  const rows = comparisonRows(baseline, current)
    .map(
      (row) =>
        `| ${row.metric} | ${row.baseline} | ${row.reproduced} | ${row.difference} |`,
    )
    .join("\n");

  return `## Responsive mismatch reproduction

### Expected behavior
[Author: describe what should happen.]

### Actual behavior
[Author: describe what happened instead.]

### Steps
1. Inspect the affected view with PixelParity.
2. Capture a baseline in the working state.
3. Reproduce the mismatch by resizing the viewport and/or changing Chrome tab zoom.
4. Add the affected product, page, or build context and complete the behavior sections above.

### Captures
- Baseline: ${formatTimestamp(baseline.capturedAt)}
- Reproduced: ${formatTimestamp(current.capturedAt)}
- Breakpoint profile: ${escapeMarkdownInline(current.breakpoint.profileName)}

| Metric | Baseline | Reproduced | Difference |
| --- | ---: | ---: | --- |
${rows}

### Privacy note
PixelParity exports measurements and breakpoint context only. Add the affected page or build context manually; this report does not include a URL, title, page content, or browsing history.
`;
}
