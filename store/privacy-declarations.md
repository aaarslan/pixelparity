# Chrome Web Store Privacy Declarations — v2.0.0

Use this file as the source of truth when completing the Store Privacy tab.

## Single purpose

PixelParity measures and explains viewport, display, browser zoom, and responsive
breakpoint properties for the tab on which the user explicitly invokes it.

## Data-use declaration

- Collected user data: **No**
- Sold or transferred user data: **No**
- Used for advertising, credit, or unrelated purposes: **No**
- Remote code: **No**
- External network requests: **No**

PixelParity does transiently process browser-exposed display properties on the user’s
device to provide its stated feature. Those metrics are not transmitted or persisted.
The privacy policy discloses this local processing. Page URL, title, content, form
values, history, cookies, and identity are not included in the snapshot model.

Only user-created extension preferences are stored in `chrome.storage.sync`; Chrome
may sync them when the user enables Chrome Sync. The developer does not receive them.

## Permission justifications

### activeTab

Provides temporary, user-initiated access to the active tab so PixelParity can inspect
display metrics without permanent host permissions. Access ends according to Chrome’s
`activeTab` lifecycle.

### scripting

Dynamically injects the packaged `bridge.js` in an isolated world after invocation.
The bridge returns only the whitelisted metric contract and contains no remote code.

### storage

Stores only theme, density, active breakpoint profile, custom breakpoint profiles, and
default export format. Storage access is restricted to trusted extension contexts.

### sidePanel

Opens the persistent live-inspection UI for the invoked tab after the user selects
“Open live inspector” in the popup.

## Certification checks

- The privacy policy link resolves on the public default branch.
- The uploaded ZIP matches version 2.0.0 in both `manifest.json` and `package.json`.
- Dashboard declarations, listing copy, and `PRIVACY.md` use the same language.
- No host permissions, externally connectable endpoints, or web-accessible resources
  are present.
- The ZIP contains no source maps, remote URLs, telemetry SDKs, or marketing images.
