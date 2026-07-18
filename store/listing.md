# Chrome Web Store Listing — PixelParity 2.0

## Identity

Title: **PixelParity — Viewport & Display Metrics**

Summary: **Inspect live viewport, screen, browser zoom, pixel ratio, visual viewport,
and responsive breakpoints—locally and on demand.**

Category: **Developer Tools**

Language: **English**

## Detailed description

PixelParity gives front-end developers, designers, and QA engineers a precise view of
the browser dimensions that drive responsive layouts. Open the compact popup for an
instant snapshot, then move into a tab-scoped side panel when you need to watch values
change live.

FEATURES

• See layout and visual viewports, Chrome tab zoom, device pixel ratio, outer-window
size, scrollbar size, and rendered-pixel estimates.  
• Inspect screen and available-screen dimensions in CSS pixels, orientation, color
depth, document extent, root/body typography, and media capabilities.  
• Track resize, zoom, orientation, and document-size changes in a live side panel.  
• Capture one memory-only baseline and compare live numeric deltas.  
• Use PixelParity Classic or Tailwind-style breakpoints, or create validated profiles
for your own design system.  
• Copy versioned JSON, CSS custom properties, Markdown tables, or TSV; download JSON
without a downloads permission.

PRIVACY

PixelParity works locally and only after you invoke it. It has no accounts, telemetry,
analytics, ads, tracking, external requests, or remote code. Measurements and
baselines are never persisted. Exports exclude page URLs, titles, content, and browsing
history. Only extension preferences may sync through Chrome Sync.

PERMISSIONS

• activeTab: temporary access to the tab you explicitly inspect.  
• scripting: injects the bundled isolated measurement bridge into that tab.  
• storage: saves theme, density, breakpoint, and export preferences only.  
• sidePanel: opens the live inspector from the popup.

HOW TO USE

1. Open a normal website and select PixelParity in the toolbar.  
2. Read the essential snapshot or copy it in your preferred format.  
3. Select “Open live inspector” for live updates, baselines, profiles, and exports.

LIMITATIONS

Chrome does not allow extensions to inspect protected browser pages, the Chrome Web
Store, or some built-in viewers. Cross-origin navigation ends the temporary tab grant;
PixelParity shows a reconnect state instead of requesting permanent website access.
Screen values are browser-exposed CSS pixels, not physical monitor specifications.

Support: https://github.com/aaarslan/pixelparity/issues  
Privacy policy: https://github.com/aaarslan/pixelparity/blob/main/PRIVACY.md

## Visual asset order and captions

1. `assets/screenshots/01-quick-metrics.png` — Know the viewport in one click.
2. `assets/screenshots/02-live-inspector.png` — Watch responsive changes live.
3. `assets/screenshots/03-zoom-dpr-visual-viewport.png` — Separate zoom, DPR, and
   visual scale.
4. `assets/screenshots/04-breakpoint-profiles.png` — Match your product’s breakpoints.
5. `assets/screenshots/05-baseline-and-exports.png` — Compare and share without page
   data.

Small promo tile: `assets/promos/small-tile-440x280.png`  
Marquee: `assets/promos/marquee-1400x560.png`  
Captioned demo: `demo/pixelparity-v2-demo.mp4`
