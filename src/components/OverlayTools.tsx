import { useEffect, useRef, useState } from "preact/hooks";
import { connectOverlay, type OverlayConnection } from "../overlay/client";
import {
  DEFAULT_OVERLAY_SETTINGS,
  formatMeasurement,
  serializeElementMeasurement,
  type BoxEdges,
  type ElementMeasurement,
  type GridType,
  type OverlaySettings,
} from "../shared/overlay";

interface OverlayToolsProps {
  tabId: number;
  enabled: boolean;
  locked?: boolean;
  onStatus?: (message: string) => void;
}

function Toggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      class="layout-toggle"
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  unit = "px",
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label class="field-label layout-number-field">
      <span>{label}</span>
      <span class="input-with-unit">
        <input
          type="number"
          min={min}
          max={max}
          step="1"
          value={value}
          disabled={disabled}
          onInput={(event) => {
            const next = event.currentTarget.valueAsNumber;
            if (Number.isFinite(next))
              onChange(Math.min(max, Math.max(min, Math.round(next))));
          }}
          onBlur={(event) => {
            event.currentTarget.value = String(value);
          }}
        />
        {unit && (
          <span class="unit-label" aria-hidden="true">
            {unit}
          </span>
        )}
      </span>
    </label>
  );
}

function EdgeValues({ label, values }: { label: string; values: BoxEdges }) {
  return (
    <tr class="layout-edge-row">
      <th scope="row">{label}</th>
      {values.map((value, index) => (
        <td key={`${label}-${index}`}>{formatMeasurement(value)}</td>
      ))}
    </tr>
  );
}

function MeasurementCard({
  measurement,
  disabled,
  onCopy,
  onResume,
}: {
  measurement: ElementMeasurement;
  disabled: boolean;
  onCopy: () => void;
  onResume: () => void;
}) {
  return (
    <section
      class="panel-card layout-measurement"
      aria-labelledby="layout-measurement-title"
    >
      <div class="section-heading">
        <div>
          <p class="eyebrow">
            {measurement.locked ? "Locked element" : "Under your pointer"}
          </p>
          <h2 id="layout-measurement-title">&lt;{measurement.tag}&gt;</h2>
        </div>
        <span class="layout-units">CSS px</span>
      </div>
      <div class="layout-bounds">
        <div>
          <span>Width</span>
          <strong>{formatMeasurement(measurement.width)}</strong>
        </div>
        <div>
          <span>Height</span>
          <strong>{formatMeasurement(measurement.height)}</strong>
        </div>
      </div>
      <table class="layout-edge-table" aria-label="Computed box spacing in CSS pixels">
        <thead>
          <tr class="layout-edge-row layout-edge-heading">
            <th scope="col">Spacing</th>
            <th scope="col">Top</th>
            <th scope="col">Right</th>
            <th scope="col">Bottom</th>
            <th scope="col">Left</th>
          </tr>
        </thead>
        <tbody>
          <EdgeValues label="Margin" values={measurement.margin} />
          <EdgeValues label="Border" values={measurement.border} />
          <EdgeValues label="Padding" values={measurement.padding} />
        </tbody>
      </table>
      <dl class="layout-facts">
        <div>
          <dt>Display</dt>
          <dd>{measurement.display}</dd>
        </div>
        <div>
          <dt>Position</dt>
          <dd>{measurement.position}</dd>
        </div>
        <div>
          <dt>Gap · row / column</dt>
          <dd>
            {measurement.rowGap} / {measurement.columnGap}
          </dd>
        </div>
        <div>
          <dt>Font / line height</dt>
          <dd>
            {formatMeasurement(measurement.fontSize)} px /{" "}
            {measurement.lineHeight === null
              ? "normal"
              : `${formatMeasurement(measurement.lineHeight)} px`}
          </dd>
        </div>
      </dl>
      <div class="button-row">
        <button class="button button--secondary" type="button" onClick={onCopy}>
          Copy measurements
        </button>
        {measurement.locked && (
          <button
            class="button button--quiet"
            type="button"
            disabled={disabled}
            onClick={onResume}
          >
            Pick another
          </button>
        )}
      </div>
    </section>
  );
}

export function OverlayTools({
  tabId,
  enabled,
  locked = false,
  onStatus,
}: OverlayToolsProps) {
  const [settings, setSettings] = useState<OverlaySettings>({
    ...DEFAULT_OVERLAY_SETTINGS,
  });
  const [measurement, setMeasurement] = useState<ElementMeasurement | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const connectionRef = useRef<OverlayConnection | null>(null);
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;

  useEffect(() => {
    let cancelled = false;
    setConnected(false);
    setMeasurement(null);
    setSettings((current) => ({
      ...current,
      gridEnabled: false,
      rulers: false,
      inspect: false,
    }));
    if (!enabled) return;
    setError("");
    void connectOverlay(
      tabId,
      (event) => {
        if (cancelled) return;
        if (event.type === "PIXELPARITY/OVERLAY_STATE") setSettings(event.settings);
        else setMeasurement(event.measurement);
      },
      () => {
        if (cancelled) return;
        connectionRef.current = null;
        setConnected(false);
        setMeasurement(null);
        setSettings((current) => ({
          ...current,
          gridEnabled: false,
          rulers: false,
          inspect: false,
        }));
        setError(
          "Layout tools disconnected. Reopen PixelParity from the toolbar on this page.",
        );
      },
    )
      .then((connection) => {
        if (cancelled) {
          connection.close();
          return;
        }
        connectionRef.current = connection;
        setConnected(true);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "This page cannot be inspected. Reopen PixelParity from the toolbar on a normal website.",
          );
      });
    return () => {
      cancelled = true;
      connectionRef.current?.close();
      connectionRef.current = null;
    };
  }, [tabId, enabled, retry]);

  const disabled = !enabled || !connected || locked;
  const update = (patch: Partial<OverlaySettings>) => {
    if (disabled) return;
    const next = { ...settings, ...patch };
    try {
      connectionRef.current?.send({ type: "PIXELPARITY/OVERLAY_SET", settings: next });
      setSettings(next);
      setError("");
    } catch {
      setError("The page connection was lost. Reopen PixelParity from the toolbar.");
      setConnected(false);
    }
  };

  const clear = () => {
    try {
      connectionRef.current?.send({ type: "PIXELPARITY/OVERLAY_CLEAR" });
      setSettings((current) => ({
        ...current,
        gridEnabled: false,
        rulers: false,
        inspect: false,
      }));
      setMeasurement(null);
      statusRef.current?.("All page overlays cleared.");
    } catch {
      setError(
        "The page connection was lost. Reload the page to clear any remaining overlays.",
      );
    }
  };

  const copy = async () => {
    if (!measurement) return;
    try {
      await navigator.clipboard.writeText(serializeElementMeasurement(measurement));
      statusRef.current?.(
        "Element measurements copied. No page text or identifiers included.",
      );
    } catch {
      setError("Could not copy measurements. Keep this panel focused and try again.");
    }
  };

  const resume = () => {
    if (disabled) return;
    try {
      connectionRef.current?.send({ type: "PIXELPARITY/OVERLAY_RESUME" });
      setMeasurement(null);
    } catch {
      setError("The page connection was lost. Reopen PixelParity from the toolbar.");
    }
  };

  const preset = (gridType: GridType, spacing?: number) =>
    update({
      gridEnabled: true,
      gridType,
      ...(spacing === undefined
        ? { columns: 12, gutter: 24, margin: 24, maxWidth: 1200 }
        : { spacing }),
    });

  return (
    <div class="layout-tools panel-section-stack">
      {locked && (
        <p class="layout-hint" role="status">
          Layout controls pause while capturing.
        </p>
      )}
      <section class="panel-card layout-grid-card" aria-labelledby="layout-grid-title">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Visual alignment</p>
            <h2 id="layout-grid-title">Grid overlay</h2>
          </div>
          <Toggle
            checked={settings.gridEnabled}
            disabled={disabled}
            label="Show grid overlay"
            onChange={(gridEnabled) => update({ gridEnabled })}
          />
        </div>
        <p class="layout-description">
          Check columns, spacing, and rhythm directly on the page.
        </p>
        <fieldset class="layout-presets">
          <legend class="sr-only">Grid presets</legend>
          <button type="button" disabled={disabled} onClick={() => preset("columns")}>
            12 columns
          </button>
          <button type="button" disabled={disabled} onClick={() => preset("square", 8)}>
            8 px grid
          </button>
          <button type="button" disabled={disabled} onClick={() => preset("baseline", 4)}>
            4 px baseline
          </button>
        </fieldset>
        <fieldset class="layout-style-fieldset" disabled={disabled}>
          <legend class="field-label">Grid style</legend>
          <div class="layout-segmented">
            {(["columns", "square", "baseline"] as const).map((gridType) => (
              <label key={gridType}>
                <input
                  type="radio"
                  name="layout-grid-type"
                  value={gridType}
                  checked={settings.gridType === gridType}
                  onChange={() => update({ gridType })}
                />
                <span>
                  {gridType === "columns"
                    ? "Columns"
                    : gridType === "square"
                      ? "Square"
                      : "Baseline"}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {settings.gridType === "columns" ? (
          <div class="layout-fields">
            <NumberField
              label="Columns"
              value={settings.columns}
              min={1}
              max={24}
              unit=""
              disabled={disabled}
              onChange={(columns) => update({ columns })}
            />
            <NumberField
              label="Gutter"
              value={settings.gutter}
              min={0}
              max={160}
              disabled={disabled}
              onChange={(gutter) => update({ gutter })}
            />
            <NumberField
              label="Outer margin"
              value={settings.margin}
              min={0}
              max={400}
              disabled={disabled}
              onChange={(margin) => update({ margin })}
            />
            <NumberField
              label="Max width · 0 = fluid"
              value={settings.maxWidth}
              min={0}
              max={3840}
              disabled={disabled}
              onChange={(maxWidth) => update({ maxWidth })}
            />
          </div>
        ) : (
          <NumberField
            label={settings.gridType === "baseline" ? "Baseline spacing" : "Grid spacing"}
            value={settings.spacing}
            min={2}
            max={128}
            disabled={disabled}
            onChange={(spacing) => update({ spacing })}
          />
        )}
        <div class="layout-appearance">
          <label class="field-label layout-color-field">
            <span>Color</span>
            <input
              type="color"
              value={settings.color}
              disabled={disabled}
              onInput={(event) => update({ color: event.currentTarget.value })}
            />
          </label>
          <label class="field-label layout-opacity">
            <span>
              Opacity <strong>{Math.round(settings.opacity * 100)}%</strong>
            </span>
            <input
              type="range"
              min="5"
              max="60"
              step="1"
              value={Math.round(settings.opacity * 100)}
              disabled={disabled}
              onInput={(event) =>
                update({ opacity: event.currentTarget.valueAsNumber / 100 })
              }
            />
          </label>
        </div>
      </section>

      <section class="panel-card layout-ruler-card" aria-labelledby="layout-rulers-title">
        <div>
          <h2 id="layout-rulers-title">Page rulers</h2>
          <p class="layout-description">CSS pixels, anchored to the document.</p>
        </div>
        <Toggle
          checked={settings.rulers}
          disabled={disabled}
          label="Show page rulers"
          onChange={(rulers) => update({ rulers })}
        />
      </section>

      <section class="panel-card layout-picker-card" aria-labelledby="layout-picker-title">
        <p class="eyebrow">Element inspector</p>
        <h2 id="layout-picker-title">Understand the spacing</h2>
        <p class="layout-description">
          Point to an element for its bounds and computed spacing. Click to lock it.
        </p>
        <button
          class={`button ${settings.inspect ? "button--secondary" : "button--primary"}`}
          type="button"
          disabled={disabled}
          aria-pressed={settings.inspect}
          onClick={() => {
            update({ inspect: !settings.inspect });
            statusRef.current?.(
              settings.inspect
                ? "Element picker stopped."
                : "Move your pointer onto the page. Click an element to lock its measurements. Escape exits the picker.",
            );
          }}
        >
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 3h7v2H5v5H3zm11 0h7v7h-2V5h-5zM3 14h2v5h5v2H3zm16 0h2v7h-7v-2h5zM11 8h2v3h3v2h-3v3h-2v-3H8v-2h3z" />
          </svg>
          {settings.inspect ? "Stop inspecting" : "Pick an element"}
        </button>
        <p class="layout-hint">
          Esc exits the picker. Esc again clears the grid and rulers.
        </p>
      </section>
      {measurement && (
        <MeasurementCard
          measurement={measurement}
          disabled={disabled}
          onCopy={() => void copy()}
          onResume={resume}
        />
      )}
      {error && (
        <div class="inline-error" role="alert">
          <p>{error}</p>
          {enabled && !connected && (
            <button
              class="button button--secondary"
              type="button"
              onClick={() => setRetry((value) => value + 1)}
            >
              Reconnect tools
            </button>
          )}
        </div>
      )}
      {!enabled && (
        <p class="layout-hint">
          Open PixelParity from the toolbar on the page you want to inspect.
        </p>
      )}
      <div class="layout-footer">
        <span>Temporary overlays. No page content saved.</span>
        <button
          class="button button--quiet"
          type="button"
          disabled={
            disabled || (!settings.gridEnabled && !settings.rulers && !settings.inspect)
          }
          onClick={clear}
        >
          Clear all
        </button>
      </div>
    </div>
  );
}
