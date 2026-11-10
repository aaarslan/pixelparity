# PixelParity Privacy Policy

Last updated: November 10, 2026

Applies to: PixelParity 3.0.0

PixelParity helps you inspect and document website layouts. It has no accounts,
analytics, telemetry, advertising, tracking, external APIs, or developer-operated
servers. The extension's processing happens locally on your device, after you invoke
it for a tab.

## What PixelParity processes

| Feature | Information processed locally |
| --- | --- |
| Viewport inspection | Layout and visual viewport dimensions, browser zoom, DPR, screen dimensions, document size, typography, and browser-exposed media capabilities |
| Grids and rulers | Viewport/scroll coordinates and your selected guide settings |
| Element inspection | The selected element's tag name, rectangle, and computed layout values, including margin, padding, border, gaps, font size, and line height |
| Screenshots | Rendered website content from the viewport, selected visible region, or scrolled main document that you choose to capture |

Screenshots are a form of website-content processing even though they never leave
your device through PixelParity. They contain whatever is visibly rendered in the
chosen capture. Full-page capture temporarily scrolls the page and may adjust
sticky/fixed elements according to your selected option; the capture helper restores
its changes when capture completes or stops.

Measurement records and their text exports do not include page URLs, page titles,
element text, form values, cookies, browsing history, or account identity. PixelParity
does not read cookies, authentication tokens, or browser history. It uses transient
tab/window identifiers to keep its tools attached to the page you invoked.

## What is stored and for how long

**Measurements and baselines** remain in the memory of the open extension view.
They are not written to Chrome storage. Closing the view clears its memory. Loading
another document in the inspected tab or losing the page connection clears its current
measurements and comparison baseline.

**Overlay settings and element measurements** belong to the current tool session.
They are not saved to Chrome storage or synchronized. Ending the session removes the
page overlays and releases its state.

**Screenshots** are held in the side panel's memory for preview and export. They are
not written to extension storage or sent to any server. Discarding a preview,
replacing it with another capture, or closing the panel releases that preview. Files
you choose to save and images you copy to the clipboard remain under your control;
closing PixelParity does not delete them.

**Extension preferences** are saved in `chrome.storage.sync`:

- System, light, or dark theme
- Comfortable or compact density
- Active breakpoint profile and up to 10 custom profiles
- Preferred measurement export format

Google may synchronize these preferences between signed-in browsers when Chrome Sync
is enabled. This follows your Chrome settings and Google's services. The PixelParity
developer does not receive the preferences or your account identity. Storage access is
restricted to trusted extension contexts rather than injected page helpers.

The migration from older PixelParity versions removes the obsolete last-metrics cache
and old preference keys. It does not upload their contents.

## Transmission, sharing, and exports

PixelParity does not send data to its developer, advertisers, analytics providers, or
other servers. It does not sell data or use it for advertising, lending, or unrelated
purposes. The extension makes no network requests and includes all executable code in
its installed package. Its extension Content Security Policy blocks network
connections with `connect-src 'none'`.

Copy and save operations happen only when you select their controls. JSON, CSS,
Markdown, TSV, and element-measurement exports contain the measurements described
above. PNG exports contain the website image you requested. There is no automatic
upload, cloud gallery, or sharing service. You decide where exported data goes next.

## Why these permissions are needed

| Permission | Purpose |
| --- | --- |
| `activeTab` | Temporary, user-initiated access to inspect and capture the selected tab |
| `scripting` | Inject packaged, isolated helpers for measurements, overlays, region selection, and capture preparation |
| `storage` | Store only the extension preferences listed above |
| `sidePanel` | Display live tools and screenshot previews beside the inspected page |

PixelParity requests no permanent host access, browsing-history, identity, `tabs`,
clipboard, downloads, or debugger permission. Chrome ends the temporary website grant
on cross-origin navigation or when the tab closes.

PixelParity’s use of data obtained through Chrome APIs complies with the Chrome Web
Store User Data Policy, including its Limited Use requirements.

## Your controls

Turn off guides or end element picking in the Layout tools. Cancel an active capture
or discard its preview. Close the panel to release its in-memory data. Change saved
preferences through PixelParity's settings, and use Chrome's settings to control
extension-preference synchronization. Uninstalling PixelParity removes its extension
storage. There is no developer-held record to request or delete.

## Changes and contact

Changes to data handling are documented in this policy alongside the corresponding
extension release.

For privacy questions, contact **arslan.abdallah@gmail.com**. For a security concern,
follow the private reporting guidance in [SECURITY.md](SECURITY.md).
