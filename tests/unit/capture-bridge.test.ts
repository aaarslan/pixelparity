import { webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CAPTURE_PORT, type CaptureResponse } from "../../src/shared/capture";

type CaptureGlobal = typeof globalThis & { __PIXELPARITY_CAPTURE_V3__?: true };

function pagePort() {
  const messages = new Set<(value: unknown) => void>();
  const disconnects = new Set<() => void>();
  const postMessage = vi.fn<(response: CaptureResponse) => void>();
  const port = {
    name: CAPTURE_PORT,
    sender: { id: chrome.runtime.id },
    onMessage: {
      addListener: (listener: (value: unknown) => void) => messages.add(listener),
    },
    onDisconnect: {
      addListener: (listener: () => void) => disconnects.add(listener),
    },
    postMessage,
    disconnect: () => {
      for (const listener of disconnects) listener();
    },
  } as unknown as chrome.runtime.Port;
  return {
    port,
    async documentToken() {
      for (const listener of messages) listener({ id: 1, action: "state" });
      await Promise.resolve();
      const response = postMessage.mock.calls.at(-1)?.[0];
      expect(response?.ok).toBe(true);
      const token = response?.state?.documentToken;
      if (typeof token !== "string") throw new Error("Missing capture document token.");
      return token;
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  Reflect.deleteProperty(globalThis, "__PIXELPARITY_CAPTURE_V3__");
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "__PIXELPARITY_CAPTURE_V3__");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("capture bridge initialization", () => {
  it("initializes without secure-context randomUUID and keeps one token per document", async () => {
    const getRandomValues = vi.fn(webcrypto.getRandomValues.bind(webcrypto));
    vi.stubGlobal("crypto", { getRandomValues });
    const addListener = vi.spyOn(chrome.runtime.onConnect, "addListener");

    expect(crypto.randomUUID).toBeUndefined();
    await import("../../src/capture/bridge");
    const connect = addListener.mock.calls[0]?.[0];
    if (!connect) throw new Error("Capture bridge did not register its connection.");
    const first = pagePort();
    const second = pagePort();
    try {
      connect(first.port);
      const token = await first.documentToken();
      expect(token).toMatch(/^[0-9a-f]{32}$/);
      first.port.disconnect();

      vi.resetModules();
      await import("../../src/capture/bridge");
      expect(addListener).toHaveBeenCalledOnce();
      expect(getRandomValues).toHaveBeenCalledOnce();

      connect(second.port);
      expect(await second.documentToken()).toBe(token);
    } finally {
      first.port.disconnect();
      second.port.disconnect();
    }
  });

  it("allows reinjection after initialization fails before the listener is registered", async () => {
    vi.stubGlobal("crypto", {
      getRandomValues: webcrypto.getRandomValues.bind(webcrypto),
      randomUUID: webcrypto.randomUUID.bind(webcrypto),
    });
    const addListener = vi
      .spyOn(chrome.runtime.onConnect, "addListener")
      .mockImplementationOnce(() => {
        throw new Error("Connection registration failed.");
      })
      .mockImplementation(() => {});

    await expect(import("../../src/capture/bridge")).rejects.toThrow(
      "Connection registration failed.",
    );
    expect((globalThis as CaptureGlobal).__PIXELPARITY_CAPTURE_V3__).toBeUndefined();

    vi.resetModules();
    await import("../../src/capture/bridge");
    expect(addListener).toHaveBeenCalledTimes(2);
    expect((globalThis as CaptureGlobal).__PIXELPARITY_CAPTURE_V3__).toBe(true);
  });
});
