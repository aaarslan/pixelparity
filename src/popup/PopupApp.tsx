import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { Brand, Icon } from "../components/Brand";
import { BreakpointRail, MetricDetails, PrimaryMetrics } from "../components/Metrics";
import { findProfile, getAllProfiles } from "../shared/breakpoints";
import {
  getActiveTabId,
  getAssignedShortcut,
  openSidePanel,
  prepareSidePanel,
  requestSnapshot,
} from "../shared/chrome-runtime";
import { DEFAULT_PREFERENCES } from "../shared/constants";
import { ERROR_CONTENT, toStableError } from "../shared/errors";
import { EXPORT_LABELS, serializeSnapshot } from "../shared/exports";
import { initializeStorage, savePreferences } from "../shared/storage";
import { applyPreferencesToDocument } from "../shared/theme";
import type {
  DensityPreference,
  ExportFormat,
  MetricsSnapshotV2,
  PreferencesV2,
  StableErrorCode,
  ThemePreference,
} from "../shared/types";

type View = "metrics" | "settings";
type LoadState = "loading" | "ready" | "error";

export function PopupApp() {
  const [preferences, setPreferences] = useState<PreferencesV2>(DEFAULT_PREFERENCES);
  const [snapshot, setSnapshot] = useState<MetricsSnapshotV2 | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorCode, setErrorCode] = useState<StableErrorCode>("UNKNOWN");
  const [view, setView] = useState<View>("metrics");
  const [status, setStatus] = useState("");
  const [shortcut, setShortcut] = useState<string | null>(null);
  const [tabId, setTabId] = useState<number | null>(null);
  const [panelReady, setPanelReady] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);

  const closeSettings = useCallback(() => {
    setView("metrics");
    requestAnimationFrame(() => settingsButtonRef.current?.focus());
  }, []);

  const inspect = useCallback(async (prefs: PreferencesV2) => {
    setLoadState("loading");
    try {
      const activeTabId = await getActiveTabId();
      setTabId(activeTabId);
      const panelPreparation = prepareSidePanel(activeTabId)
        .then(() => setPanelReady(true))
        .catch(() => setPanelReady(false));
      const nextSnapshot = await requestSnapshot(activeTabId, prefs);
      setSnapshot(nextSnapshot);
      setLoadState("ready");
      await panelPreparation;
    } catch (error) {
      const stable = toStableError(error);
      setErrorCode(stable.code);
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [storedPreferences, assignedShortcut] = await Promise.all([
          initializeStorage(),
          getAssignedShortcut().catch(() => null),
        ]);
        if (cancelled) return;
        setPreferences(storedPreferences);
        setShortcut(assignedShortcut);
        applyPreferencesToDocument(storedPreferences);
        await inspect(storedPreferences);
      } catch (error) {
        if (cancelled) return;
        const stable = toStableError(error);
        setErrorCode(stable.code);
        setLoadState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inspect]);

  useLayoutEffect(() => {
    if (view !== "settings") return;
    backButtonRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeSettings();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [closeSettings, view]);

  const updatePreferences = async (patch: Partial<PreferencesV2>) => {
    const next = await savePreferences({ ...preferences, ...patch });
    setPreferences(next);
    applyPreferencesToDocument(next);
    if (snapshot) {
      const profile = findProfile(next.activeProfileId, next.customProfiles);
      setSnapshot({
        ...snapshot,
        breakpoint: {
          ...snapshot.breakpoint,
          profileId: profile.id,
          profileName: profile.name,
        },
      });
      await inspect(next);
    }
  };

  const copySnapshot = async () => {
    if (!snapshot) return;
    try {
      await navigator.clipboard.writeText(
        serializeSnapshot(snapshot, preferences.defaultExportFormat),
      );
      setStatus(`${EXPORT_LABELS[preferences.defaultExportFormat]} snapshot copied.`);
    } catch {
      setStatus("Copy failed. Try again from the popup.");
    }
  };

  const showPanel = async () => {
    if (tabId === null) return;
    try {
      if (!panelReady) await prepareSidePanel(tabId);
      await openSidePanel(tabId);
      window.close();
    } catch {
      setStatus("Live inspector could not open. Try reopening PixelParity.");
    }
  };

  const profile = findProfile(preferences.activeProfileId, preferences.customProfiles);
  const error = ERROR_CONTENT[errorCode];

  return (
    <div class="app-shell popup-shell" aria-busy={loadState === "loading"}>
      <header class="app-header">
        {view === "settings" ? (
          <button
            ref={backButtonRef}
            class="icon-button"
            type="button"
            onClick={closeSettings}
            aria-label="Back to metrics"
          >
            <Icon name="back" />
          </button>
        ) : (
          <Brand />
        )}
        {view === "settings" ? (
          <h1 class="view-title">Settings</h1>
        ) : (
          <div class="header-actions">
            <button
              class="icon-button"
              type="button"
              onClick={() => void inspect(preferences)}
              aria-label="Refresh metrics"
            >
              <Icon name="refresh" />
            </button>
            <button
              ref={settingsButtonRef}
              class="icon-button"
              type="button"
              onClick={() => setView("settings")}
              aria-label="Open settings"
            >
              <Icon name="settings" />
            </button>
          </div>
        )}
      </header>

      {view === "settings" ? (
        <main class="app-scroll settings-view">
          <p class="eyebrow">Extension preferences</p>
          <h2>Make the inspector yours</h2>
          <p class="supporting-copy">
            Only these preferences are saved. Chrome may sync them when browser sync is
            enabled.
          </p>
          <div class="settings-form">
            <label>
              <span>Theme</span>
              <select
                value={preferences.theme}
                onChange={(event) =>
                  void updatePreferences({
                    theme: event.currentTarget.value as ThemePreference,
                  })
                }
              >
                <option value="system">Follow system</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label>
              <span>Density</span>
              <select
                value={preferences.density}
                onChange={(event) =>
                  void updatePreferences({
                    density: event.currentTarget.value as DensityPreference,
                  })
                }
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
            <label>
              <span>Breakpoint profile</span>
              <select
                value={preferences.activeProfileId}
                onChange={(event) =>
                  void updatePreferences({ activeProfileId: event.currentTarget.value })
                }
              >
                {getAllProfiles(preferences.customProfiles).map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Copy snapshot format</span>
              <select
                value={preferences.defaultExportFormat}
                onChange={(event) =>
                  void updatePreferences({
                    defaultExportFormat: event.currentTarget.value as ExportFormat,
                  })
                }
              >
                {(Object.keys(EXPORT_LABELS) as ExportFormat[]).map((format) => (
                  <option value={format} key={format}>
                    {EXPORT_LABELS[format]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </main>
      ) : (
        <main class="app-scroll">
          {loadState === "loading" && (
            <section class="state-view" role="status">
              <span class="loader" aria-hidden="true" />
              <h1>Reading this display</h1>
              <p>Measurements stay in this popup.</p>
            </section>
          )}
          {loadState === "error" && (
            <section class="state-view state-view--error" role="alert">
              <span class="state-symbol" aria-hidden="true">
                !
              </span>
              <h1>{error.title}</h1>
              <p>{error.message}</p>
              {errorCode !== "RESTRICTED_PAGE" && (
                <button
                  class="button button--primary"
                  type="button"
                  onClick={() => void inspect(preferences)}
                >
                  {error.action}
                </button>
              )}
            </section>
          )}
          {loadState === "ready" && snapshot && (
            <>
              <h1 class="sr-only">Display metrics</h1>
              <PrimaryMetrics snapshot={snapshot} />
              <section class="section-block">
                <div class="section-heading">
                  <div>
                    <p class="eyebrow">Responsive range</p>
                    <h2>{profile.name}</h2>
                  </div>
                  <span class="live-pill">On demand</span>
                </div>
                <BreakpointRail
                  profile={profile}
                  activePointId={snapshot.breakpoint.pointId}
                />
              </section>
              <MetricDetails snapshot={snapshot} />
            </>
          )}
        </main>
      )}

      {view === "metrics" && loadState === "ready" && snapshot && (
        <footer class="action-dock">
          <div class="button-row">
            <button
              class="button button--secondary"
              type="button"
              onClick={() => void copySnapshot()}
            >
              <Icon name="copy" /> Copy snapshot
            </button>
            <button
              class="button button--primary"
              type="button"
              disabled={!panelReady}
              onClick={() => void showPanel()}
            >
              <Icon name="panel" /> Open live inspector
            </button>
          </div>
          <p class="shortcut-note">
            {shortcut ? `Toolbar shortcut: ${shortcut}` : "No toolbar shortcut assigned"}
          </p>
        </footer>
      )}
      <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {status}
      </div>
    </div>
  );
}
