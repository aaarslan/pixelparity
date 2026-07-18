import { LIVE_PORT_NAME, LIVE_UPDATE_INTERVAL_MS } from "../shared/constants";
import { capturePageMetrics } from "../shared/metrics";
import {
  MESSAGE_TYPES,
  isLiveControlMessage,
  isSnapshotRequest,
  type BridgeResponse,
  type LiveBridgeMessage,
} from "../shared/protocol";

type BridgeGlobal = typeof globalThis & {
  __PIXELPARITY_BRIDGE_V2__?: true;
};

class LiveObserver {
  private active = false;
  private lastEmission = 0;
  private timeoutId: number | null = null;
  private frameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private readonly mediaQueries = [
    "(prefers-color-scheme: dark)",
    "(prefers-reduced-motion: reduce)",
    "(forced-colors: active)",
    "(pointer: fine)",
    "(pointer: coarse)",
    "(hover: hover)",
    "(color-gamut: srgb)",
    "(color-gamut: p3)",
    "(color-gamut: rec2020)",
  ].map((query) => window.matchMedia(query));

  constructor(private readonly port: chrome.runtime.Port) {}

  start(): void {
    if (this.active) return;
    this.active = true;
    window.addEventListener("resize", this.schedule, { passive: true });
    window.addEventListener("orientationchange", this.schedule, { passive: true });
    window.visualViewport?.addEventListener("resize", this.schedule, { passive: true });
    window.visualViewport?.addEventListener("scroll", this.schedule, { passive: true });
    for (const query of this.mediaQueries) query.addEventListener("change", this.schedule);

    this.resizeObserver = new ResizeObserver(this.schedule);
    this.resizeObserver.observe(document.documentElement);
    if (document.body) this.resizeObserver.observe(document.body);
    this.emit();
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    window.removeEventListener("resize", this.schedule);
    window.removeEventListener("orientationchange", this.schedule);
    window.visualViewport?.removeEventListener("resize", this.schedule);
    window.visualViewport?.removeEventListener("scroll", this.schedule);
    for (const query of this.mediaQueries)
      query.removeEventListener("change", this.schedule);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.timeoutId !== null) window.clearTimeout(this.timeoutId);
    if (this.frameId !== null) window.cancelAnimationFrame(this.frameId);
    this.timeoutId = null;
    this.frameId = null;
  }

  private readonly schedule = (): void => {
    if (!this.active || this.timeoutId !== null || this.frameId !== null) return;
    const elapsed = performance.now() - this.lastEmission;
    const wait = Math.max(0, LIVE_UPDATE_INTERVAL_MS - elapsed);
    this.timeoutId = window.setTimeout(() => {
      this.timeoutId = null;
      this.frameId = window.requestAnimationFrame(() => {
        this.frameId = null;
        this.emit();
      });
    }, wait);
  };

  private emit(): void {
    if (!this.active) return;
    const metrics = capturePageMetrics();
    if (!metrics) {
      const error: LiveBridgeMessage = {
        type: MESSAGE_TYPES.bridgeError,
        ok: false,
        code: "DOCUMENT_NOT_READY",
      };
      this.port.postMessage(error);
      return;
    }
    this.lastEmission = performance.now();
    const update: LiveBridgeMessage = { type: MESSAGE_TYPES.metricsUpdate, metrics };
    this.port.postMessage(update);
  }
}

function installBridge(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || !isSnapshotRequest(message)) return false;
    const metrics = capturePageMetrics();
    const response: BridgeResponse = metrics
      ? { type: MESSAGE_TYPES.snapshotResponse, ok: true, metrics }
      : {
          type: MESSAGE_TYPES.bridgeError,
          ok: false,
          code: "DOCUMENT_NOT_READY",
        };
    sendResponse(response);
    return false;
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== LIVE_PORT_NAME || port.sender?.id !== chrome.runtime.id) return;
    const observer = new LiveObserver(port);
    port.onMessage.addListener((message: unknown) => {
      if (!isLiveControlMessage(message)) return;
      if (message.type === MESSAGE_TYPES.liveStart) observer.start();
      else observer.stop();
    });
    port.onDisconnect.addListener(() => observer.stop());
  });
}

const bridgeGlobal = globalThis as BridgeGlobal;
if (!bridgeGlobal.__PIXELPARITY_BRIDGE_V2__) {
  bridgeGlobal.__PIXELPARITY_BRIDGE_V2__ = true;
  installBridge();
}
