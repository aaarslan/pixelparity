import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { Brand, Icon } from "../components/Brand";
import { BreakpointRail, MetricDetails, PrimaryMetrics } from "../components/Metrics";
import {
  createPointId,
  createProfileId,
  findProfile,
  getAllProfiles,
  validateCustomProfiles,
  validateProfile,
} from "../shared/breakpoints";
import {
  connectLiveBridge,
  injectBridge,
  mergeLiveMetrics,
  sendLiveControl,
} from "../shared/chrome-runtime";
import {
  DEFAULT_PREFERENCES,
  MAX_BREAKPOINTS_PER_PROFILE,
  MAX_CUSTOM_PROFILES,
} from "../shared/constants";
import { ERROR_CONTENT, toStableError } from "../shared/errors";
import { downloadJson, EXPORT_LABELS, serializeSnapshot } from "../shared/exports";
import { formatTimestamp } from "../shared/format";
import { MESSAGE_TYPES, isLiveBridgeMessage } from "../shared/protocol";
import { initializeStorage, savePreferences } from "../shared/storage";
import { applyPreferencesToDocument } from "../shared/theme";
import type {
  BreakpointProfile,
  ExportFormat,
  MetricsSnapshotV2,
  PageMetrics,
  PreferencesV2,
  StableErrorCode,
} from "../shared/types";

type InspectorState = "connecting" | "live" | "paused" | "error";
export type PanelSection = "inspect" | "breakpoints" | "export";

interface SidePanelViewProps {
  preferences: PreferencesV2;
  snapshot: MetricsSnapshotV2 | null;
  baseline: MetricsSnapshotV2 | null;
  inspectorState: InspectorState;
  errorCode: StableErrorCode;
  status: string;
  defaultSection?: PanelSection;
  onReconnect: () => void;
  onSetBaseline: () => void;
  onClearBaseline: () => void;
  onPreferencesChange: (preferences: PreferencesV2) => Promise<void> | void;
  onStatus: (message: string) => void;
}

function ConnectionPill({ state }: { state: InspectorState }) {
  const labels: Record<InspectorState, string> = {
    connecting: "Connecting",
    live: "Live",
    paused: "Paused",
    error: "Disconnected",
  };
  return (
    <span class={`connection-pill connection-pill--${state}`} role="status">
      <span class="connection-dot" aria-hidden="true" /> {labels[state]}
    </span>
  );
}

function ProfileEditor({
  draft,
  onCancel,
  onSave,
}: {
  draft: BreakpointProfile;
  onCancel: () => void;
  onSave: (profile: BreakpointProfile) => void;
}) {
  const [profile, setProfile] = useState<BreakpointProfile>(structuredClone(draft));
  const [errors, setErrors] = useState<string[]>([]);

  const updatePoint = (
    index: number,
    patch: Partial<BreakpointProfile["points"][number]>,
  ) => {
    setProfile((current) => ({
      ...current,
      points: current.points.map((point, pointIndex) =>
        pointIndex === index ? { ...point, ...patch } : point,
      ),
    }));
  };

  const save = () => {
    const normalized = {
      ...profile,
      name: profile.name.trim(),
      points: profile.points.map((point) => ({ ...point, label: point.label.trim() })),
    };
    const result = validateProfile(normalized);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    onSave(normalized);
  };

  return (
    <section class="editor-card" aria-labelledby="profile-editor-title">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Custom profile</p>
          <h2 id="profile-editor-title">Breakpoint editor</h2>
        </div>
        <span class="count-badge">
          {profile.points.length}/{MAX_BREAKPOINTS_PER_PROFILE}
        </span>
      </div>
      <label class="field-label">
        <span>Profile name</span>
        <input
          value={profile.name}
          maxlength={40}
          onInput={(event) => setProfile({ ...profile, name: event.currentTarget.value })}
        />
      </label>
      <fieldset class="point-editor">
        <legend class="sr-only">Breakpoint points</legend>
        {profile.points.map((point, index) => (
          <fieldset class="point-row" key={point.id}>
            <legend class="sr-only">Breakpoint {index + 1}</legend>
            <label>
              <span>Label</span>
              <input
                value={point.label}
                maxlength={16}
                onInput={(event) =>
                  updatePoint(index, { label: event.currentTarget.value })
                }
              />
            </label>
            <label>
              <span>Min width</span>
              <span class="input-with-unit">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={point.minWidth}
                  onInput={(event) =>
                    updatePoint(index, { minWidth: event.currentTarget.valueAsNumber })
                  }
                />
                <span class="unit-label">px</span>
              </span>
            </label>
            <button
              class="icon-button icon-button--danger"
              type="button"
              onClick={() =>
                setProfile({
                  ...profile,
                  points: profile.points.filter((_, pointIndex) => pointIndex !== index),
                })
              }
              aria-label={`Remove ${point.label || `breakpoint ${index + 1}`}`}
            >
              <Icon name="trash" />
            </button>
          </fieldset>
        ))}
      </fieldset>
      {profile.points.length < MAX_BREAKPOINTS_PER_PROFILE && (
        <button
          class="button button--quiet"
          type="button"
          onClick={() => {
            const previous = profile.points.at(-1)?.minWidth ?? -320;
            setProfile({
              ...profile,
              points: [
                ...profile.points,
                {
                  id: createPointId(),
                  label: `BP${profile.points.length + 1}`,
                  minWidth: previous + 320,
                },
              ],
            });
          }}
        >
          <Icon name="plus" /> Add breakpoint
        </button>
      )}
      {errors.length > 0 && (
        <div class="inline-error" role="alert">
          <strong>Check this profile</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <div class="button-row button-row--end">
        <button class="button button--quiet" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button class="button button--primary" type="button" onClick={save}>
          Save profile
        </button>
      </div>
    </section>
  );
}

function BreakpointManager({
  preferences,
  snapshot,
  onPreferencesChange,
}: Pick<SidePanelViewProps, "preferences" | "snapshot" | "onPreferencesChange">) {
  const [draft, setDraft] = useState<BreakpointProfile | null>(null);
  const [error, setError] = useState("");
  const profiles = getAllProfiles(preferences.customProfiles);
  const active = findProfile(preferences.activeProfileId, preferences.customProfiles);

  const saveProfile = async (profile: BreakpointProfile) => {
    const others = preferences.customProfiles.filter((item) => item.id !== profile.id);
    const nextProfiles = [...others, profile];
    const validation = validateCustomProfiles(nextProfiles);
    if (!validation.valid) {
      setError(validation.errors.join(" "));
      return;
    }
    await onPreferencesChange({
      ...preferences,
      customProfiles: nextProfiles,
      activeProfileId: profile.id,
    });
    setError("");
    setDraft(null);
  };

  const removeProfile = async (profileId: string) => {
    const nextProfiles = preferences.customProfiles.filter(
      (profile) => profile.id !== profileId,
    );
    await onPreferencesChange({
      ...preferences,
      customProfiles: nextProfiles,
      activeProfileId:
        preferences.activeProfileId === profileId
          ? "pixelparity-classic"
          : preferences.activeProfileId,
    });
  };

  if (draft)
    return (
      <ProfileEditor
        draft={draft}
        onCancel={() => setDraft(null)}
        onSave={(profile) => void saveProfile(profile)}
      />
    );

  return (
    <div class="panel-section-stack">
      <section class="panel-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Responsive ranges</p>
            <h2>Breakpoint profile</h2>
          </div>
          {snapshot && <span class="breakpoint-badge">{snapshot.breakpoint.label}</span>}
        </div>
        <label class="field-label">
          <span>Active profile</span>
          <select
            value={preferences.activeProfileId}
            onChange={(event) =>
              void onPreferencesChange({
                ...preferences,
                activeProfileId: event.currentTarget.value,
              })
            }
          >
            {profiles.map((profile) => (
              <option value={profile.id} key={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>
        {snapshot && (
          <BreakpointRail profile={active} activePointId={snapshot.breakpoint.pointId} />
        )}
      </section>

      <section class="panel-card">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Synced preferences</p>
            <h2>Custom profiles</h2>
          </div>
          <span class="count-badge">
            {preferences.customProfiles.length}/{MAX_CUSTOM_PROFILES}
          </span>
        </div>
        {preferences.customProfiles.length === 0 ? (
          <p class="empty-copy">
            Create a profile for your design system. Measurements remain local; only this
            configuration may sync through Chrome.
          </p>
        ) : (
          <ul class="profile-list">
            {preferences.customProfiles.map((profile) => (
              <li key={profile.id}>
                <div>
                  <strong>{profile.name}</strong>
                  <span>{profile.points.length} breakpoints</span>
                </div>
                <div class="row-actions">
                  <button
                    class="icon-button"
                    type="button"
                    onClick={() => setDraft(profile)}
                    aria-label={`Edit ${profile.name}`}
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    class="icon-button icon-button--danger"
                    type="button"
                    onClick={() => void removeProfile(profile.id)}
                    aria-label={`Delete ${profile.name}`}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {preferences.customProfiles.length < MAX_CUSTOM_PROFILES && (
          <button
            class="button button--secondary"
            type="button"
            onClick={() =>
              setDraft({
                id: createProfileId("My breakpoints"),
                name: "My breakpoints",
                points: [
                  { id: createPointId(), label: "Base", minWidth: 0 },
                  { id: createPointId(), label: "Tablet", minWidth: 768 },
                  { id: createPointId(), label: "Desktop", minWidth: 1200 },
                ],
              })
            }
          >
            <Icon name="plus" /> New profile
          </button>
        )}
        {error && (
          <p class="inline-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

function ExportPanel({
  snapshot,
  preferences,
  onPreferencesChange,
  onStatus,
}: Pick<
  SidePanelViewProps,
  "snapshot" | "preferences" | "onPreferencesChange" | "onStatus"
>) {
  const [format, setFormat] = useState<ExportFormat>(preferences.defaultExportFormat);
  const copy = async () => {
    if (!snapshot) return;
    try {
      await navigator.clipboard.writeText(serializeSnapshot(snapshot, format));
      onStatus(`${EXPORT_LABELS[format]} snapshot copied.`);
    } catch {
      onStatus("Copy failed. Chrome did not allow clipboard access.");
    }
  };
  return (
    <div class="panel-section-stack">
      <section class="panel-card export-card">
        <p class="eyebrow">Portable snapshot</p>
        <h2>Copy or download</h2>
        <p class="supporting-copy">
          Exports contain measurements and breakpoint context only—never the page URL,
          title, content, or history.
        </p>
        <fieldset class="format-grid">
          <legend>Export format</legend>
          {(Object.keys(EXPORT_LABELS) as ExportFormat[]).map((item) => (
            <label class={format === item ? "is-selected" : undefined} key={item}>
              <input
                type="radio"
                name="export-format"
                value={item}
                checked={format === item}
                onChange={() => setFormat(item)}
              />
              <strong>{EXPORT_LABELS[item]}</strong>
              <span>
                {item === "json"
                  ? "Full versioned structure"
                  : item === "css"
                    ? "Custom properties"
                    : item === "markdown"
                      ? "Documentation-ready"
                      : "Spreadsheet-ready"}
              </span>
            </label>
          ))}
        </fieldset>
        <label class="checkbox-row">
          <input
            type="checkbox"
            checked={preferences.defaultExportFormat === format}
            onChange={(event) => {
              if (event.currentTarget.checked)
                void onPreferencesChange({ ...preferences, defaultExportFormat: format });
            }}
          />
          <span>Use {EXPORT_LABELS[format]} for “Copy snapshot”</span>
        </label>
        <div class="button-row">
          <button
            class="button button--primary"
            type="button"
            disabled={!snapshot}
            onClick={() => void copy()}
          >
            <Icon name="copy" /> Copy {EXPORT_LABELS[format]}
          </button>
          <button
            class="button button--secondary"
            type="button"
            disabled={!snapshot}
            onClick={() => {
              if (!snapshot) return;
              try {
                downloadJson(snapshot);
                onStatus("JSON download created.");
              } catch {
                onStatus("JSON download failed.");
              }
            }}
          >
            <Icon name="download" /> Download JSON
          </button>
        </div>
      </section>
      {snapshot && (
        <section class="panel-card preview-card">
          <div class="section-heading">
            <h2>Snapshot details</h2>
            <span>v{snapshot.schemaVersion}</span>
          </div>
          <dl class="metric-list">
            <div class="metric-row">
              <dt>Captured</dt>
              <dd>{formatTimestamp(snapshot.capturedAt)}</dd>
            </div>
            <div class="metric-row">
              <dt>Profile</dt>
              <dd>{snapshot.breakpoint.profileName}</dd>
            </div>
            <div class="metric-row">
              <dt>Page metadata</dt>
              <dd>Excluded</dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
}

export function SidePanelView(props: SidePanelViewProps) {
  const [section, setSection] = useState<PanelSection>(props.defaultSection ?? "inspect");
  const { snapshot, baseline, inspectorState, errorCode } = props;
  const profile = findProfile(
    props.preferences.activeProfileId,
    props.preferences.customProfiles,
  );
  const error = ERROR_CONTENT[errorCode];

  return (
    <div class="app-shell panel-shell">
      <header class="app-header panel-header">
        <Brand compact />
        <ConnectionPill state={inspectorState} />
      </header>
      <nav class="panel-nav" aria-label="Inspector sections">
        {(["inspect", "breakpoints", "export"] as PanelSection[]).map((item) => (
          <button
            type="button"
            class={section === item ? "is-active" : undefined}
            aria-current={section === item ? "page" : undefined}
            onClick={() => setSection(item)}
            key={item}
          >
            {item === "inspect"
              ? "Inspect"
              : item === "breakpoints"
                ? "Breakpoints"
                : "Export"}
          </button>
        ))}
      </nav>
      <main class="app-scroll panel-main">
        {inspectorState === "connecting" && !snapshot && (
          <section class="state-view" role="status">
            <span class="loader" aria-hidden="true" />
            <h1>Connecting to this tab</h1>
            <p>Live measurements will appear here.</p>
          </section>
        )}
        {inspectorState === "error" && !snapshot && (
          <section class="state-view state-view--error" role="alert">
            <span class="state-symbol" aria-hidden="true">
              !
            </span>
            <h1>{error.title}</h1>
            <p>{error.message}</p>
            <button
              class="button button--primary"
              type="button"
              onClick={props.onReconnect}
            >
              {error.action}
            </button>
          </section>
        )}
        {snapshot && section === "inspect" && (
          <div class="panel-section-stack">
            {inspectorState === "error" && (
              <div class="reconnect-banner" role="alert">
                <div>
                  <strong>{error.title}</strong>
                  <span class="reconnect-copy">{error.message}</span>
                </div>
                <button
                  class="button button--secondary"
                  type="button"
                  onClick={props.onReconnect}
                >
                  {error.action}
                </button>
              </div>
            )}
            <PrimaryMetrics snapshot={snapshot} baseline={baseline} />
            <section class="baseline-card">
              <div>
                <Icon name="baseline" />
                <div>
                  <strong>
                    {baseline ? "Comparing with baseline" : "Capture a baseline"}
                  </strong>
                  <span class="baseline-copy">
                    {baseline
                      ? `Saved at ${new Date(baseline.capturedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "Keep one snapshot in memory and watch deltas live."}
                  </span>
                </div>
              </div>
              {baseline ? (
                <button
                  class="button button--quiet"
                  type="button"
                  onClick={props.onClearBaseline}
                >
                  Clear
                </button>
              ) : (
                <button
                  class="button button--secondary"
                  type="button"
                  onClick={props.onSetBaseline}
                >
                  Set baseline
                </button>
              )}
            </section>
            <section class="panel-card">
              <div class="section-heading">
                <div>
                  <p class="eyebrow">Current range</p>
                  <h2>{profile.name}</h2>
                </div>
                <span class="breakpoint-badge">{snapshot.breakpoint.label}</span>
              </div>
              <BreakpointRail
                profile={profile}
                activePointId={snapshot.breakpoint.pointId}
              />
            </section>
            <MetricDetails snapshot={snapshot} baseline={baseline} openSection="viewport" />
          </div>
        )}
        {section === "breakpoints" && (
          <BreakpointManager
            preferences={props.preferences}
            snapshot={snapshot}
            onPreferencesChange={props.onPreferencesChange}
          />
        )}
        {section === "export" && (
          <ExportPanel
            snapshot={snapshot}
            preferences={props.preferences}
            onPreferencesChange={props.onPreferencesChange}
            onStatus={props.onStatus}
          />
        )}
      </main>
      <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {props.status}
      </div>
    </div>
  );
}

function parseTabId(): number | null {
  const value = Number.parseInt(
    new URLSearchParams(window.location.search).get("tabId") ?? "",
    10,
  );
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function SidePanelApp() {
  const [preferences, setPreferences] = useState<PreferencesV2>(DEFAULT_PREFERENCES);
  const [snapshot, setSnapshot] = useState<MetricsSnapshotV2 | null>(null);
  const [baseline, setBaseline] = useState<MetricsSnapshotV2 | null>(null);
  const [inspectorState, setInspectorState] = useState<InspectorState>("connecting");
  const [errorCode, setErrorCode] = useState<StableErrorCode>("UNKNOWN");
  const [status, setStatus] = useState("");
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const pageMetricsRef = useRef<PageMetrics | null>(null);
  const preferencesRef = useRef(preferences);
  const intentionalPorts = useRef(new WeakSet<chrome.runtime.Port>());
  const tabId = parseTabId();

  const connect = useCallback(async () => {
    if (tabId === null) {
      setErrorCode("NO_ACTIVE_TAB");
      setInspectorState("error");
      return;
    }
    setInspectorState("connecting");
    if (portRef.current) {
      intentionalPorts.current.add(portRef.current);
      portRef.current.disconnect();
      portRef.current = null;
    }
    try {
      await injectBridge(tabId);
      const port = connectLiveBridge(tabId);
      portRef.current = port;
      port.onMessage.addListener((message: unknown) => {
        if (!isLiveBridgeMessage(message)) return;
        if (message.type === MESSAGE_TYPES.bridgeError) {
          setErrorCode(message.code);
          setInspectorState("error");
          return;
        }
        pageMetricsRef.current = message.metrics;
        void mergeLiveMetrics(tabId, message.metrics, preferencesRef.current)
          .then((next) => {
            setSnapshot(next);
            setInspectorState(document.hidden ? "paused" : "live");
          })
          .catch((error) => {
            setErrorCode(toStableError(error).code);
            setInspectorState("error");
          });
      });
      port.onDisconnect.addListener(() => {
        if (intentionalPorts.current.has(port)) return;
        if (portRef.current === port) portRef.current = null;
        setBaseline(null);
        setErrorCode("ACCESS_REVOKED");
        setInspectorState("error");
      });
      sendLiveControl(port, {
        type: document.hidden ? MESSAGE_TYPES.liveStop : MESSAGE_TYPES.liveStart,
      });
    } catch (error) {
      setErrorCode(toStableError(error).code);
      setInspectorState("error");
    }
  }, [tabId]);

  useEffect(() => {
    let cancelled = false;
    void initializeStorage()
      .then((stored) => {
        if (cancelled) return;
        preferencesRef.current = stored;
        setPreferences(stored);
        applyPreferencesToDocument(stored);
        void connect();
      })
      .catch((error) => {
        if (cancelled) return;
        setErrorCode(toStableError(error).code);
        setInspectorState("error");
      });

    const onVisibility = () => {
      const port = portRef.current;
      if (!port) return;
      try {
        sendLiveControl(port, {
          type: document.hidden ? MESSAGE_TYPES.liveStop : MESSAGE_TYPES.liveStart,
        });
        setInspectorState(document.hidden ? "paused" : "live");
      } catch {
        portRef.current = null;
        setBaseline(null);
        setErrorCode("ACCESS_REVOKED");
        setInspectorState("error");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onZoom = (info: chrome.tabs.OnZoomChangeInfo) => {
      if (info.tabId !== tabId || !pageMetricsRef.current || tabId === null) return;
      void mergeLiveMetrics(tabId, pageMetricsRef.current, preferencesRef.current).then(
        setSnapshot,
      );
    };
    const onUpdated = (updatedTabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "loading") setBaseline(null);
    };
    chrome.tabs.onZoomChange.addListener(onZoom);
    chrome.tabs.onUpdated.addListener(onUpdated);

    return () => {
      cancelled = true;
      if (portRef.current) {
        intentionalPorts.current.add(portRef.current);
        portRef.current.disconnect();
      }
      portRef.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
      chrome.tabs.onZoomChange.removeListener(onZoom);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [connect, tabId]);

  const updatePreferences = async (next: PreferencesV2) => {
    const saved = await savePreferences(next);
    preferencesRef.current = saved;
    setPreferences(saved);
    applyPreferencesToDocument(saved);
    if (pageMetricsRef.current && tabId !== null) {
      setSnapshot(await mergeLiveMetrics(tabId, pageMetricsRef.current, saved));
    }
  };

  return (
    <SidePanelView
      preferences={preferences}
      snapshot={snapshot}
      baseline={baseline}
      inspectorState={inspectorState}
      errorCode={errorCode}
      status={status}
      onReconnect={() => void connect()}
      onSetBaseline={() => {
        if (snapshot) {
          setBaseline(structuredClone(snapshot));
          setStatus("Baseline captured in memory.");
        }
      }}
      onClearBaseline={() => {
        setBaseline(null);
        setStatus("Baseline cleared.");
      }}
      onPreferencesChange={updatePreferences}
      onStatus={setStatus}
    />
  );
}
