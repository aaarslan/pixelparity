import { formatDelta, formatDimensions, formatNumber, formatTimestamp } from "./format";
import type { MetricsSnapshotV2 } from "./types";

interface ComparisonRow {
  metric: string;
  baseline: string;
  reproduced: string;
  difference: string;
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
      baseline: `${baseline.breakpoint.label} (${formatNumber(baseline.breakpoint.minWidth)} px+)`,
      reproduced: `${current.breakpoint.label} (${formatNumber(current.breakpoint.minWidth)} px+)`,
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

### Steps
1. Inspect the affected view with PixelParity.
2. Capture a baseline in the working state.
3. Reproduce the mismatch by resizing the viewport and/or changing Chrome tab zoom.
4. Paste this report with the product, page, and expected behavior context added manually.

### Captures
- Baseline: ${formatTimestamp(baseline.capturedAt)}
- Reproduced: ${formatTimestamp(current.capturedAt)}
- Breakpoint profile: ${current.breakpoint.profileName}

| Metric | Baseline | Reproduced | Difference |
| --- | ---: | ---: | --- |
${rows}

### Privacy note
PixelParity exports measurements and breakpoint context only. Add the affected page or build context manually; this report does not include a URL, title, page content, or browsing history.
`;
}
