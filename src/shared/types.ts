export const SNAPSHOT_SCHEMA_VERSION = 2 as const;
export const PREFERENCES_SCHEMA_VERSION = 2 as const;

export type ThemePreference = "system" | "light" | "dark";
export type DensityPreference = "comfortable" | "compact";
export type ExportFormat = "json" | "css" | "markdown" | "tsv";

export interface BreakpointPoint {
  id: string;
  label: string;
  minWidth: number;
}

export interface BreakpointProfile {
  id: string;
  name: string;
  points: BreakpointPoint[];
}

export interface PreferencesV2 {
  schemaVersion: typeof PREFERENCES_SCHEMA_VERSION;
  theme: ThemePreference;
  density: DensityPreference;
  activeProfileId: string;
  customProfiles: BreakpointProfile[];
  defaultExportFormat: ExportFormat;
}

export type ColorScheme = "light" | "dark";
export type PointerCapability = "fine" | "coarse" | "none";
export type HoverCapability = "hover" | "none";
export type ColorGamut = "srgb" | "p3" | "rec2020" | "unknown";

export interface PageMetrics {
  viewport: {
    layoutWidth: number;
    layoutHeight: number;
    visualWidth: number;
    visualHeight: number;
    visualOffsetLeft: number;
    visualOffsetTop: number;
    visualScale: number;
    outerWidth: number;
    outerHeight: number;
    scrollbarWidth: number;
    scrollbarHeight: number;
  };
  display: {
    devicePixelRatio: number;
  };
  screen: {
    width: number;
    height: number;
    availableWidth: number;
    availableHeight: number;
    colorDepth: number;
    pixelDepth: number;
    orientationType: string;
    orientationAngle: number;
  };
  document: {
    width: number;
    height: number;
  };
  typography: {
    rootFontSize: number;
    bodyFontSize: number;
  };
  environment: {
    colorScheme: ColorScheme;
    reducedMotion: boolean;
    forcedColors: boolean;
    pointer: PointerCapability;
    hover: HoverCapability;
    colorGamut: ColorGamut;
  };
}

export interface ActiveBreakpoint {
  profileId: string;
  profileName: string;
  pointId: string;
  label: string;
  minWidth: number;
  nextMinWidth: number | null;
}

export interface MetricsSnapshotV2 {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  capturedAt: number;
  viewport: {
    layout: {
      width: number;
      height: number;
      aspectRatio: number;
    };
    visual: {
      width: number;
      height: number;
      offsetLeft: number;
      offsetTop: number;
      scale: number;
    };
    outer: {
      width: number;
      height: number;
    };
    scrollbar: {
      width: number;
      height: number;
    };
  };
  display: {
    devicePixelRatio: number;
    tabZoom: number;
    tabZoomPercent: number;
    renderedPixelEstimate: {
      width: number;
      height: number;
    };
  };
  screen: {
    width: number;
    height: number;
    availableWidth: number;
    availableHeight: number;
    colorDepth: number;
    pixelDepth: number;
    orientationType: string;
    orientationAngle: number;
  };
  document: {
    width: number;
    height: number;
  };
  typography: {
    rootFontSize: number;
    bodyFontSize: number;
  };
  environment: PageMetrics["environment"];
  breakpoint: ActiveBreakpoint;
}

export type StableErrorCode =
  | "RESTRICTED_PAGE"
  | "ACCESS_REVOKED"
  | "DOCUMENT_NOT_READY"
  | "INJECTION_FAILED"
  | "NO_ACTIVE_TAB"
  | "BRIDGE_UNAVAILABLE"
  | "INVALID_MESSAGE"
  | "COPY_FAILED"
  | "DOWNLOAD_FAILED"
  | "UNKNOWN";
