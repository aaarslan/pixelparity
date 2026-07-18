# PixelParity — Viewport & Display Metrics

[![Version](https://img.shields.io/badge/version-2.0.0-2563eb)](CHANGELOG.md)
[![Manifest](https://img.shields.io/badge/Manifest-V3-0f766e)](manifest.json)
[![License](https://img.shields.io/badge/license-MIT-15803d)](LICENSE)

PixelParity is a privacy-first Chrome extension for inspecting viewport, display,
browser zoom, and responsive-layout metrics. It provides a compact one-click
snapshot and a tab-scoped live side panel without permanent website access.

[Install PixelParity from the Chrome Web Store](https://chromewebstore.google.com/detail/pixelparity-precision-dis/nobkjipoljcbnldmicopkjkbinggcipa)

## What v2 includes

- Compact popup with layout viewport, authoritative Chrome tab zoom, device pixel
  ratio, and active breakpoint
- Live side panel for resize, visual-viewport, orientation, document-size, and zoom
  changes
- Layout and visual viewport, outer window, scrollbar, screen and available screen
  in CSS pixels, document extent, typography, display, and media-environment metrics
- In-memory baseline comparison with live numeric deltas
- PixelParity Classic and Tailwind-style presets plus up to 10 synced custom
  profiles with 12 breakpoints each
- Versioned JSON, CSS custom property, Markdown table, and TSV exports
- Light, dark, and system themes; comfortable and compact densities
- Keyboard-accessible controls, visible focus, live status announcements,
  forced-colors support, and reduced-motion behavior
- No accounts, telemetry, analytics, external requests, remote code, page metadata,
  or persisted measurements

Element rulers, page overlays, screenshots, device emulation, and automatic window
resizing are intentionally outside the extension’s single purpose.

## Install for development

PixelParity 2.0 requires Chrome 116 or newer and Node.js 22.12 or newer for local
development.

```bash
npm ci
npm run build
```

Then open `chrome://extensions`, enable Developer mode, choose **Load unpacked**,
and select the generated `dist` directory. Do not load the repository root.

## Use PixelParity

1. Open a normal website.
2. Select PixelParity in the toolbar or use the assigned extension shortcut.
3. Read the essential snapshot in the popup.
4. Select **Open live inspector** for live updates, breakpoints, baselines, and
   exports.

The popup reads the shortcut Chrome actually assigned through `commands.getAll()`.
If Chrome leaves the shortcut unassigned because of a conflict, PixelParity says so
instead of displaying a hard-coded key combination.

## Permissions

The manifest declares exactly four permissions:

- `activeTab` — grants temporary access to the current tab only after explicit
  invocation
- `scripting` — injects the bundled, isolated measurement bridge into that tab
- `storage` — saves preferences only in `chrome.storage.sync`
- `sidePanel` — opens the live inspector for the invoked tab

There are no host, `tabs`, clipboard, downloads, debugger, externally connectable,
or web-accessible-resource permissions. The JSON download uses a user-created Blob,
and clipboard writes occur only from extension UI actions.

See [PRIVACY.md](PRIVACY.md) for the complete data-handling disclosure.

## Architecture

```text
src/
├── bridge/          # Isolated, dynamically injected page-measurement bridge
├── components/      # Shared Preact presentation components
├── popup/           # One-shot popup controller and UI
├── shared/          # Contracts, breakpoints, storage, serializers, errors
├── sidepanel/       # Live connection, baselines, profiles, and exports
├── popup.html
├── sidepanel.html
└── styles.css
```

The popup injects `bridge.js` after the toolbar invocation, requests one whitelisted
measurement object, and merges it with `chrome.tabs.getZoom()`. The side panel opens
from the popup’s button, connects to the same temporary bridge, and starts observation
only while visible. Resize and media events are throttled to at most 10 updates per
second. Closing or hiding the panel stops observers; navigation destroys the bridge
and clears any in-memory baseline.

No background service worker is required. The strict extension CSP allows only
bundled scripts and styles and blocks all network connections.

## Data model and storage

`MetricsSnapshotV2` stores numeric measurement values and derived breakpoint context.
It has no URL, title, page-content, or history field. Measurements and baselines remain
in extension-page memory only.

`PreferencesV2` contains theme, density, active breakpoint profile, custom profiles,
and default export format. It is the only kind of data saved in
`chrome.storage.sync`, so Chrome may sync it between signed-in browsers when Chrome
Sync is enabled. PixelParity stores a small preference index and one bounded record
per custom profile so the full 10-profile limit stays below
[Chrome Sync’s 8 KiB per-item quota](https://developer.chrome.com/docs/extensions/reference/api/storage#storage-areas).

The idempotent v1 migration maps theme and compact mode, defaults existing users to
PixelParity Classic, and deletes the old `pixelparity_last_metrics` cache without
reading its stored value.

## Validation and packaging

```bash
npm run format:check     # Biome formatting
npm run lint             # Biome lint and unsafe-HTML gate
npm run typecheck        # Strict TypeScript
npm test                 # Unit, component, keyboard, live-region, and axe tests
npm run build            # Explicit production runtime allowlist
npm run test:e2e         # Real packaged-extension Chrome flow
npm run build:pack       # Reproducible, version-matched ZIP
npm run audit:ci         # Fails on high or critical dependency findings
```

The final ZIP contains 12 allowlisted runtime files, has fixed entry timestamps and
ordering, excludes source maps and store artwork, and fails above 150 KiB. Store
screenshots and promos are generated from the shipping Preact components with
`npm run assets:store`; the captioned demo is generated with
`npm run assets:demo`.

CI runs formatting, linting, type checking, unit/component/accessibility tests,
package verification, dependency auditing, reproducibility checks, and packaged
extension E2E on Linux, macOS, and Windows.

## Limitations

- Chrome blocks injection on `chrome://` pages, the Chrome Web Store, and other
  protected browser surfaces.
- A cross-origin navigation revokes the temporary `activeTab` grant. The side panel
  shows a reconnect state; it never asks for permanent host access.
- Screen values are browser-exposed CSS pixels, not claims about a monitor’s physical
  hardware resolution.
- Browser zoom and device pixel ratio are separate inputs and may both affect the
  rendered-pixel estimate.

## Project material

- [Changelog](CHANGELOG.md)
- [Privacy policy](PRIVACY.md)
- [Security policy](SECURITY.md)
- [Store listing copy](store/listing.md)
- [Reviewer instructions](store/reviewer-instructions.md)
- [Release checklist](store/release-checklist.md)

PixelParity is available under the [MIT License](LICENSE). Issues and feature requests
belong in the [GitHub issue tracker](https://github.com/aaarslan/pixelparity/issues).
