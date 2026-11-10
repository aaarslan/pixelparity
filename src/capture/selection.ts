import { type CaptureRect, clipCaptureRegion } from "../shared/capture";

export function selectCaptureRegion(signal: AbortSignal): Promise<CaptureRect> {
  return new Promise((resolve, reject) => {
    const host = document.createElement("div");
    host.dataset.pixelparityCapture = "selection";
    host.style.cssText =
      "all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;";
    const root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      :host{color-scheme:dark}
      *{box-sizing:border-box}
      .surface{position:fixed;inset:0;cursor:crosshair;touch-action:none;outline:none;background:#09111f3d;font:500 13px/1.5 system-ui,sans-serif;color:#fff}
      .box{position:absolute;border:2px solid #6ee7ff;background:#6ee7ff12;box-shadow:0 0 0 100vmax #09111f70;pointer-events:none}
      .size{position:absolute;bottom:calc(100% + 8px);left:-2px;white-space:nowrap;background:#101b2d;color:#fff;border:1px solid #517083;border-radius:6px;padding:4px 8px;font-variant-numeric:tabular-nums}
      .toolbar{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:10px;width:max-content;max-width:calc(100vw - 24px);padding:12px 16px;border:1px solid #46607f;border-radius:14px;background:#101b2d;box-shadow:0 10px 32px #0005;cursor:default}
      .hint{max-width:290px;color:#c8d4e6;font-size:12px}
      button{border:1px solid #46607f;border-radius:8px;background:#182740;color:#fff;padding:8px 12px;font:600 12px/1.5 system-ui,sans-serif;cursor:pointer}
      button.primary{background:#70a5ff;color:#071325;border-color:#70a5ff}
      button:focus-visible{outline:3px solid #6ee7ff;outline-offset:3px}
    `;
    const surface = document.createElement("div");
    surface.className = "surface";
    surface.tabIndex = 0;
    surface.setAttribute("role", "dialog");
    surface.setAttribute("aria-modal", "true");
    surface.setAttribute("aria-label", "Select screenshot region");
    surface.setAttribute("aria-describedby", "capture-selection-hint");
    const box = document.createElement("div");
    box.className = "box";
    const size = document.createElement("span");
    size.className = "size";
    size.setAttribute("aria-live", "polite");
    box.append(size);
    const toolbar = document.createElement("div");
    toolbar.className = "toolbar";
    const hint = document.createElement("p");
    hint.id = "capture-selection-hint";
    hint.className = "hint";
    hint.textContent =
      "Drag a region. Arrows move it; Shift + arrows resize. Enter captures; Esc cancels.";
    const captureButton = document.createElement("button");
    captureButton.type = "button";
    captureButton.className = "primary";
    captureButton.textContent = "Capture region";
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    toolbar.append(hint, captureButton, cancelButton);
    surface.append(box, toolbar);
    root.append(style, surface);
    const previousFocus = document.activeElement;
    let region: CaptureRect = {
      x: Math.round(innerWidth * 0.2),
      y: Math.round(innerHeight * 0.2),
      width: Math.round(innerWidth * 0.6),
      height: Math.round(innerHeight * 0.5),
    };
    let start: { x: number; y: number; pointerId: number } | null = null;
    let finished = false;
    const listeners = new AbortController();
    const stop = (result?: CaptureRect) => {
      if (finished) return;
      finished = true;
      listeners.abort();
      signal.removeEventListener("abort", abort);
      host.remove();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
      if (result) resolve(result);
      else reject(new DOMException("Capture cancelled.", "AbortError"));
    };
    const abort = () => stop();
    const draw = () => {
      box.style.left = `${region.x}px`;
      box.style.top = `${region.y}px`;
      box.style.width = `${region.width}px`;
      box.style.height = `${region.height}px`;
      size.textContent = `${Math.round(region.width)} × ${Math.round(region.height)} CSS px`;
    };
    const confirm = () => {
      try {
        stop(clipCaptureRegion(region, innerWidth, innerHeight));
      } catch {
        hint.textContent = "Draw a region at least 2 CSS pixels wide and tall.";
      }
    };
    const listen = { signal: listeners.signal };
    surface.addEventListener(
      "pointerdown",
      (event) => {
        if (toolbar.contains(event.target as Node) || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        start = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
        surface.setPointerCapture(event.pointerId);
        region = { x: start.x, y: start.y, width: 0, height: 0 };
        draw();
      },
      listen,
    );
    surface.addEventListener(
      "pointermove",
      (event) => {
        if (!start || event.pointerId !== start.pointerId) return;
        const x = Math.max(0, Math.min(innerWidth, event.clientX));
        const y = Math.max(0, Math.min(innerHeight, event.clientY));
        region = {
          x: Math.min(start.x, x),
          y: Math.min(start.y, y),
          width: Math.abs(x - start.x),
          height: Math.abs(y - start.y),
        };
        draw();
      },
      listen,
    );
    surface.addEventListener(
      "pointerup",
      (event) => {
        if (!start || event.pointerId !== start.pointerId) return;
        surface.releasePointerCapture(event.pointerId);
        start = null;
      },
      listen,
    );
    surface.addEventListener(
      "pointercancel",
      () => {
        start = null;
      },
      listen,
    );
    captureButton.addEventListener("click", confirm, listen);
    cancelButton.addEventListener("click", () => stop(), listen);
    surface.addEventListener(
      "keydown",
      (event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          stop();
        } else if (event.key === "Enter" && event.target === surface) {
          event.preventDefault();
          confirm();
        } else if (event.key.startsWith("Arrow")) {
          event.preventDefault();
          const dx = event.key === "ArrowRight" ? 10 : event.key === "ArrowLeft" ? -10 : 0;
          const dy = event.key === "ArrowDown" ? 10 : event.key === "ArrowUp" ? -10 : 0;
          if (event.shiftKey) {
            region.width = Math.max(2, Math.min(innerWidth - region.x, region.width + dx));
            region.height = Math.max(
              2,
              Math.min(innerHeight - region.y, region.height + dy),
            );
          } else {
            region.x = Math.max(0, Math.min(innerWidth - region.width, region.x + dx));
            region.y = Math.max(0, Math.min(innerHeight - region.height, region.y + dy));
          }
          draw();
        } else if (event.key === "Tab") {
          event.preventDefault();
          const focusables = [surface, captureButton, cancelButton];
          const index = focusables.indexOf(
            root.activeElement as HTMLDivElement & HTMLButtonElement,
          );
          focusables[(index + (event.shiftKey ? 2 : 1)) % 3]?.focus();
        } else if (
          [" ", "PageUp", "PageDown", "Home", "End"].includes(event.key) &&
          event.target === surface
        ) {
          event.preventDefault();
        }
      },
      listen,
    );
    surface.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
      },
      { ...listen, passive: false },
    );
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    document.documentElement.append(host);
    draw();
    surface.focus({ preventScroll: true });
  });
}
