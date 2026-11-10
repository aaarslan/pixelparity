# Chrome Web Store Listing — PixelParity 3.0.0

## Identity

| Field | Value |
| --- | --- |
| Existing item ID | `nobkjipoljcbnldmicopkjkbinggcipa` |
| Title | PixelParity — Layout, Grid & Capture |
| Summary | Inspect responsive layouts, overlay grids and rulers, measure elements, and capture screenshots. Local tools. No telemetry. |
| Category | Developer Tools |
| Language | English |
| Support | https://github.com/aaarslan/pixelparity/issues |
| Privacy policy | https://github.com/aaarslan/pixelparity/blob/main/PRIVACY.md |
| Developer contact | arslan.abdallah@gmail.com |

Title and summary must match the packaged English manifest messages. Update the
existing listing; preserve its item ID and installed user base.

## Detailed description

PixelParity brings layout inspection, visual alignment guides, and screenshots into
one focused toolkit for frontend developers, designers, and QA engineers.

Know the viewport. Check the grid. Capture the evidence.

Open the compact popup for an instant measurement, then use the live side panel beside
your website while you inspect, compare, and document the layout.

LAYOUT TOOLS

• Toggle column, square, and baseline grid overlays directly on the page.
• Adjust columns, gutters, margins, maximum width, spacing, color, and opacity.
• Add CSS-pixel rulers to check alignment and coordinates.
• Inspect element bounds, margin, padding, border, gaps, font size, and line height.
• Click an element to hold its measurement, then copy the layout details.

LOCAL SCREENSHOTS

• Capture the visible viewport, select a visible region, or capture the full main
  document.
• Preview your PNG before copying it or saving it to your device.
• Include or hide PixelParity guides in the capture.
• Choose sticky/fixed-element handling for full-page capture.
• Cancel at any time; capture restores its temporary page changes.

RESPONSIVE INSPECTION

• Watch layout and visual viewport dimensions, browser zoom, device pixel ratio,
  document size, screen dimensions, and typography.
• Keep one baseline in memory and compare numeric changes as you resize.
• Use PixelParity Classic, Tailwind-style, or custom breakpoint profiles.
• Copy JSON, CSS variables, Markdown tables, TSV, or an issue-ready comparison;
  download measurement JSON locally.
• Choose light, dark, or system appearance and comfortable or compact spacing.

PRIVACY

No accounts. No telemetry, analytics, tracking, ads, remote code, or extension network
requests.

PixelParity processes measurements and screenshots locally after you invoke it.
Screenshots contain the visible website content you choose, stay in memory for
preview, and are never uploaded by the extension. You control any copied images and
saved files.

Measurement exports exclude page URLs, titles, element text, form values, and browsing
history. Only extension preferences, including breakpoint profiles, may sync through
Chrome Sync. Measurements, overlays, and screenshots are not synchronized.

GET STARTED

1. Open a website and select PixelParity in the Chrome toolbar.
2. Select “Open live inspector.”
3. Use Inspect for live measurements, Layout for alignment guides, Capture for PNGs,
   Profiles for breakpoint profiles, and Export for shareable measurements.

PERMISSIONS

• activeTab: temporary access to the tab you invoke, including requested screenshots.
• scripting: packaged, isolated page helpers for measurements, guides, and capture.
• storage: extension preferences only.
• sidePanel: the live toolkit beside your page.

PRACTICAL LIMITS

Chrome protects browser pages, the Web Store, and some built-in viewers. Invoke the
toolbar action again after navigating to another origin. Full-page capture handles the
main document; nested scrollers, virtualized lists, animation, and lazy loading can
affect results. Capture is limited to 48 megapixels, 32,760 pixels per dimension, and
40 frames. Keep the page, tab, window, and zoom unchanged while capturing.

Requires Chrome 116 or newer.

Support: https://github.com/aaarslan/pixelparity/issues
Privacy policy: https://github.com/aaarslan/pixelparity/blob/main/PRIVACY.md

## Screenshot order

Each screenshot must show the actual extension at 1280×800, with square corners and
no added padding.

| Order | File | Focus |
| --- | --- | --- |
| 1 | `assets/screenshots/01-inspect.png` | Read responsive layout measurements live |
| 2 | `assets/screenshots/02-layout-grid.png` | Align a real page with configurable columns |
| 3 | `assets/screenshots/03-element-inspection.png` | Check element dimensions and spacing |
| 4 | `assets/screenshots/04-capture.png` | Preview a local PNG capture |
| 5 | `assets/screenshots/05-compare-export.png` | Compare a baseline and export useful evidence |

Store icon: `../assets/icons/icon128.png`
Small promotional tile: `assets/promos/small-tile-440x280.png`
Marquee: `assets/promos/marquee-1400x560.png`

Do not attach the old v2 demo as a demonstration of the v3 feature set. A new video is
optional; screenshots and the current package are the release assets.
