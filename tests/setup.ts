import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/preact";
import { afterEach, vi } from "vitest";
import { DEMO_PAGE_METRICS } from "../store/source/demo-data";
import { MESSAGE_TYPES } from "../src/shared/protocol";

class TestMediaQueryList extends EventTarget implements MediaQueryList {
  readonly matches = false;
  readonly media: string;
  onchange: ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null = null;

  constructor(media: string) {
    super();
    this.media = media;
  }

  addListener(): void {}
  removeListener(): void {}
}

class TestResizeObserver implements ResizeObserver {
  disconnect(): void {}
  observe(): void {}
  unobserve(): void {}
}

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: (query: string) => new TestMediaQueryList(query),
});
Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  value: TestResizeObserver,
});
Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
});

const storageValues: Record<string, unknown> = {};
const storageArea = {
  get: vi.fn(async (keys: string | string[]) => {
    const requested = Array.isArray(keys) ? keys : [keys];
    return Object.fromEntries(requested.map((key) => [key, storageValues[key]]));
  }),
  set: vi.fn(async (items: Record<string, unknown>) => {
    Object.assign(storageValues, items);
  }),
  remove: vi.fn(async (keys: string | string[]) => {
    for (const key of Array.isArray(keys) ? keys : [keys]) delete storageValues[key];
  }),
  setAccessLevel: vi.fn(async () => undefined),
};
const event = { addListener: vi.fn(), removeListener: vi.fn() };

Object.defineProperty(globalThis, "chrome", {
  configurable: true,
  value: {
    runtime: { id: "test-extension", onMessage: event, onConnect: event },
    storage: { sync: storageArea, local: storageArea },
    scripting: { executeScript: vi.fn(async () => []) },
    tabs: {
      query: vi.fn(async () => [{ id: 42 }]),
      sendMessage: vi.fn(async () => ({
        type: MESSAGE_TYPES.snapshotResponse,
        ok: true,
        metrics: DEMO_PAGE_METRICS,
      })),
      getZoom: vi.fn(async () => 1.25),
      connect: vi.fn(),
      onZoomChange: event,
      onUpdated: event,
    },
    sidePanel: {
      setOptions: vi.fn(async () => undefined),
      open: vi.fn(async () => undefined),
    },
    commands: {
      getAll: vi.fn(async () => [
        { name: "_execute_action", shortcut: "Alt+Shift+V", description: "Open" },
      ]),
    },
  } as unknown as typeof chrome,
});

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-density");
  vi.clearAllMocks();
});
