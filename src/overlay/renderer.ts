import {
  columnGeometry,
  formatMeasurement,
  gridOffset,
  type ElementMeasurement,
  type OverlaySettings,
} from "../shared/overlay";
import { PAGE_STYLE } from "./page-style";

function node<T extends keyof HTMLElementTagNameMap>(
  tag: T,
  className: string,
): HTMLElementTagNameMap[T] {
  const element = document.createElement(tag);
  element.className = className;
  return element;
}

export class OverlayRenderer {
  readonly host = document.createElement("pixelparity-overlay");
  readonly picker = node("div", "picker");
  private readonly grid = node("div", "grid");
  private readonly horizontal = node("canvas", "ruler ruler-x");
  private readonly vertical = node("canvas", "ruler ruler-y");
  private readonly highlight = node("div", "highlight");
  private readonly guideX = node("div", "guide guide-x");
  private readonly guideY = node("div", "guide guide-y");
  private readonly hud = node("div", "hud");
  private readonly heading = node("strong", "");
  private readonly values = node("span", "values");
  private readonly spacing = node("span", "spacing");
  private readonly hint = node("span", "hint");
  private gridKey = "";

  constructor() {
    this.host.setAttribute("data-pixelparity-overlay", "");
    this.host.setAttribute("aria-hidden", "true");
    this.host.style.cssText =
      "all:initial!important;display:block!important;position:fixed!important;inset:0!important;width:100%!important;height:100%!important;z-index:2147483646!important;pointer-events:none!important;contain:strict!important;isolation:isolate!important;";
    const shadow = this.host.attachShadow({ mode: "closed" });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(PAGE_STYLE);
    shadow.adoptedStyleSheets = [sheet];
    const layer = node("div", "layer");
    this.hud.append(this.heading, this.values, this.spacing, this.hint);
    layer.append(
      this.grid,
      this.picker,
      this.guideX,
      this.guideY,
      this.highlight,
      this.horizontal,
      this.vertical,
      this.hud,
    );
    shadow.append(layer);
    document.documentElement.append(this.host);
  }

  elementAt(x: number, y: number): Element | null {
    this.picker.style.pointerEvents = "none";
    const element = document.elementFromPoint(x, y);
    this.picker.style.pointerEvents = "auto";
    return element === this.host ? null : element;
  }

  render(settings: OverlaySettings, measurement: ElementMeasurement | null): void {
    this.renderGrid(settings);
    this.picker.hidden = !settings.inspect;
    this.horizontal.hidden = !settings.rulers;
    this.vertical.hidden = !settings.rulers;
    if (settings.rulers) this.renderRulers();
    const hasMeasurement = settings.inspect && measurement !== null;
    for (const element of [this.highlight, this.guideX, this.guideY, this.hud]) {
      element.hidden = !hasMeasurement;
    }
    if (hasMeasurement) this.renderMeasurement(measurement);
  }

  destroy(): void {
    this.host.remove();
  }

  private renderGrid(settings: OverlaySettings): void {
    this.grid.hidden = !settings.gridEnabled;
    if (!settings.gridEnabled) return;
    this.grid.style.opacity = String(settings.opacity);
    this.grid.style.color = settings.color;
    const key = `${settings.gridType}:${settings.columns}`;
    if (key !== this.gridKey) {
      this.grid.replaceChildren();
      this.gridKey = key;
      if (settings.gridType === "columns") {
        for (let index = 0; index < settings.columns; index++) {
          this.grid.append(node("div", "column"));
        }
      }
    }
    if (settings.gridType === "columns") {
      const geometry = columnGeometry(document.documentElement.clientWidth, settings);
      this.grid.className = "grid columns";
      this.grid.style.left = `${geometry.left - window.scrollX}px`;
      this.grid.style.width = `${geometry.width}px`;
      this.grid.style.gridTemplateColumns = `repeat(${geometry.columns}, minmax(0, 1fr))`;
      this.grid.style.gap = `${geometry.gutter}px`;
      this.grid.style.backgroundImage = "none";
    } else {
      this.grid.className = "grid";
      this.grid.style.left = "0";
      this.grid.style.width = "100%";
      this.grid.style.backgroundImage =
        settings.gridType === "square"
          ? `linear-gradient(to right, ${settings.color} 1px, transparent 1px),linear-gradient(to bottom, ${settings.color} 1px, transparent 1px)`
          : `linear-gradient(to bottom, ${settings.color} 1px, transparent 1px)`;
      this.grid.style.backgroundSize = `${settings.spacing}px ${settings.spacing}px`;
      this.grid.style.backgroundPosition = `${gridOffset(window.scrollX, settings.spacing)}px ${gridOffset(window.scrollY, settings.spacing)}px`;
    }
  }

  private drawRuler(
    canvas: HTMLCanvasElement,
    length: number,
    scroll: number,
    vertical: boolean,
  ): void {
    const ratio = Math.min(2, window.devicePixelRatio || 1, 32760 / Math.max(1, length));
    const width = vertical ? 22 : length;
    const height = vertical ? length : 22;
    canvas.width = Math.ceil(width * ratio);
    canvas.height = Math.ceil(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.fillStyle = "#111827";
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#64748b";
    context.fillStyle = "#e2e8f0";
    context.lineWidth = 1;
    context.font = "10px ui-monospace, monospace";
    context.textBaseline = "top";
    const first = Math.floor(scroll / 10) * 10;
    for (let value = first; value <= scroll + length; value += 10) {
      const position = value - scroll;
      const major = value % 100 === 0;
      const middle = value % 50 === 0;
      const tick = major ? 12 : middle ? 7 : 4;
      context.beginPath();
      if (vertical) {
        context.moveTo(22 - tick, position + 0.5);
        context.lineTo(22, position + 0.5);
      } else {
        context.moveTo(position + 0.5, 22 - tick);
        context.lineTo(position + 0.5, 22);
      }
      context.stroke();
      if (major) {
        if (vertical) {
          context.save();
          context.translate(2, position - 3);
          context.rotate(-Math.PI / 2);
          context.fillText(String(value), 0, 0);
          context.restore();
        } else {
          context.fillText(String(value), position + 3, 2);
        }
      }
    }
  }

  private renderRulers(): void {
    this.drawRuler(this.horizontal, window.innerWidth, window.scrollX, false);
    this.drawRuler(
      this.vertical,
      Math.max(0, window.innerHeight - 22),
      window.scrollY + 22,
      true,
    );
  }

  private renderMeasurement(measurement: ElementMeasurement): void {
    Object.assign(this.highlight.style, {
      left: `${measurement.x}px`,
      top: `${measurement.y}px`,
      width: `${measurement.width}px`,
      height: `${measurement.height}px`,
    });
    this.guideX.style.top = `${measurement.y}px`;
    this.guideY.style.left = `${measurement.x}px`;
    this.heading.textContent = `<${measurement.tag}>${measurement.locked ? " · Locked" : ""}`;
    this.values.textContent = `${formatMeasurement(measurement.width)} × ${formatMeasurement(measurement.height)} CSS px`;
    this.spacing.textContent = `Padding ${measurement.padding.map(formatMeasurement).join(" / ")} · Gap ${measurement.rowGap} / ${measurement.columnGap}`;
    this.hint.textContent = measurement.locked
      ? "Click another element · Esc to exit"
      : "Click to lock · Esc to exit";
    const left = Math.min(Math.max(8, measurement.x), Math.max(8, window.innerWidth - 264));
    const below = measurement.y + measurement.height + 10;
    const top =
      below + 128 < window.innerHeight
        ? Math.max(28, below)
        : Math.max(28, Math.min(measurement.y - 124, window.innerHeight - 136));
    this.hud.style.left = `${left}px`;
    this.hud.style.top = `${top}px`;
  }
}
