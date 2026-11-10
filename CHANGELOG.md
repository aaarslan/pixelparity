# Changelog

All notable PixelParity changes are documented here.

## 3.0.0 — Unreleased

### Added

- Layout tools with toggleable column, square, and baseline grids; configurable
  columns, gutters, margins, maximum width, spacing, color, and opacity
- CSS-pixel rulers and element inspection for bounds, margin, padding, border, gaps,
  font size, and line height, with measurement locking and text export
- Local PNG capture for the viewport, a keyboard-adjustable visible region, and the
  full main document, with preview, copy, save, and discard
- Capture options for including guides and handling fixed/sticky elements
- Serialized capture with cancellation, page-change detection, bounded image/frame
  sizes, and restoration of temporary page changes
- Updated store copy, reviewer instructions, and local website-content disclosures

### Changed

- Renamed the extension to PixelParity — Layout, Grid & Capture
- Expanded the side panel into a focused layout-inspection and documentation toolkit
- Guarded live updates against stale connections and asynchronous completions
- Cleared stale measurements and baselines when access or the document changes
- Avoided rewriting already-migrated preferences whenever a view opens
- Retained the four existing permissions and network-blocking CSP; allowed only local
  image data and Blob previews for capture
- Replaced the archive dependency chain with deterministic packaging using Node's
  built-in compression and CRC32 support
- Updated vulnerable development dependencies and refreshed compatible transitive
  packages; renamed the local audit command to `npm run audit`

### Fixed

- Preserve in-progress numeric input and commit grid values on blur or Enter
- Establish cascade layer priority before importing tool styles
- Account for independent bitmap rounding at fractional capture scales
- Initialize capture on ordinary HTTP pages without secure-context-only UUID APIs

Release qualification, store submission, and publication remain tracked in
[the release checklist](store/release-checklist.md).

## 2.0.0 — 2026-07-18

### Added

- Compact Preact popup with essential viewport, zoom, DPR, and breakpoint metrics
- Tab-scoped live side panel with visibility-aware observation and 10 Hz throttling
- Layout/visual viewport, outer window, scrollbar, screen CSS pixels, rendered-pixel
  estimate, document, typography, and media-environment measurements
- In-memory baseline comparison with live deltas
- PixelParity Classic and Tailwind-style presets plus validated custom profiles
- JSON, CSS custom property, Markdown table, TSV, and local JSON download exports
- System/light/dark themes, two densities, localized manifest strings, and Chrome 116
  minimum version
- WCAG-oriented semantic UI, focus restoration, live regions, forced colors, reduced
  motion, and narrow-width reflow
- Strict TypeScript contracts, Biome, Vitest, Testing Library, axe, Puppeteer E2E,
  reproducible packaging, and dependency audit gates
- Five current store screenshots, two promo images, listing copy, reviewer notes, and a
  captioned demo video

### Changed

- Rebuilt the runtime as separate popup, side-panel, and isolated bridge bundles
- Replaced stored metric caches with memory-only snapshots
- Replaced hard-coded in-popup keyboard shortcuts with Chrome’s assigned action
  shortcut display
- Clarified screen measurements as CSS pixels and separated browser zoom from DPR
- Sharded preference-only profile records to stay below Chrome Sync’s per-item quota
- Reduced the packaged ZIP and switched to an explicit 12-file runtime allowlist
- Regenerated truly square 16, 32, 48, and 128 px icons

### Removed

- Persisted active URL and last-metrics snapshot
- Image-minification dependency chain and runtime HTML/image optimization
- Browser-conflicting Ctrl/Command shortcuts
- Service-worker claims, broad legal assurances, and inaccurate data-retention text
- 256/512 px runtime icons and marketing artwork from the extension package

## 1.0.1 — 2025-08-22

- Corrected browser zoom detection and improved the original popup behavior.
