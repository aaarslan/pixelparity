# Changelog

All notable PixelParity changes are documented here.

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
  cross-platform CI, reproducible packaging, and dependency audit gates
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
