import type { BoxEdges, ElementMeasurement } from "../shared/overlay";

function pixels(value: string, nonNegative = false): number {
  const parsed = Number.parseFloat(value);
  const finite = Number.isFinite(parsed)
    ? Math.max(-10_000_000, Math.min(10_000_000, parsed))
    : 0;
  return nonNegative ? Math.max(0, finite) : finite;
}

function edges(
  style: CSSStyleDeclaration,
  prefix: "margin" | "padding" | "border",
): BoxEdges {
  const suffix = prefix === "border" ? "-width" : "";
  return ["top", "right", "bottom", "left"].map((side) =>
    pixels(style.getPropertyValue(`${prefix}-${side}${suffix}`), prefix !== "margin"),
  ) as BoxEdges;
}

export function measureElement(element: Element, locked: boolean): ElementMeasurement {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return {
    tag: element.tagName.toLowerCase().slice(0, 64),
    x: pixels(String(rect.x)),
    y: pixels(String(rect.y)),
    width: pixels(String(rect.width), true),
    height: pixels(String(rect.height), true),
    margin: edges(style, "margin"),
    padding: edges(style, "padding"),
    border: edges(style, "border"),
    rowGap: style.rowGap || "normal",
    columnGap: style.columnGap || "normal",
    fontSize: pixels(style.fontSize, true),
    lineHeight: style.lineHeight === "normal" ? null : pixels(style.lineHeight, true),
    display: style.display,
    position: style.position,
    boxSizing: style.boxSizing === "border-box" ? "border-box" : "content-box",
    locked,
  };
}
