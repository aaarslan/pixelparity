import type { CaptureOptions, CapturePageState } from "../shared/capture";
import { settledFrames } from "./async";

const INSET_PROPERTIES = [
  "inset",
  "inset-block",
  "inset-inline",
  "top",
  "right",
  "bottom",
  "left",
  "inset-block-start",
  "inset-block-end",
  "inset-inline-start",
  "inset-inline-end",
];

interface PropertyPatch {
  element: HTMLElement;
  property: string;
  value: string;
  priority: string;
}

export class CapturePage {
  private readonly patches: PropertyPatch[] = [];
  private readonly insetPatches: { element: HTMLElement; properties: PropertyPatch[] }[] =
    [];
  private readonly initialScroll = { x: window.scrollX, y: window.scrollY };
  private prepared = false;
  private scrollPrepared = false;

  constructor(private readonly documentToken: string) {}

  read(): CapturePageState {
    const root = document.documentElement;
    const body = document.body;
    const scroller = document.scrollingElement ?? root;
    const viewportRoot = document.compatMode === "BackCompat" ? (body ?? root) : root;
    const viewport = window.visualViewport;
    return {
      documentToken: this.documentToken,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      contentWidth: viewport?.width ?? (viewportRoot.clientWidth || innerWidth),
      contentHeight: viewport?.height ?? (viewportRoot.clientHeight || innerHeight),
      documentWidth: Math.max(
        scroller.scrollWidth,
        body?.scrollWidth ?? 0,
        root.clientWidth,
      ),
      documentHeight: Math.max(
        scroller.scrollHeight,
        body?.scrollHeight ?? 0,
        root.clientHeight,
      ),
      scrollX,
      scrollY,
      devicePixelRatio,
      visualScale: viewport?.scale ?? 1,
      visualOffsetX: viewport?.offsetLeft ?? 0,
      visualOffsetY: viewport?.offsetTop ?? 0,
    };
  }

  private patch(element: HTMLElement, property: string, value: string): void {
    if (
      this.patches.some((entry) => entry.element === element && entry.property === property)
    )
      return;
    this.patches.push({
      element,
      property,
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property),
    });
    element.style.setProperty(property, value, "important");
  }

  private neutralizeInsets(element: HTMLElement): void {
    const properties = Array.from(element.style)
      .filter((property) => INSET_PROPERTIES.includes(property))
      .map((property) => ({
        element,
        property,
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property),
      }));
    this.insetPatches.push({ element, properties });
    for (const property of ["inset", "inset-block", "inset-inline"]) {
      element.style.setProperty(property, "auto", "important");
    }
  }

  async prepare(options: CaptureOptions): Promise<CapturePageState> {
    if (this.prepared) throw new Error("A capture is already in progress in this page.");
    this.prepared = true;
    if (!options.includeOverlays) {
      for (const element of document.querySelectorAll<HTMLElement>(
        "[data-pixelparity-overlay]",
      )) {
        this.patch(element, "visibility", "hidden");
      }
    }
    if (options.mode === "full") {
      if (
        getComputedStyle(document.documentElement).direction === "rtl" &&
        this.read().documentWidth > this.read().contentWidth
      ) {
        throw new Error(
          "Full-page capture does not support horizontally scrolling right-to-left pages. Capture a viewport or region.",
        );
      }
      this.scrollPrepared = true;
      for (const element of [document.documentElement, document.body]) {
        if (!element) continue;
        this.patch(element, "scroll-behavior", "auto");
        this.patch(element, "scroll-snap-type", "none");
      }
      if (options.hideFixed) {
        for (const element of document.querySelectorAll<HTMLElement>("body *")) {
          if (
            !(element instanceof HTMLElement) ||
            element.closest("[data-pixelparity-overlay],[data-pixelparity-capture]")
          )
            continue;
          const position = getComputedStyle(element).position;
          if (position === "sticky") {
            this.patch(element, "position", "relative");
            this.neutralizeInsets(element);
          }
          if (position === "fixed") {
            const rect = element.getBoundingClientRect();
            if (rect.width > innerWidth * 0.8 && rect.height > innerHeight * 0.8) continue;
            this.patch(element, "visibility", "hidden");
          }
        }
      }
    }
    await settledFrames();
    return this.read();
  }

  async scroll(x: number, y: number): Promise<CapturePageState> {
    if (!this.scrollPrepared)
      throw new Error("The page is not ready for scrolling capture.");
    window.scrollTo({ left: x, top: y, behavior: "instant" });
    await settledFrames();
    return this.read();
  }

  restore(): void {
    if (this.scrollPrepared) {
      window.scrollTo({
        left: this.initialScroll.x,
        top: this.initialScroll.y,
        behavior: "instant",
      });
    }
    for (const group of this.insetPatches) {
      for (const property of INSET_PROPERTIES) group.element.style.removeProperty(property);
      for (const property of group.properties)
        group.element.style.setProperty(
          property.property,
          property.value,
          property.priority,
        );
    }
    this.insetPatches.length = 0;
    for (const patch of this.patches.reverse()) {
      if (patch.value)
        patch.element.style.setProperty(patch.property, patch.value, patch.priority);
      else patch.element.style.removeProperty(patch.property);
    }
    this.patches.length = 0;
    this.prepared = false;
    this.scrollPrepared = false;
  }
}
