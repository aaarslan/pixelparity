import {
  CAPTURE_PORT,
  type CaptureRequest,
  type CaptureResponse,
  isCaptureRequest,
} from "../shared/capture";
import { CapturePage } from "./page";
import { selectCaptureRegion } from "./selection";

type CaptureGlobal = typeof globalThis & { __PIXELPARITY_CAPTURE_V3__?: true };

function installCaptureBridge(): void {
  const documentToken = Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  let activePort: chrome.runtime.Port | null = null;
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== CAPTURE_PORT || port.sender?.id !== chrome.runtime.id) return;
    if (activePort) {
      port.disconnect();
      return;
    }
    activePort = port;
    const controller = new AbortController();
    const page = new CapturePage(documentToken);
    let disconnected = false;
    let handling = false;
    let lastMessage = Date.now();
    const cleanup = () => {
      if (disconnected) return;
      disconnected = true;
      clearInterval(watchdog);
      controller.abort();
      page.restore();
      if (activePort === port) activePort = null;
    };
    const disconnect = () => {
      cleanup();
      try {
        port.disconnect();
      } catch {
        return;
      }
    };
    const watchdog = setInterval(() => {
      if (Date.now() - lastMessage > 30_000) disconnect();
    }, 5_000);
    window.addEventListener("pagehide", disconnect, { signal: controller.signal });
    window.addEventListener("resize", disconnect, { signal: controller.signal });
    window.addEventListener("orientationchange", disconnect, { signal: controller.signal });
    window.visualViewport?.addEventListener("resize", disconnect, {
      signal: controller.signal,
    });
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) disconnect();
      },
      { signal: controller.signal },
    );
    const reply = (response: CaptureResponse) => {
      if (disconnected) return;
      try {
        port.postMessage(response);
      } catch {
        disconnect();
      }
    };
    const handle = async (request: CaptureRequest): Promise<CaptureResponse> => {
      switch (request.action) {
        case "state":
          return { id: request.id, ok: true, state: page.read() };
        case "prepare":
          return { id: request.id, ok: true, state: await page.prepare(request.options) };
        case "scroll":
          return {
            id: request.id,
            ok: true,
            state: await page.scroll(request.x, request.y),
          };
        case "select":
          return {
            id: request.id,
            ok: true,
            region: await selectCaptureRegion(controller.signal),
            state: page.read(),
          };
        case "finish":
          page.restore();
          return { id: request.id, ok: true };
        case "ping":
          return { id: request.id, ok: true };
      }
    };
    port.onMessage.addListener((value: unknown) => {
      if (!isCaptureRequest(value) || disconnected) return;
      lastMessage = Date.now();
      if (value.action === "ping") {
        reply({ id: value.id, ok: true });
        return;
      }
      if (handling) {
        reply({ id: value.id, ok: false, error: "A page operation is already running." });
        return;
      }
      handling = true;
      void handle(value)
        .then(reply)
        .catch((error: unknown) => {
          reply({
            id: value.id,
            ok: false,
            error:
              error instanceof Error ? error.message : "Capture could not read this page.",
          });
        })
        .finally(() => {
          handling = false;
        });
    });
    port.onDisconnect.addListener(cleanup);
  });
}

const captureGlobal = globalThis as CaptureGlobal;
if (!captureGlobal.__PIXELPARITY_CAPTURE_V3__) {
  installCaptureBridge();
  captureGlobal.__PIXELPARITY_CAPTURE_V3__ = true;
}
