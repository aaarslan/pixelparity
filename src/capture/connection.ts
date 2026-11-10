import {
  type CapturePageState,
  type CaptureRequest,
  type CaptureResponse,
  isCapturePageState,
} from "../shared/capture";
import { throwIfAborted } from "./async";

type RequestBody<T = CaptureRequest> = T extends CaptureRequest ? Omit<T, "id"> : never;

interface PendingRequest {
  resolve: (response: CaptureResponse) => void;
  reject: (error: Error) => void;
  dispose: () => void;
}

export class CaptureConnection {
  private nextId = 0;
  private readonly pending = new Map<number, PendingRequest>();
  private closed = false;
  private readonly heartbeat: ReturnType<typeof setInterval>;

  constructor(private readonly port: chrome.runtime.Port) {
    port.onMessage.addListener(this.receive);
    port.onDisconnect.addListener(this.disconnect);
    this.heartbeat = setInterval(() => {
      if (this.closed) return;
      try {
        port.postMessage({ id: ++this.nextId, action: "ping" });
      } catch {
        this.disconnect();
      }
    }, 10_000);
  }

  request(body: RequestBody, signal?: AbortSignal): Promise<CaptureResponse> {
    if (signal) throwIfAborted(signal);
    if (this.closed)
      return Promise.reject(
        new Error("The page disconnected. Reconnect and retry capture."),
      );
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const remove = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
        this.pending.delete(id);
      };
      const abort = () => {
        remove();
        reject(
          signal?.reason instanceof Error
            ? signal.reason
            : new DOMException("Capture cancelled.", "AbortError"),
        );
      };
      const timer = setTimeout(
        () => {
          remove();
          reject(
            new Error(
              body.action === "select"
                ? "Selection timed out. Choose Select region to try again."
                : "The page did not respond. Reconnect and retry capture.",
            ),
          );
        },
        body.action === "select" ? 180_000 : 5_000,
      );
      this.pending.set(id, { resolve, reject, dispose: remove });
      signal?.addEventListener("abort", abort, { once: true });
      try {
        this.port.postMessage({ ...body, id });
      } catch {
        remove();
        reject(new Error("The page disconnected. Reconnect and retry capture."));
      }
    });
  }

  async state(signal: AbortSignal): Promise<CapturePageState> {
    const response = await this.request({ action: "state" }, signal);
    if (!isCapturePageState(response.state))
      throw new Error("The page returned invalid capture dimensions.");
    return response.state;
  }

  private readonly receive = (value: unknown): void => {
    if (
      !value ||
      typeof value !== "object" ||
      !("id" in value) ||
      typeof value.id !== "number" ||
      !("ok" in value) ||
      typeof value.ok !== "boolean"
    )
      return;
    const pending = this.pending.get(value.id);
    if (!pending) return;
    pending.dispose();
    if (!value.ok) {
      const message =
        "error" in value && typeof value.error === "string"
          ? value.error
          : "Capture could not read this page.";
      pending.reject(
        message === "Capture cancelled."
          ? new DOMException(message, "AbortError")
          : new Error(message),
      );
      return;
    }
    pending.resolve(value as CaptureResponse);
  };

  private readonly disconnect = (): void => {
    if (this.closed) return;
    this.closed = true;
    void chrome.runtime.lastError;
    clearInterval(this.heartbeat);
    for (const pending of this.pending.values()) {
      pending.dispose();
      pending.reject(
        new Error(
          "Capture stopped because the tab, page, or viewport changed. Reconnect and retry.",
        ),
      );
    }
    this.pending.clear();
  };

  close(): void {
    this.disconnect();
    this.port.onMessage.removeListener(this.receive);
    this.port.onDisconnect.removeListener(this.disconnect);
    try {
      this.port.disconnect();
    } catch {
      return;
    }
  }
}
