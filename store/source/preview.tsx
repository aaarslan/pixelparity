import { render } from "preact";
import { PopupApp } from "../../src/popup/PopupApp";
import { SidePanelView, type PanelSection } from "../../src/sidepanel/SidePanelApp";
import { MESSAGE_TYPES } from "../../src/shared/protocol";
import {
  DEMO_BASELINE,
  DEMO_PAGE_METRICS,
  DEMO_PREFERENCES,
  DEMO_SNAPSHOT,
} from "./demo-data";

const event = { addListener: () => undefined, removeListener: () => undefined };
const storage = {
  get: async () => ({ pixelparity_preferences_v2: DEMO_PREFERENCES }),
  set: async () => undefined,
  remove: async () => undefined,
  setAccessLevel: async () => undefined,
};

Object.assign(chrome as unknown as Record<string, unknown>, {
  runtime: { id: "store-preview", onMessage: event, onConnect: event },
  storage: { sync: storage, local: storage },
  scripting: { executeScript: async () => [] },
  tabs: {
    query: async () => [{ id: 42 }],
    sendMessage: async () => ({
      type: MESSAGE_TYPES.snapshotResponse,
      ok: true,
      metrics: DEMO_PAGE_METRICS,
    }),
    getZoom: async () => 1.25,
    onZoomChange: event,
    onUpdated: event,
  },
  sidePanel: { setOptions: async () => undefined, open: async () => undefined },
  commands: {
    getAll: async () => [
      { name: "_execute_action", shortcut: "Alt+Shift+V", description: "Open" },
    ],
  },
});

const scenarios = {
  popup: {
    kicker: "Fast on-demand snapshot",
    title: "Know the viewport in one click.",
    description:
      "Viewport, Chrome zoom, pixel ratio, and responsive range—without leaving the page.",
  },
  live: {
    kicker: "Tab-scoped live inspector",
    title: "Watch responsive changes as they happen.",
    description:
      "A focused side panel follows resize, orientation, zoom, and document changes at a glance.",
  },
  details: {
    kicker: "Clear display terminology",
    title: "Separate zoom, DPR, and visual scale.",
    description:
      "See the layout viewport, visual viewport, browser zoom, and rendered-pixel estimate as distinct values.",
  },
  breakpoints: {
    kicker: "Your responsive system",
    title: "Use breakpoints that match your product.",
    description:
      "Start with built-in ranges or create validated custom profiles that can follow you through Chrome Sync.",
  },
  export: {
    kicker: "Private, portable output",
    title: "Compare and share without page data.",
    description:
      "Copy JSON, CSS variables, Markdown, or TSV. URLs, titles, content, and history are always excluded.",
  },
} as const;

type Scenario = keyof typeof scenarios;
const requested = new URLSearchParams(window.location.search).get("scenario");
const scenario: Scenario =
  requested && requested in scenarios ? (requested as Scenario) : "popup";
const copy = scenarios[scenario];

function PreviewPanel({ section }: { section: PanelSection }) {
  return (
    <SidePanelView
      preferences={DEMO_PREFERENCES}
      snapshot={DEMO_SNAPSHOT}
      baseline={section === "inspect" ? DEMO_BASELINE : null}
      inspectorState="live"
      errorCode="UNKNOWN"
      status=""
      defaultSection={section}
      onReconnect={() => undefined}
      onSetBaseline={() => undefined}
      onClearBaseline={() => undefined}
      onPreferencesChange={() => undefined}
      onStatus={() => undefined}
    />
  );
}

function Preview() {
  const isPopup = scenario === "popup";
  const section: PanelSection =
    scenario === "breakpoints"
      ? "breakpoints"
      : scenario === "export"
        ? "export"
        : "inspect";
  return (
    <main class="preview-canvas">
      <section class="preview-copy">
        <p class="preview-kicker">{copy.kicker}</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </section>
      <section
        class={`preview-device preview-device--${isPopup ? "popup" : "panel"}`}
        aria-label="PixelParity interface preview"
      >
        {isPopup ? <PopupApp /> : <PreviewPanel section={section} />}
      </section>
    </main>
  );
}

document.body.classList.add(`scenario-${scenario}`);
const root = document.getElementById("app");
if (root) render(<Preview />, root);

if (scenario === "breakpoints") {
  queueMicrotask(() => {
    const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
      (item) => item.textContent?.includes("New profile"),
    );
    button?.click();
  });
}
