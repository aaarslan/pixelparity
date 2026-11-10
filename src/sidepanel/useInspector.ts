import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import {
  connectLiveBridge,
  injectBridge,
  mergeLiveMetrics,
  sendLiveControl,
} from "../shared/chrome-runtime";
import { DEFAULT_PREFERENCES } from "../shared/constants";
import { toStableError } from "../shared/errors";
import { isLiveBridgeMessage, MESSAGE_TYPES } from "../shared/protocol";
import { initializeStorage, savePreferences } from "../shared/storage";
import { applyPreferencesToDocument } from "../shared/theme";
import type {
  MetricsSnapshotV2,
  PageMetrics,
  PreferencesV2,
  StableErrorCode,
} from "../shared/types";

export type InspectorState = "connecting" | "live" | "paused" | "error";

export function useInspector(tabId: number | null) {
  const [preferences, setPreferences] = useState<PreferencesV2>(DEFAULT_PREFERENCES);
  const [snapshot, setSnapshot] = useState<MetricsSnapshotV2 | null>(null);
  const [baseline, setBaseline] = useState<MetricsSnapshotV2 | null>(null);
  const [inspectorState, setInspectorState] = useState<InspectorState>("connecting");
  const [errorCode, setErrorCode] = useState<StableErrorCode>("UNKNOWN");
  const [status, setStatus] = useState("");
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const pageMetricsRef = useRef<PageMetrics | null>(null);
  const preferencesRef = useRef(preferences);
  const generation = useRef(0);
  const revision = useRef(0);
  const mounted = useRef(false);

  const disconnect = useCallback(() => {
    generation.current += 1;
    revision.current += 1;
    const port = portRef.current;
    portRef.current = null;
    pageMetricsRef.current = null;
    port?.disconnect();
  }, []);

  const invalidate = useCallback(
    (code: StableErrorCode) => {
      disconnect();
      if (!mounted.current) return;
      setSnapshot(null);
      setBaseline(null);
      setErrorCode(code);
      setInspectorState("error");
    },
    [disconnect],
  );

  const updateMetrics = useCallback(
    async (metrics: PageMetrics, currentGeneration: number) => {
      if (tabId === null || currentGeneration !== generation.current) return;
      const currentRevision = ++revision.current;
      try {
        const next = await mergeLiveMetrics(tabId, metrics, preferencesRef.current);
        if (
          !mounted.current ||
          currentGeneration !== generation.current ||
          currentRevision !== revision.current
        )
          return;
        setSnapshot(next);
        setInspectorState(document.hidden ? "paused" : "live");
      } catch (error) {
        if (
          currentGeneration === generation.current &&
          currentRevision === revision.current
        )
          invalidate(toStableError(error).code);
      }
    },
    [invalidate, tabId],
  );

  const connect = useCallback(async () => {
    disconnect();
    setSnapshot(null);
    setBaseline(null);
    if (tabId === null) {
      invalidate("NO_ACTIVE_TAB");
      return;
    }
    setInspectorState("connecting");
    const currentGeneration = generation.current;
    try {
      await injectBridge(tabId);
      if (!mounted.current || currentGeneration !== generation.current) return;
      const port = connectLiveBridge(tabId);
      portRef.current = port;
      port.onMessage.addListener((message: unknown) => {
        if (portRef.current !== port || !isLiveBridgeMessage(message)) return;
        if (message.type === MESSAGE_TYPES.bridgeError) {
          invalidate(message.code);
          return;
        }
        pageMetricsRef.current = message.metrics;
        void updateMetrics(message.metrics, currentGeneration);
      });
      port.onDisconnect.addListener(() => {
        if (portRef.current === port) invalidate("ACCESS_REVOKED");
      });
      sendLiveControl(port, {
        type: document.hidden ? MESSAGE_TYPES.liveStop : MESSAGE_TYPES.liveStart,
      });
    } catch (error) {
      if (currentGeneration === generation.current) invalidate(toStableError(error).code);
    }
  }, [disconnect, invalidate, tabId, updateMetrics]);

  useEffect(() => {
    mounted.current = true;
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
        if (!cancelled) invalidate(toStableError(error).code);
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
        invalidate("ACCESS_REVOKED");
      }
    };
    const onZoom = (info: chrome.tabs.OnZoomChangeInfo) => {
      if (info.tabId === tabId && pageMetricsRef.current && portRef.current) {
        void updateMetrics(pageMetricsRef.current, generation.current);
      }
    };
    const onUpdated = (id: number, change: chrome.tabs.OnUpdatedInfo) => {
      if (id === tabId && change.status === "loading") invalidate("ACCESS_REVOKED");
    };
    document.addEventListener("visibilitychange", onVisibility);
    chrome.tabs.onZoomChange.addListener(onZoom);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      cancelled = true;
      mounted.current = false;
      disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      chrome.tabs.onZoomChange.removeListener(onZoom);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [connect, disconnect, invalidate, tabId, updateMetrics]);

  const updatePreferences = async (next: PreferencesV2) => {
    try {
      const saved = await savePreferences(next);
      if (!mounted.current) return false;
      preferencesRef.current = saved;
      setPreferences(saved);
      applyPreferencesToDocument(saved);
      if (pageMetricsRef.current && portRef.current) {
        await updateMetrics(pageMetricsRef.current, generation.current);
      }
      return true;
    } catch {
      setStatus("Preferences could not be saved. Please try again.");
      return false;
    }
  };

  return {
    preferences,
    snapshot,
    baseline,
    inspectorState,
    errorCode,
    status,
    connect,
    updatePreferences,
    setStatus,
    captureBaseline: () => {
      if (!snapshot || inspectorState !== "live") return;
      setBaseline(structuredClone(snapshot));
      setStatus("Baseline captured in memory.");
    },
    clearBaseline: () => {
      setBaseline(null);
      setStatus("Baseline cleared.");
    },
  };
}
