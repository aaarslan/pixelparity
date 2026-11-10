import {
  DEFAULT_OVERLAY_SETTINGS,
  OVERLAY_PORT_NAME,
  copyOverlaySettings,
  isElementMeasurement,
  isOverlayCommand,
  type ElementMeasurement,
  type OverlayEvent,
  type OverlaySettings,
} from "../shared/overlay";
import { measureElement } from "./measurement";
import { OverlayRenderer } from "./renderer";

class OverlaySession {
  private settings: OverlaySettings = { ...DEFAULT_OVERLAY_SETTINGS };
  private renderer: OverlayRenderer | null = null;
  private selected: Element | null = null;
  private locked = false;
  private frame: number | null = null;
  private destroyed = false;
  private lastMeasurement = "";
  private pointer: { x: number; y: number } | null = null;
  private readonly events = new AbortController();
  private readonly observer = new ResizeObserver(() => this.schedule());

  constructor(private readonly port: chrome.runtime.Port) {
    const options = { passive: true, signal: this.events.signal };
    window.addEventListener("resize", this.schedule, options);
    window.addEventListener("scroll", this.schedule, { ...options, capture: true });
    window.visualViewport?.addEventListener("resize", this.schedule, options);
    window.visualViewport?.addEventListener("scroll", this.schedule, options);
    window.addEventListener("pagehide", this.destroy, { signal: this.events.signal });
    window.addEventListener("keydown", this.onKeyDown, {
      capture: true,
      signal: this.events.signal,
    });
    port.onDisconnect.addListener(this.destroy);
    port.onMessage.addListener((message: unknown) => {
      if (this.destroyed || !isOverlayCommand(message)) return;
      if (message.type === "PIXELPARITY/OVERLAY_SET") {
        const startPicking = message.settings.inspect && !this.settings.inspect;
        this.settings = copyOverlaySettings(message.settings);
        if (startPicking || !this.settings.inspect) this.clearSelection();
      } else if (message.type === "PIXELPARITY/OVERLAY_RESUME") {
        this.settings.inspect = true;
        this.clearSelection();
      } else {
        this.settings = {
          ...this.settings,
          gridEnabled: false,
          rulers: false,
          inspect: false,
        };
        this.clearSelection();
      }
      this.sendState();
      this.render();
    });
    this.sendState();
  }

  readonly destroy = (): void => {
    if (this.destroyed) return;
    this.destroyed = true;
    this.events.abort();
    this.observer.disconnect();
    if (this.frame !== null) window.cancelAnimationFrame(this.frame);
    this.frame = null;
    this.renderer?.destroy();
    this.renderer = null;
    this.selected = null;
    this.pointer = null;
    this.port.disconnect();
  };

  private post(event: OverlayEvent): void {
    if (this.destroyed) return;
    try {
      this.port.postMessage(event);
    } catch {
      this.destroy();
    }
  }

  private sendState(): void {
    this.post({
      type: "PIXELPARITY/OVERLAY_STATE",
      settings: copyOverlaySettings(this.settings),
    });
  }

  private clearSelection(): void {
    this.selected = null;
    this.pointer = null;
    this.locked = false;
    this.lastMeasurement = "";
    this.observer.disconnect();
    this.post({ type: "PIXELPARITY/OVERLAY_MEASUREMENT", measurement: null });
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (document.querySelector("[data-pixelparity-capture]")) return;
    if (
      event.key !== "Escape" ||
      (!this.settings.inspect && !this.settings.gridEnabled && !this.settings.rulers)
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    if (this.settings.inspect) {
      this.settings.inspect = false;
      this.clearSelection();
    } else {
      this.settings.gridEnabled = false;
      this.settings.rulers = false;
    }
    this.sendState();
    this.render();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.settings.inspect || this.locked) return;
    this.pointer = { x: event.clientX, y: event.clientY };
    this.schedule();
  };

  private readonly onPick = (event: MouseEvent): void => {
    if (!this.settings.inspect) return;
    event.preventDefault();
    event.stopPropagation();
    this.pointer = { x: event.clientX, y: event.clientY };
    this.locked = false;
    this.selectAtPointer();
    this.locked = true;
    this.render();
  };

  private selectAtPointer(): void {
    if (!this.renderer || !this.pointer || this.locked) return;
    const selected = this.renderer.elementAt(this.pointer.x, this.pointer.y);
    if (selected === this.selected) return;
    this.observer.disconnect();
    this.selected = selected;
    if (selected) this.observer.observe(selected);
  }

  private readonly schedule = (): void => {
    if (
      this.destroyed ||
      this.frame !== null ||
      (!this.settings.gridEnabled && !this.settings.rulers && !this.settings.inspect)
    )
      return;
    this.frame = window.requestAnimationFrame(() => {
      this.frame = null;
      this.selectAtPointer();
      this.render();
    });
  };

  private render(): void {
    if (this.destroyed) return;
    if (!this.settings.gridEnabled && !this.settings.rulers && !this.settings.inspect) {
      this.renderer?.destroy();
      this.renderer = null;
      return;
    }
    if (!this.renderer) {
      this.renderer = new OverlayRenderer();
      this.renderer.picker.addEventListener("pointermove", this.onPointerMove);
      this.renderer.picker.addEventListener("click", this.onPick);
      this.renderer.picker.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    }
    let measurement: ElementMeasurement | null = null;
    if (this.settings.inspect && this.selected?.isConnected) {
      const result = measureElement(this.selected, this.locked);
      if (isElementMeasurement(result)) measurement = result;
    }
    this.renderer.render(this.settings, measurement);
    const serialized = JSON.stringify(measurement);
    if (serialized !== this.lastMeasurement) {
      this.lastMeasurement = serialized;
      this.post({ type: "PIXELPARITY/OVERLAY_MEASUREMENT", measurement });
    }
  }
}

type OverlayGlobal = typeof globalThis & { __PIXELPARITY_OVERLAY_V3__?: true };
const overlayGlobal = globalThis as OverlayGlobal;
if (!overlayGlobal.__PIXELPARITY_OVERLAY_V3__) {
  overlayGlobal.__PIXELPARITY_OVERLAY_V3__ = true;
  let session: OverlaySession | null = null;
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== OVERLAY_PORT_NAME || port.sender?.id !== chrome.runtime.id) return;
    session?.destroy();
    session = new OverlaySession(port);
  });
}
