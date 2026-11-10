import { act, renderHook, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MESSAGE_TYPES } from "../../src/shared/protocol";
import { useInspector } from "../../src/sidepanel/useInspector";
import { DEMO_PAGE_METRICS } from "../fixtures/metrics";

function mockPort() {
  const listeners = new Set<(message: unknown) => void>();
  const disconnects = new Set<() => void>();
  const port = {
    name: "test",
    postMessage: vi.fn(),
    disconnect: vi.fn(() => {
      for (const listener of disconnects) listener();
    }),
    onMessage: {
      addListener: (listener: (message: unknown) => void) => listeners.add(listener),
    },
    onDisconnect: { addListener: (listener: () => void) => disconnects.add(listener) },
  } as unknown as chrome.runtime.Port;
  return {
    port,
    send: (metrics = DEMO_PAGE_METRICS) => {
      for (const listener of listeners)
        listener({ type: MESSAGE_TYPES.metricsUpdate, metrics });
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("live inspector lifecycle", () => {
  it("cannot resurrect a snapshot when an old measurement resolves after disconnect", async () => {
    const source = mockPort();
    vi.mocked(chrome.tabs.connect).mockReturnValue(source.port);
    let resolveZoom: (value: number) => void = () => {};
    vi.spyOn(chrome.tabs, "getZoom").mockImplementation(
      () =>
        new Promise<number>((resolve) => {
          resolveZoom = resolve;
        }),
    );
    const { result } = renderHook(() => useInspector(42));
    await waitFor(() => expect(chrome.tabs.connect).toHaveBeenCalled());
    act(() => source.send());
    act(() => source.port.disconnect());
    await act(async () => {
      resolveZoom(1);
      await Promise.resolve();
    });
    expect(result.current.inspectorState).toBe("error");
    expect(result.current.snapshot).toBeNull();
    expect(result.current.baseline).toBeNull();
  });

  it("ignores a late failed zoom read after a newer measurement succeeds", async () => {
    const source = mockPort();
    vi.mocked(chrome.tabs.connect).mockReturnValue(source.port);
    let rejectOld: (reason: Error) => void = () => {};
    vi.spyOn(chrome.tabs, "getZoom")
      .mockImplementationOnce(
        () =>
          new Promise<number>((_, reject) => {
            rejectOld = reject;
          }),
      )
      .mockImplementation(() => Promise.resolve(1));
    const { result } = renderHook(() => useInspector(42));
    await waitFor(() => expect(chrome.tabs.connect).toHaveBeenCalled());
    act(() => {
      source.send();
      source.send();
    });
    await waitFor(() => expect(result.current.snapshot).not.toBeNull());
    await act(async () => {
      rejectOld(new Error("Old request failed"));
      await Promise.resolve();
    });
    expect(result.current.snapshot).not.toBeNull();
    expect(result.current.inspectorState).not.toBe("error");
  });

  it("does not establish a port if unmounted during injection", async () => {
    let resolveInjection: (value: chrome.scripting.InjectionResult[]) => void = () => {};
    vi.spyOn(chrome.scripting, "executeScript").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveInjection = resolve;
        }),
    );
    const { unmount } = renderHook(() => useInspector(42));
    await waitFor(() => expect(chrome.scripting.executeScript).toHaveBeenCalled());
    unmount();
    await act(async () => {
      resolveInjection([]);
      await Promise.resolve();
    });
    expect(chrome.tabs.connect).not.toHaveBeenCalled();
  });
});
