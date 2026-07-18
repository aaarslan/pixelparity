import type { ComponentChildren } from "preact";
import {
  formatBoolean,
  formatDelta,
  formatDimensions,
  formatNumber,
} from "../shared/format";
import type { BreakpointProfile, MetricsSnapshotV2 } from "../shared/types";

interface PrimaryMetricProps {
  metricId: string;
  label: string;
  value: string;
  unit?: string | undefined;
  hint: string;
  delta?: string | undefined;
  accent?: boolean | undefined;
}

export function PrimaryMetric({
  metricId,
  label,
  value,
  unit,
  hint,
  delta,
  accent,
}: PrimaryMetricProps) {
  return (
    <article
      class={`primary-metric${accent ? " primary-metric--accent" : ""}`}
      data-metric={metricId}
    >
      <span class="metric-label">{label}</span>
      <span class="primary-value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
      <span class="metric-hint">{hint}</span>
      {delta && <span class="delta-badge">{delta}</span>}
    </article>
  );
}

export function PrimaryMetrics({
  snapshot,
  baseline,
}: {
  snapshot: MetricsSnapshotV2;
  baseline?: MetricsSnapshotV2 | null;
}) {
  return (
    <section class="primary-grid" aria-label="Essential display metrics">
      <PrimaryMetric
        metricId="layout-viewport"
        label="Layout viewport"
        value={`${formatNumber(snapshot.viewport.layout.width)} × ${formatNumber(snapshot.viewport.layout.height)}`}
        unit="CSS px"
        hint="Responsive layout area"
        delta={
          baseline
            ? formatDelta(
                snapshot.viewport.layout.width - baseline.viewport.layout.width,
                " px wide",
              )
            : undefined
        }
      />
      <PrimaryMetric
        metricId="browser-zoom"
        label="Browser zoom"
        value={formatNumber(snapshot.display.tabZoomPercent)}
        unit="%"
        hint="Chrome tab zoom"
        delta={
          baseline
            ? formatDelta(
                snapshot.display.tabZoomPercent - baseline.display.tabZoomPercent,
                "%",
              )
            : undefined
        }
      />
      <PrimaryMetric
        metricId="device-pixel-ratio"
        label="Device pixel ratio"
        value={formatNumber(snapshot.display.devicePixelRatio)}
        unit="×"
        hint="CSS-to-device scale"
        delta={
          baseline
            ? formatDelta(
                snapshot.display.devicePixelRatio - baseline.display.devicePixelRatio,
                "×",
              )
            : undefined
        }
      />
      <PrimaryMetric
        metricId="active-breakpoint"
        label="Active breakpoint"
        value={snapshot.breakpoint.label}
        hint={snapshot.breakpoint.profileName}
        accent
      />
    </section>
  );
}

function MetricRow({
  label,
  children,
  delta,
}: {
  label: string;
  children: ComponentChildren;
  delta?: string | undefined;
}) {
  return (
    <div class="metric-row">
      <dt>{label}</dt>
      <dd>
        {children}
        {delta && <span class="row-delta">{delta}</span>}
      </dd>
    </div>
  );
}

export function MetricDetails({
  snapshot,
  baseline,
  openSection,
}: {
  snapshot: MetricsSnapshotV2;
  baseline?: MetricsSnapshotV2 | null;
  openSection?: "viewport" | "screen" | "document" | "environment";
}) {
  return (
    <div class="disclosure-stack">
      <details open={openSection === "viewport"}>
        <summary>Viewport & display</summary>
        <dl class="metric-list">
          <MetricRow label="Layout viewport">
            {formatDimensions(
              snapshot.viewport.layout.width,
              snapshot.viewport.layout.height,
            )}
          </MetricRow>
          <MetricRow label="Visual viewport">
            {formatDimensions(
              snapshot.viewport.visual.width,
              snapshot.viewport.visual.height,
            )}
          </MetricRow>
          <MetricRow label="Visual offset">
            {formatDimensions(
              snapshot.viewport.visual.offsetLeft,
              snapshot.viewport.visual.offsetTop,
            )}
          </MetricRow>
          <MetricRow label="Visual scale">
            {formatNumber(snapshot.viewport.visual.scale)}×
          </MetricRow>
          <MetricRow label="Outer window">
            {formatDimensions(
              snapshot.viewport.outer.width,
              snapshot.viewport.outer.height,
            )}
          </MetricRow>
          <MetricRow label="Scrollbar">
            {formatDimensions(
              snapshot.viewport.scrollbar.width,
              snapshot.viewport.scrollbar.height,
            )}
          </MetricRow>
          <MetricRow label="Aspect ratio">
            {formatNumber(snapshot.viewport.layout.aspectRatio, 3)}
          </MetricRow>
          <MetricRow
            label="Rendered estimate"
            delta={
              baseline
                ? formatDelta(
                    snapshot.display.renderedPixelEstimate.width -
                      baseline.display.renderedPixelEstimate.width,
                    " px wide",
                  )
                : undefined
            }
          >
            {formatDimensions(
              snapshot.display.renderedPixelEstimate.width,
              snapshot.display.renderedPixelEstimate.height,
              "device px",
            )}
          </MetricRow>
        </dl>
      </details>

      <details open={openSection === "screen"}>
        <summary>Screen (CSS pixels)</summary>
        <dl class="metric-list">
          <MetricRow label="Screen">
            {formatDimensions(snapshot.screen.width, snapshot.screen.height)}
          </MetricRow>
          <MetricRow label="Available">
            {formatDimensions(
              snapshot.screen.availableWidth,
              snapshot.screen.availableHeight,
            )}
          </MetricRow>
          <MetricRow label="Color / pixel depth">
            {formatNumber(snapshot.screen.colorDepth)} /{" "}
            {formatNumber(snapshot.screen.pixelDepth)} bit
          </MetricRow>
          <MetricRow label="Orientation">{snapshot.screen.orientationType}</MetricRow>
          <MetricRow label="Orientation angle">
            {formatNumber(snapshot.screen.orientationAngle)}°
          </MetricRow>
        </dl>
      </details>

      <details open={openSection === "document"}>
        <summary>Document & typography</summary>
        <dl class="metric-list">
          <MetricRow label="Document extent">
            {formatDimensions(snapshot.document.width, snapshot.document.height)}
          </MetricRow>
          <MetricRow label="Root font size">
            {formatNumber(snapshot.typography.rootFontSize)} px
          </MetricRow>
          <MetricRow label="Body font size">
            {formatNumber(snapshot.typography.bodyFontSize)} px
          </MetricRow>
        </dl>
      </details>

      <details open={openSection === "environment"}>
        <summary>Media environment</summary>
        <dl class="metric-list">
          <MetricRow label="Color scheme">{snapshot.environment.colorScheme}</MetricRow>
          <MetricRow label="Reduced motion">
            {formatBoolean(snapshot.environment.reducedMotion)}
          </MetricRow>
          <MetricRow label="Forced colors">
            {formatBoolean(snapshot.environment.forcedColors)}
          </MetricRow>
          <MetricRow label="Primary pointer">{snapshot.environment.pointer}</MetricRow>
          <MetricRow label="Hover">{snapshot.environment.hover}</MetricRow>
          <MetricRow label="Color gamut">{snapshot.environment.colorGamut}</MetricRow>
        </dl>
      </details>
    </div>
  );
}

export function BreakpointRail({
  profile,
  activePointId,
}: {
  profile: BreakpointProfile;
  activePointId: string;
}) {
  return (
    <ol class="breakpoint-rail" aria-label={`${profile.name} breakpoints`}>
      {profile.points.map((point, index) => {
        const next = profile.points[index + 1];
        const range = next
          ? `${point.minWidth}–${next.minWidth - 1}`
          : `≥${point.minWidth}`;
        const active = point.id === activePointId;
        return (
          <li
            class={active ? "is-active" : undefined}
            aria-current={active ? "true" : undefined}
            key={point.id}
          >
            <strong>{point.label}</strong>
            <span>{range}</span>
          </li>
        );
      })}
    </ol>
  );
}
