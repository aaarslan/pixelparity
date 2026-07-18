import { getActiveBreakpoint } from "./breakpoints";
import type { BreakpointProfile, MetricsSnapshotV2, PageMetrics } from "./types";

function finite(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function mediaMatches(query: string): boolean {
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

function documentExtent(axis: "Width" | "Height"): number {
  const root = document.documentElement;
  const body = document.body;
  const keys = [`scroll${axis}`, `offset${axis}`, `client${axis}`] as const;
  const values = [window[`inner${axis}` as "innerWidth" | "innerHeight"]];
  for (const element of [root, body]) {
    if (!element) continue;
    for (const key of keys) values.push(element[key]);
  }
  return Math.max(0, ...values.map((value) => finite(value)));
}

export function capturePageMetrics(): PageMetrics | null {
  const root = document.documentElement;
  if (!root) return null;

  const body = document.body;
  const visual = window.visualViewport;
  const rootStyle = window.getComputedStyle(root);
  const bodyStyle = body ? window.getComputedStyle(body) : rootStyle;
  const layoutWidth = finite(window.innerWidth);
  const layoutHeight = finite(window.innerHeight);
  const orientation = window.screen.orientation;
  const fallbackOrientation =
    window.screen.width >= window.screen.height ? "landscape-primary" : "portrait-primary";
  const pointer = mediaMatches("(pointer: fine)")
    ? "fine"
    : mediaMatches("(pointer: coarse)")
      ? "coarse"
      : "none";
  const colorGamut = mediaMatches("(color-gamut: rec2020)")
    ? "rec2020"
    : mediaMatches("(color-gamut: p3)")
      ? "p3"
      : mediaMatches("(color-gamut: srgb)")
        ? "srgb"
        : "unknown";

  return {
    viewport: {
      layoutWidth,
      layoutHeight,
      visualWidth: finite(visual?.width, layoutWidth),
      visualHeight: finite(visual?.height, layoutHeight),
      visualOffsetLeft: finite(visual?.offsetLeft),
      visualOffsetTop: finite(visual?.offsetTop),
      visualScale: finite(visual?.scale, 1),
      outerWidth: finite(window.outerWidth),
      outerHeight: finite(window.outerHeight),
      scrollbarWidth: Math.max(0, layoutWidth - finite(root.clientWidth, layoutWidth)),
      scrollbarHeight: Math.max(0, layoutHeight - finite(root.clientHeight, layoutHeight)),
    },
    display: {
      devicePixelRatio: finite(window.devicePixelRatio, 1),
    },
    screen: {
      width: finite(window.screen.width),
      height: finite(window.screen.height),
      availableWidth: finite(window.screen.availWidth),
      availableHeight: finite(window.screen.availHeight),
      colorDepth: finite(window.screen.colorDepth),
      pixelDepth: finite(window.screen.pixelDepth),
      orientationType: orientation?.type ?? fallbackOrientation,
      orientationAngle: finite(orientation?.angle),
    },
    document: {
      width: documentExtent("Width"),
      height: documentExtent("Height"),
    },
    typography: {
      rootFontSize: finite(Number.parseFloat(rootStyle.fontSize), 16),
      bodyFontSize: finite(Number.parseFloat(bodyStyle.fontSize), 16),
    },
    environment: {
      colorScheme: mediaMatches("(prefers-color-scheme: dark)") ? "dark" : "light",
      reducedMotion: mediaMatches("(prefers-reduced-motion: reduce)"),
      forcedColors: mediaMatches("(forced-colors: active)"),
      pointer,
      hover: mediaMatches("(hover: hover)") ? "hover" : "none",
      colorGamut,
    },
  };
}

export function createSnapshot(
  page: PageMetrics,
  tabZoom: number,
  profile: BreakpointProfile,
  capturedAt = Date.now(),
): MetricsSnapshotV2 {
  const safeZoom = finite(tabZoom, 1);
  const width = finite(page.viewport.layoutWidth);
  const height = finite(page.viewport.layoutHeight);
  const dpr = finite(page.display.devicePixelRatio, 1);

  return {
    schemaVersion: 2,
    capturedAt,
    viewport: {
      layout: {
        width,
        height,
        aspectRatio: height > 0 ? width / height : 0,
      },
      visual: {
        width: finite(page.viewport.visualWidth),
        height: finite(page.viewport.visualHeight),
        offsetLeft: finite(page.viewport.visualOffsetLeft),
        offsetTop: finite(page.viewport.visualOffsetTop),
        scale: finite(page.viewport.visualScale, 1),
      },
      outer: {
        width: finite(page.viewport.outerWidth),
        height: finite(page.viewport.outerHeight),
      },
      scrollbar: {
        width: finite(page.viewport.scrollbarWidth),
        height: finite(page.viewport.scrollbarHeight),
      },
    },
    display: {
      devicePixelRatio: dpr,
      tabZoom: safeZoom,
      tabZoomPercent: safeZoom * 100,
      renderedPixelEstimate: {
        width: width * dpr,
        height: height * dpr,
      },
    },
    screen: {
      width: finite(page.screen.width),
      height: finite(page.screen.height),
      availableWidth: finite(page.screen.availableWidth),
      availableHeight: finite(page.screen.availableHeight),
      colorDepth: finite(page.screen.colorDepth),
      pixelDepth: finite(page.screen.pixelDepth),
      orientationType: page.screen.orientationType,
      orientationAngle: finite(page.screen.orientationAngle),
    },
    document: {
      width: finite(page.document.width),
      height: finite(page.document.height),
    },
    typography: {
      rootFontSize: finite(page.typography.rootFontSize, 16),
      bodyFontSize: finite(page.typography.bodyFontSize, 16),
    },
    environment: {
      colorScheme: page.environment.colorScheme,
      reducedMotion: page.environment.reducedMotion,
      forcedColors: page.environment.forcedColors,
      pointer: page.environment.pointer,
      hover: page.environment.hover,
      colorGamut: page.environment.colorGamut,
    },
    breakpoint: getActiveBreakpoint(width, profile),
  };
}
