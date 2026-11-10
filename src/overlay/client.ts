import {
  OVERLAY_PORT_NAME,
  isOverlayEvent,
  type OverlayCommand,
  type OverlayEvent,
} from "../shared/overlay";

export interface OverlayConnection {
  send(command: OverlayCommand): void;
  close(): void;
}

export async function connectOverlay(
  tabId: number,
  onEvent: (event: OverlayEvent) => void,
  onDisconnect: () => void,
): Promise<OverlayConnection> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["overlay.js"],
    world: "ISOLATED",
  });
  const port = chrome.tabs.connect(tabId, { name: OVERLAY_PORT_NAME });
  let closed = false;
  await new Promise<void>((resolve, reject) => {
    let ready = false;
    const timeout = setTimeout(() => {
      closed = true;
      port.disconnect();
      reject(new Error("The page did not connect to the layout tools."));
    }, 3_000);
    port.onMessage.addListener((message: unknown) => {
      if (closed || !isOverlayEvent(message)) return;
      if (!ready && message.type === "PIXELPARITY/OVERLAY_STATE") {
        ready = true;
        clearTimeout(timeout);
        resolve();
      }
      onEvent(message);
    });
    port.onDisconnect.addListener(() => {
      void chrome.runtime.lastError;
      if (closed) return;
      closed = true;
      clearTimeout(timeout);
      if (ready) onDisconnect();
      else reject(new Error("The page connection closed before layout tools were ready."));
    });
  });
  return {
    send(command) {
      if (closed)
        throw new Error("Layout tools disconnected. Reopen PixelParity on this page.");
      port.postMessage(command);
    },
    close() {
      if (closed) return;
      closed = true;
      port.disconnect();
    },
  };
}
