import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { findProfile } from "../../src/shared/breakpoints";
import { DEFAULT_PREFERENCES, LIVE_PORT_NAME } from "../../src/shared/constants";
import { createSnapshot } from "../../src/shared/metrics";
import { isLiveBridgeMessage, MESSAGE_TYPES } from "../../src/shared/protocol";
import { applyPreferencesToDocument } from "../../src/shared/theme";
import type { MetricsSnapshotV2, PageMetrics, PreferencesV2 } from "../../src/shared/types";
import { type PanelSection, SidePanelView } from "../../src/sidepanel/SidePanelApp";

const PREVIEW_ID = "pixelparity-local-preview";
const TAB_ID = 42;
const WINDOW_ID = 1;
const SCRIPT_FILES = new Set(["bridge.js", "overlay.js", "capture-bridge.js"]);

function localEvent<Args extends unknown[]>() {
  const listeners = new Set<(...args: Args) => void>();
  return {
    addListener: (listener: (...args: Args) => void) => listeners.add(listener),
    removeListener: (listener: (...args: Args) => void) => listeners.delete(listener),
    hasListener: (listener: (...args: Args) => void) => listeners.has(listener),
    hasListeners: () => listeners.size > 0,
    dispatch: (...args: Args) => {
      for (const listener of [...listeners]) listener(...args);
    },
  };
}

function portPair(name: string, onClosed: () => void) {
  const clientMessage = localEvent<[unknown, chrome.runtime.Port]>();
  const pageMessage = localEvent<[unknown, chrome.runtime.Port]>();
  const clientDisconnect = localEvent<[chrome.runtime.Port]>();
  const pageDisconnect = localEvent<[chrome.runtime.Port]>();
  let closed = false;
  const disconnect = () => {
    if (closed) return;
    closed = true;
    onClosed();
    queueMicrotask(() => {
      clientDisconnect.dispatch(client);
      pageDisconnect.dispatch(page);
    });
  };
  const client = {
    name,
    sender: { id: PREVIEW_ID },
    onMessage: clientMessage,
    onDisconnect: clientDisconnect,
    disconnect,
    postMessage(message: unknown) {
      if (closed) throw new Error("Local fixture connection is closed.");
      const copy = structuredClone(message);
      queueMicrotask(() => {
        if (!closed) pageMessage.dispatch(copy, page);
      });
    },
  } as unknown as chrome.runtime.Port;
  const page = {
    name,
    sender: { id: PREVIEW_ID, tab: { id: TAB_ID }, frameId: 0 },
    onMessage: pageMessage,
    onDisconnect: pageDisconnect,
    disconnect,
    postMessage(message: unknown) {
      if (closed) throw new Error("Local fixture connection is closed.");
      const copy = structuredClone(message);
      queueMicrotask(() => {
        if (!closed) clientMessage.dispatch(copy, client);
      });
    },
  } as unknown as chrome.runtime.Port;
  return { client, page, disconnect };
}

function installPreviewApi(frame: HTMLIFrameElement) {
  const frameWindow = frame.contentWindow;
  const frameDocument = frame.contentDocument;
  if (!frameWindow || !frameDocument) throw new Error("Local fixture is unavailable.");
  const pageConnections = localEvent<[chrome.runtime.Port]>();
  const pageMessages =
    localEvent<[unknown, chrome.runtime.MessageSender, (response: unknown) => void]>();
  const scripts = new Map<string, Promise<void>>();
  const closePorts = new Set<() => void>();
  let disposed = false;

  const loadScript = (filename: string): Promise<void> => {
    if (!SCRIPT_FILES.has(filename))
      return Promise.reject(new Error("Unknown preview script."));
    const existing = scripts.get(filename);
    if (existing) return existing;
    const loading = new Promise<void>((resolve, reject) => {
      const script = frameDocument.createElement("script");
      script.src = `/${filename}`;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(
          new Error(
            `Could not load ${filename}. Rebuild the extension and restart this preview.`,
          ),
        );
      frameDocument.head.append(script);
    });
    scripts.set(filename, loading);
    return loading;
  };

  const connect = (name: string) => {
    if (disposed) throw new Error("The local fixture has closed.");
    const ports = portPair(name, () => closePorts.delete(ports.disconnect));
    closePorts.add(ports.disconnect);
    queueMicrotask(() => {
      if (!disposed) pageConnections.dispatch(ports.page);
    });
    return ports.client;
  };

  Object.assign(frameWindow, {
    chrome: {
      runtime: { id: PREVIEW_ID, onConnect: pageConnections, onMessage: pageMessages },
    },
  });

  const api = {
    runtime: {
      id: PREVIEW_ID,
      onConnect: localEvent<[chrome.runtime.Port]>(),
      onMessage: localEvent<[unknown]>(),
    },
    scripting: {
      async executeScript(injection: { target: { tabId: number }; files?: string[] }) {
        if (injection.target.tabId !== TAB_ID || !injection.files) {
          throw new Error("Only the local fixture can be inspected in this preview.");
        }
        for (const filename of injection.files) await loadScript(filename);
        return [{ frameId: 0, documentId: "local-fixture" }];
      },
    },
    tabs: {
      async query() {
        return [{ id: TAB_ID, windowId: WINDOW_ID, active: true, status: "complete" }];
      },
      async get(tabId: number) {
        if (tabId !== TAB_ID) throw new Error("Only the local fixture is available.");
        return {
          id: TAB_ID,
          windowId: WINDOW_ID,
          active: true,
          status: "complete",
          discarded: false,
        };
      },
      async getZoom() {
        return 1;
      },
      connect(tabId: number, options: { name: string }) {
        if (tabId !== TAB_ID) throw new Error("Only the local fixture is available.");
        return connect(options.name);
      },
      async sendMessage(tabId: number, message: unknown) {
        if (tabId !== TAB_ID) throw new Error("Only the local fixture is available.");
        return new Promise<unknown>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("The local fixture did not respond.")),
            2000,
          );
          pageMessages.dispatch(message, { id: PREVIEW_ID }, (response) => {
            clearTimeout(timeout);
            resolve(response);
          });
        });
      },
      async captureVisibleTab() {
        throw new Error(
          "Screenshot capture requires PixelParity installed in Chrome. This local interface preview cannot call Chrome’s capture API.",
        );
      },
      onActivated: localEvent<[chrome.tabs.OnActivatedInfo]>(),
      onUpdated: localEvent<[number, chrome.tabs.OnUpdatedInfo]>(),
      onRemoved: localEvent<[number]>(),
      onZoomChange: localEvent<[chrome.tabs.OnZoomChangeInfo]>(),
    },
    windows: {
      async get() {
        return { id: WINDOW_ID, focused: true };
      },
      onFocusChanged: localEvent<[number]>(),
    },
  };
  Object.assign(window, { chrome: api });

  return {
    loadScript,
    connect,
    close() {
      disposed = true;
      for (const close of [...closePorts]) close();
    },
  };
}

const query = new URLSearchParams(location.search);
const sections: PanelSection[] = ["inspect", "layout", "capture", "breakpoints", "export"];
const requestedSection = query.get("section");
const defaultSection =
  sections.find((section) => section === requestedSection) ?? "inspect";
const theme = query.get("theme") === "light" ? "light" : "dark";
const requestedPanel = Number(query.get("panel") ?? 420);
const initialPanelWidth = Number.isFinite(requestedPanel)
  ? Math.min(640, Math.max(280, requestedPanel))
  : 420;

function Workbench() {
  const [preferences, setPreferences] = useState<PreferencesV2>({
    ...structuredClone(DEFAULT_PREFERENCES),
    theme,
  });
  const [snapshot, setSnapshot] = useState<MetricsSnapshotV2 | null>(null);
  const [baseline, setBaseline] = useState<MetricsSnapshotV2 | null>(null);
  const [panelWidth, setPanelWidth] = useState(initialPanelWidth);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const metrics = useRef<PageMetrics | null>(null);
  const preferencesRef = useRef(preferences);
  const fixture = useRef<ReturnType<typeof installPreviewApi> | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    applyPreferencesToDocument(preferences);
    preferencesRef.current = preferences;
    if (metrics.current) {
      setSnapshot(
        createSnapshot(
          metrics.current,
          1,
          findProfile(preferences.activeProfileId, preferences.customProfiles),
        ),
      );
    }
  }, [preferences]);

  useEffect(
    () => () => {
      generation.current += 1;
      fixture.current?.close();
    },
    [],
  );

  const connectFixture = async (frame: HTMLIFrameElement) => {
    const currentGeneration = ++generation.current;
    fixture.current?.close();
    setSnapshot(null);
    setBaseline(null);
    metrics.current = null;
    setError("");
    try {
      const next = installPreviewApi(frame);
      fixture.current = next;
      await next.loadScript("bridge.js");
      if (currentGeneration !== generation.current) return;
      const port = next.connect(LIVE_PORT_NAME);
      port.onMessage.addListener((message: unknown) => {
        if (currentGeneration !== generation.current || !isLiveBridgeMessage(message))
          return;
        if (message.type === MESSAGE_TYPES.bridgeError) {
          setError("The local fixture is still loading. Reload the preview to reconnect.");
          return;
        }
        metrics.current = message.metrics;
        const selected = preferencesRef.current;
        setSnapshot(
          createSnapshot(
            message.metrics,
            1,
            findProfile(selected.activeProfileId, selected.customProfiles),
          ),
        );
      });
      port.postMessage({ type: MESSAGE_TYPES.liveStart });
    } catch (reason) {
      if (currentGeneration === generation.current)
        setError(
          reason instanceof Error ? reason.message : "The local fixture could not start.",
        );
    }
  };

  const updateWidth = (value: number) => {
    if (!Number.isFinite(value)) return;
    const width = Math.min(640, Math.max(280, value));
    setPanelWidth(width);
    const next = new URL(location.href);
    next.searchParams.set("panel", String(width));
    history.replaceState(null, "", next);
  };

  const updateTheme = (value: string) => {
    const nextTheme = value === "light" ? "light" : "dark";
    setPreferences((current) => ({ ...current, theme: nextTheme }));
    const next = new URL(location.href);
    next.searchParams.set("theme", nextTheme);
    history.replaceState(null, "", next);
  };

  return (
    <div class="preview-workbench">
      <header class="preview-toolbar">
        <div class="preview-title">
          <span class="preview-mark" aria-hidden="true">
            P
          </span>
          <strong>PixelParity</strong>
          <span class="preview-label">Local interface preview</span>
        </div>
        <div class="preview-controls">
          <label>
            <span>Panel width</span>
            <input
              type="number"
              min="280"
              max="640"
              step="20"
              value={panelWidth}
              onInput={(event) => updateWidth(event.currentTarget.valueAsNumber)}
            />
            <span>px</span>
          </label>
          <label>
            <span>Theme</span>
            <select
              value={preferences.theme}
              onChange={(event) => updateTheme(event.currentTarget.value)}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
        </div>
      </header>
      <div class="preview-stage" style={{ "--preview-panel": `${panelWidth}px` }}>
        <section class="preview-website" aria-label="Local layout demonstration">
          <iframe
            title="Forma Studio layout demonstration"
            src="/fixture.html"
            onLoad={(event) => void connectFixture(event.currentTarget)}
          />
        </section>
        <aside class="preview-inspector" aria-label="PixelParity shipping interface">
          <SidePanelView
            tabId={TAB_ID}
            preferences={preferences}
            snapshot={snapshot}
            baseline={baseline}
            inspectorState={error ? "error" : snapshot ? "live" : "connecting"}
            errorCode="BRIDGE_UNAVAILABLE"
            status={status}
            defaultSection={defaultSection}
            onReconnect={() => location.reload()}
            onSetBaseline={() => {
              if (snapshot) {
                setBaseline(structuredClone(snapshot));
                setStatus(
                  "Baseline captured from the local fixture. Change panel width to compare.",
                );
              }
            }}
            onClearBaseline={() => {
              setBaseline(null);
              setStatus("Baseline cleared.");
            }}
            onPreferencesChange={(next) => {
              setPreferences(next);
              return true;
            }}
            onStatus={setStatus}
          />
        </aside>
      </div>
      <footer class="preview-footer">
        <span>
          Local DOM measurements · Chrome APIs simulated; screenshots require installation.
        </span>
        <span class="preview-status" role="status">
          {error ||
            status ||
            `${snapshot?.viewport.layout.width ?? "—"} px fixture · 100% preview zoom`}
        </span>
      </footer>
    </div>
  );
}

const root = document.querySelector("#workbench");
if (!root) throw new Error("Preview root is missing.");
render(<Workbench />, root);
