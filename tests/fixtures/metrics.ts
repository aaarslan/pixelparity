import { CLASSIC_PROFILE, DEFAULT_PREFERENCES } from "../../src/shared/constants";
import type { MetricsSnapshotV2, PageMetrics, PreferencesV2 } from "../../src/shared/types";

export const DEMO_PAGE_METRICS: PageMetrics = {
  viewport: {
    layoutWidth: 1280,
    layoutHeight: 720,
    visualWidth: 1280,
    visualHeight: 720,
    visualOffsetLeft: 0,
    visualOffsetTop: 0,
    visualScale: 1,
    outerWidth: 1440,
    outerHeight: 900,
    scrollbarWidth: 15,
    scrollbarHeight: 0,
  },
  display: { devicePixelRatio: 2 },
  screen: {
    width: 1728,
    height: 1117,
    availableWidth: 1728,
    availableHeight: 1079,
    colorDepth: 30,
    pixelDepth: 30,
    orientationType: "landscape-primary",
    orientationAngle: 0,
  },
  document: { width: 1280, height: 4382 },
  typography: { rootFontSize: 16, bodyFontSize: 16 },
  environment: {
    colorScheme: "dark",
    reducedMotion: false,
    forcedColors: false,
    pointer: "fine",
    hover: "hover",
    colorGamut: "p3",
  },
};

export const DEMO_PREFERENCES: PreferencesV2 = {
  ...structuredClone(DEFAULT_PREFERENCES),
  theme: "dark",
  customProfiles: [
    {
      id: "custom-product",
      name: "Product UI",
      points: [
        { id: "product-base", label: "Base", minWidth: 0 },
        { id: "product-tablet", label: "Tablet", minWidth: 768 },
        { id: "product-desktop", label: "Desktop", minWidth: 1200 },
        { id: "product-wide", label: "Wide", minWidth: 1600 },
      ],
    },
  ],
};

export const DEMO_SNAPSHOT: MetricsSnapshotV2 = {
  schemaVersion: 2,
  capturedAt: Date.UTC(2026, 6, 18, 16, 42, 0),
  viewport: {
    layout: { width: 1280, height: 720, aspectRatio: 1280 / 720 },
    visual: { width: 1280, height: 720, offsetLeft: 0, offsetTop: 0, scale: 1 },
    outer: { width: 1440, height: 900 },
    scrollbar: { width: 15, height: 0 },
  },
  display: {
    devicePixelRatio: 2,
    tabZoom: 1.25,
    tabZoomPercent: 125,
    renderedPixelEstimate: { width: 2560, height: 1440 },
  },
  screen: {
    width: 1728,
    height: 1117,
    availableWidth: 1728,
    availableHeight: 1079,
    colorDepth: 30,
    pixelDepth: 30,
    orientationType: "landscape-primary",
    orientationAngle: 0,
  },
  document: { width: 1280, height: 4382 },
  typography: { rootFontSize: 16, bodyFontSize: 16 },
  environment: {
    colorScheme: "dark",
    reducedMotion: false,
    forcedColors: false,
    pointer: "fine",
    hover: "hover",
    colorGamut: "p3",
  },
  breakpoint: {
    profileId: CLASSIC_PROFILE.id,
    profileName: CLASSIC_PROFILE.name,
    pointId: "classic-xl",
    label: "XL",
    minWidth: 1200,
    nextMinWidth: 1400,
  },
};

export const DEMO_BASELINE: MetricsSnapshotV2 = {
  ...structuredClone(DEMO_SNAPSHOT),
  capturedAt: DEMO_SNAPSHOT.capturedAt - 60_000,
  viewport: {
    ...structuredClone(DEMO_SNAPSHOT.viewport),
    layout: { width: 1024, height: 720, aspectRatio: 1024 / 720 },
  },
  display: {
    ...structuredClone(DEMO_SNAPSHOT.display),
    tabZoom: 1,
    tabZoomPercent: 100,
    renderedPixelEstimate: { width: 2048, height: 1440 },
  },
  breakpoint: {
    ...DEMO_SNAPSHOT.breakpoint,
    pointId: "classic-lg",
    label: "LG",
    minWidth: 992,
    nextMinWidth: 1200,
  },
};
