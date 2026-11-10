import { describe, expect, it, vi } from "vitest";
import { connectOverlay } from "../../src/overlay/client";
import { measureElement } from "../../src/overlay/measurement";
import {
  DEFAULT_OVERLAY_SETTINGS,
  columnGeometry,
  copyOverlaySettings,
  gridOffset,
  isElementMeasurement,
  isOverlayCommand,
  isOverlayEvent,
  isOverlaySettings,
  serializeElementMeasurement,
  type ElementMeasurement,
} from "../../src/shared/overlay";

const measurement: ElementMeasurement = {
  tag: "article",
  x: 120,
  y: 80.5,
  width: 320,
  height: 180,
  margin: [0, 16, 24, 16],
  padding: [24, 32, 24, 32],
  border: [1, 1, 1, 1],
  rowGap: "16px",
  columnGap: "8px",
  fontSize: 16,
  lineHeight: 24,
  display: "grid",
  position: "relative",
  boxSizing: "border-box",
  locked: true,
};

describe("layout grid geometry", () => {
  it("centers the maximum width without losing gutter space", () => {
    const geometry = columnGeometry(1440, DEFAULT_OVERLAY_SETTINGS);
    expect(geometry).toEqual({
      left: 120,
      width: 1200,
      columnWidth: 78,
      gutter: 24,
      columns: 12,
    });
    expect(
      geometry.columnWidth * geometry.columns + geometry.gutter * (geometry.columns - 1),
    ).toBe(geometry.width);
  });

  it("uses fluid margins when the viewport is smaller than the maximum", () => {
    expect(columnGeometry(900, { ...DEFAULT_OVERLAY_SETTINGS, columns: 4 })).toEqual({
      left: 24,
      width: 852,
      columnWidth: 195,
      gutter: 24,
      columns: 4,
    });
    expect(columnGeometry(1800, { ...DEFAULT_OVERLAY_SETTINGS, maxWidth: 0 }).width).toBe(
      1752,
    );
  });

  it("keeps small viewports and oversized gutters finite and nonnegative", () => {
    const small = columnGeometry(140, {
      columns: 12,
      gutter: 160,
      margin: 16,
      maxWidth: 0,
    });
    expect(small.columnWidth).toBeCloseTo(1);
    expect(small.gutter).toBeCloseTo(96 / 11);
    const empty = columnGeometry(100, {
      columns: 12,
      gutter: 24,
      margin: 400,
      maxWidth: 1200,
    });
    expect(empty.width).toBe(0);
    expect(empty.columnWidth).toBe(0);
    expect(empty.gutter).toBe(0);
    expect(columnGeometry(Number.NaN, DEFAULT_OVERLAY_SETTINGS).width).toBe(0);
    const invalid = columnGeometry(100, {
      columns: Infinity,
      gutter: NaN,
      margin: NaN,
      maxWidth: NaN,
    });
    expect(Object.values(invalid).every(Number.isFinite)).toBe(true);
  });

  it("has no trailing gutter on a single column", () => {
    expect(
      columnGeometry(600, { columns: 1, gutter: 100, margin: 20, maxWidth: 0 }),
    ).toEqual({
      left: 20,
      width: 560,
      columnWidth: 560,
      gutter: 0,
      columns: 1,
    });
  });

  it("anchors square and baseline grids to document coordinates through scrolling", () => {
    expect(gridOffset(17, 8)).toBe(-1);
    expect(gridOffset(320, 8)).toBe(-0);
    expect(gridOffset(-1, 8)).toBe(-7);
    expect(gridOffset(4, 0)).toBe(0);
    expect(gridOffset(Infinity, 8)).toBe(0);
  });
});

describe("overlay connection lifecycle", () => {
  function portFixture() {
    const messages: Array<(message: unknown) => void> = [];
    const disconnects: Array<() => void> = [];
    const postMessage = vi.fn();
    const disconnect = vi.fn();
    const port = {
      onMessage: {
        addListener: (listener: (message: unknown) => void) => messages.push(listener),
      },
      onDisconnect: { addListener: (listener: () => void) => disconnects.push(listener) },
      postMessage,
      disconnect,
    } as unknown as chrome.runtime.Port;
    return { port, messages, disconnects, postMessage, disconnect };
  }

  it("waits for the content bridge to acknowledge and rejects commands after disconnection", async () => {
    const fixture = portFixture();
    const connect = vi.spyOn(chrome.tabs, "connect").mockReturnValue(fixture.port);
    const onEvent = vi.fn();
    const onDisconnect = vi.fn();
    try {
      const pending = connectOverlay(42, onEvent, onDisconnect);
      await Promise.resolve();
      expect(connect).toHaveBeenCalledWith(42, { name: "PIXELPARITY/OVERLAY_V3" });
      fixture.messages[0]?.({ type: "UNKNOWN" });
      expect(onEvent).not.toHaveBeenCalled();
      fixture.messages[0]?.({
        type: "PIXELPARITY/OVERLAY_STATE",
        settings: DEFAULT_OVERLAY_SETTINGS,
      });
      const connection = await pending;
      connection.send({ type: "PIXELPARITY/OVERLAY_CLEAR" });
      expect(fixture.postMessage).toHaveBeenCalledWith({
        type: "PIXELPARITY/OVERLAY_CLEAR",
      });
      fixture.disconnects[0]?.();
      expect(onDisconnect).toHaveBeenCalledOnce();
      expect(() => connection.send({ type: "PIXELPARITY/OVERLAY_CLEAR" })).toThrow(
        "disconnected",
      );
    } finally {
      connect.mockRestore();
    }
  });

  it("fails the connection if navigation closes the port before its first state", async () => {
    const fixture = portFixture();
    const connect = vi.spyOn(chrome.tabs, "connect").mockReturnValue(fixture.port);
    try {
      const pending = connectOverlay(42, vi.fn(), vi.fn());
      const rejection = expect(pending).rejects.toThrow(
        "closed before layout tools were ready",
      );
      await Promise.resolve();
      fixture.disconnects[0]?.();
      await rejection;
    } finally {
      connect.mockRestore();
    }
  });
});

describe("page keyboard ownership", () => {
  it("lets screenshot selection consume Escape before the layout overlay", async () => {
    const messages: Array<(message: unknown) => void> = [];
    const disconnects: Array<() => void> = [];
    const port = {
      name: "PIXELPARITY/OVERLAY_V3",
      sender: { id: chrome.runtime.id },
      onMessage: {
        addListener: (listener: (message: unknown) => void) => messages.push(listener),
      },
      onDisconnect: { addListener: (listener: () => void) => disconnects.push(listener) },
      postMessage: vi.fn(),
      disconnect: vi.fn(),
    } as unknown as chrome.runtime.Port;
    const addListener = vi.spyOn(chrome.runtime.onConnect, "addListener");
    const sheetPrototype = CSSStyleSheet.prototype;
    const replaceSync = Object.getOwnPropertyDescriptor(sheetPrototype, "replaceSync");
    Object.defineProperty(sheetPrototype, "replaceSync", {
      configurable: true,
      value: () => undefined,
    });
    const captureHost = document.createElement("div");
    captureHost.setAttribute("data-pixelparity-capture", "selection");
    const selectionKey = vi.fn();
    captureHost.addEventListener("keydown", selectionKey);
    try {
      await import("../../src/overlay/index");
      addListener.mock.calls.at(-1)?.[0](port);
      messages[0]?.({
        type: "PIXELPARITY/OVERLAY_SET",
        settings: { ...DEFAULT_OVERLAY_SETTINGS, gridEnabled: true },
      });
      expect(document.querySelector("[data-pixelparity-overlay]")).not.toBeNull();
      document.body.append(captureHost);
      captureHost.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
      expect(selectionKey).toHaveBeenCalledOnce();
      expect(document.querySelector("[data-pixelparity-overlay]")).not.toBeNull();
      captureHost.remove();
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
      expect(document.querySelector("[data-pixelparity-overlay]")).toBeNull();
    } finally {
      disconnects[0]?.();
      captureHost.remove();
      addListener.mockRestore();
      if (replaceSync) Object.defineProperty(sheetPrototype, "replaceSync", replaceSync);
      else Reflect.deleteProperty(sheetPrototype, "replaceSync");
      Reflect.deleteProperty(globalThis, "__PIXELPARITY_OVERLAY_V3__");
    }
  });
});

describe("overlay message boundary", () => {
  it.each(["10%", "calc(10% + 4px)", "normal"])(
    "preserves the computed gap %s without inventing pixel units",
    (gap) => {
      const element = document.createElement("div");
      element.style.cssText = `display:grid;row-gap:${gap};column-gap:${gap};font-size:16px;position:static;box-sizing:border-box`;
      document.body.append(element);
      try {
        const observed = measureElement(element, false);
        expect(observed.rowGap).toBe(gap);
        expect(observed.columnGap).toBe(gap);
        expect(isElementMeasurement(observed)).toBe(true);
        expect(serializeElementMeasurement(observed)).toContain(
          `Gap (row / column): ${gap} / ${gap}`,
        );
      } finally {
        element.remove();
      }
    },
  );

  it("rejects unbounded or non-CSS gap data at the measurement boundary", () => {
    for (const rowGap of [
      16,
      "",
      "1px; color:red",
      "url(secret)",
      "calc(1px + var(--secret))",
      `calc(${"1px + ".repeat(40)}0px)`,
    ]) {
      expect(isElementMeasurement({ ...measurement, rowGap })).toBe(false);
    }
  });

  it("accepts known settings and rejects non-finite, unbounded, or CSS-injecting values", () => {
    expect(isOverlaySettings(DEFAULT_OVERLAY_SETTINGS)).toBe(true);
    for (const patch of [
      { columns: 0 },
      { columns: 1.5 },
      { columns: 25 },
      { spacing: 0 },
      { gutter: Infinity },
      { margin: -1 },
      { maxWidth: 5000 },
      { opacity: NaN },
      { color: "red; background:url(secret)" },
      { gridEnabled: 1 },
      { gridType: { toString: () => "columns" } },
    ])
      expect(isOverlaySettings({ ...DEFAULT_OVERLAY_SETTINGS, ...patch })).toBe(false);
  });

  it("copies only defined setting fields", () => {
    const copied = copyOverlaySettings({
      ...DEFAULT_OVERLAY_SETTINGS,
      pageText: "private",
    } as typeof DEFAULT_OVERLAY_SETTINGS);
    expect(copied).not.toHaveProperty("pageText");
    expect(copied).not.toBe(DEFAULT_OVERLAY_SETTINGS);
  });

  it("rejects unrelated commands and malformed measurements", () => {
    expect(isOverlayCommand({ type: "PIXELPARITY/OVERLAY_CLEAR" })).toBe(true);
    expect(
      isOverlayCommand({
        type: "PIXELPARITY/OVERLAY_SET",
        settings: DEFAULT_OVERLAY_SETTINGS,
      }),
    ).toBe(true);
    expect(isOverlayCommand({ type: "PIXELPARITY/OVERLAY_SET", settings: {} })).toBe(false);
    expect(isOverlayCommand({ type: "FETCH_URL", url: "private" })).toBe(false);
    expect(isElementMeasurement(measurement)).toBe(true);
    expect(isElementMeasurement({ ...measurement, width: NaN })).toBe(false);
    expect(isElementMeasurement({ ...measurement, margin: [1, 2] })).toBe(false);
    expect(isElementMeasurement({ ...measurement, tag: "<script>" })).toBe(false);
    expect(isOverlayEvent({ type: "PIXELPARITY/OVERLAY_MEASUREMENT", measurement })).toBe(
      true,
    );
    expect(
      isOverlayEvent({ type: "PIXELPARITY/OVERLAY_MEASUREMENT", measurement: null }),
    ).toBe(true);
  });

  it("exports a bounded layout report without unexpected page fields", () => {
    const report = serializeElementMeasurement({
      ...measurement,
      pageText: "secret",
      url: "private.example",
    } as ElementMeasurement);
    expect(report).toContain("Bounds: 320 × 180 CSS px");
    expect(report).toContain("Padding (top right bottom left): 24 32 24 32 px");
    expect(report).not.toContain("secret");
    expect(report).not.toContain("private.example");
  });
});
