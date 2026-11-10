# Chrome Web Store Reviewer Instructions — PixelParity 3.0.0

PixelParity requires Chrome 116 or newer. No account, sign-in, server, payment, or API
key is needed. Its single purpose is to inspect and document website layout.

## Live measurements

1. Open a normal HTTPS website and invoke PixelParity from the Chrome toolbar.
2. Confirm the popup shows viewport dimensions, browser zoom, DPR, and a breakpoint.
3. Select **Open live inspector**. The panel remains attached to that invoked tab.
4. Resize the browser and change the page zoom to 125%. Inspect updates for viewport
   dimensions and Chrome's zoom value.
5. Set a baseline, resize again, and inspect numeric differences.

## Grids, rulers, and element inspection

1. Open **Layout** and enable the grid overlay.
2. Switch between column, square, and baseline grids. Change columns/gutter/margins or
   spacing as appropriate; adjust opacity/color and verify the guides update.
3. Enable rulers. Check that grid and ruler modes still allow normal page clicks.
4. Enable element inspection, hover an element, then click it to hold its measurement.
5. Review bounds, margin, padding, borders, gaps, font size, and line height. Copy the
   measurement and verify it contains layout values and the tag name, without page
   URL, element text, attributes, or form values.
6. Press Escape to exit picking, then Escape again to clear remaining guides. Controls
   in the panel can also disable the tools.

## Screenshot workflow

Use an ordinary page with a scrollable main document. Keep its tab, browser window,
size, and zoom unchanged during capture.

1. Open **Capture** and capture the visible viewport.
2. Inspect the PNG preview and save it. Try the image-copy control with the panel in
   focus; clipboard availability follows Chrome's user-interaction rules.
3. Select a visible region. Drag to size it, or use arrows to move and Shift + arrows
   to resize. Enter captures; Escape cancels.
4. Capture the full main document. Verify scrolling completes and the page returns to
   its prior position. Compare sticky/fixed-element handling with the option toggled.
   Repeat at 125% zoom on a page without scrollbar gutters and inspect the joins
   between captured sections and the final right/bottom edges.
5. Enable a grid and compare capture with PixelParity overlays included versus hidden.
6. Start a full-page capture and cancel it. Confirm temporary styles/selection UI are
   removed and page interaction resumes.
7. Switching tab, navigating, changing viewport/zoom, or changing the focused window
   during capture should stop the job rather than silently capturing another page.
8. Discard the preview. Screenshots are never uploaded or stored in Chrome storage.

Captures are limited to 48 megapixels, 32,760 pixels per dimension, and 40 frames.
Nested scrolling containers, virtualized or dynamically growing content, and
horizontally scrolling right-to-left documents may require viewport/region capture.
Pinch zoom is not supported for capture.

## Profiles and exports

1. In **Profiles**, switch between PixelParity Classic and Tailwind-style, then
   create a custom profile. Duplicate labels, fractional/negative widths, and
   non-increasing widths should be rejected.
2. In **Export**, copy JSON, CSS variables, Markdown, TSV, and an issue-ready comparison.
3. Download JSON. These measurement exports contain no page URL, title, element text,
   form values, or history. PNG capture is separately labeled and contains website
   pixels by design.
4. Change theme or density, reopen the extension, and confirm preferences remain.

## Access and cleanup

- Invoke PixelParity on `chrome://settings` or the Chrome Web Store. The popup should
  explain that Chrome protects the page, without requesting permanent access.
- Navigate the inspected tab to a different origin. Live measurements/baseline should
  clear; invoke the toolbar action again to restore temporary access.
- Closing the panel ends its live sessions, removes overlay controls, cancels capture,
  and releases screenshot previews. Files already saved remain on the user's device.

## Privacy and permissions

The manifest declares only `activeTab`, `scripting`, `storage`, and `sidePanel`.
No background service worker, host access, `tabs`, `downloads`, clipboard, or debugger
permission is required. The package includes every executable resource and blocks
network connections with its CSP.

Website content is processed locally for screenshots; it is not sent to the developer
or any server. Only ordinary preferences use Chrome Sync. Measurements, baselines,
overlay settings, and screenshots do not persist in extension storage.

The older preference format is migrated while deleting the obsolete metrics cache.
Existing valid preferences are preserved.
