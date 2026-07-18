# Chrome Web Store Privacy Declarations — v2.0.0

Use this file as the source of truth when completing the Store Privacy tab.

Dashboard target: update the existing public item
`nobkjipoljcbnldmicopkjkbinggcipa`. Do not create or upload to a second item.

## Single purpose

PixelParity provides on-demand viewport, display, browser zoom, device pixel ratio,
visual viewport, document-size, media-environment, and responsive-breakpoint
diagnostics for the tab the user explicitly inspects.

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

Provides temporary, user-initiated access to the active tab so PixelParity can read
browser-exposed viewport and display measurements without permanent host permissions.
Access is requested only when the user opens PixelParity and ends according to
Chrome’s `activeTab` lifecycle.

### scripting

Injects the packaged `bridge.js` measurement script into the invoked tab’s isolated
world after explicit user activation. The bridge returns only the whitelisted metrics
contract. It does not read page content, URLs, form values, cookies, or history, and it
does not load remote code.

### storage

Stores only user preferences—theme, density, active breakpoint profile, custom
breakpoint profiles, and default export format—in `chrome.storage.sync`. Live metrics,
baselines, URLs, titles, and page content are never stored. Chrome may sync preferences
when the user enables Chrome Sync; the developer does not receive them.

### sidePanel

Opens PixelParity’s tab-scoped live inspector after the user selects “Open live
inspector” in the popup. The side panel displays live measurements, breakpoint tools,
in-memory baseline comparison, and local exports for the invoked tab.

## Remote code

Select **No, I am not using remote code**.

If the dashboard or reviewer asks for supporting detail, use:

> PixelParity does not use remote code. All JavaScript, CSS, HTML, and images are
> bundled in the submitted package. The extension uses no eval-like execution, remote
> scripts, WebAssembly, external APIs, telemetry, or network requests; its content
> security policy sets `connect-src 'none'`.

## Certification checks

The dashboard certification is a developer attestation. Review the saved disclosures
and privacy policy before certifying or submitting the item for review.

- The privacy policy link resolves on the public default branch.
- The uploaded ZIP matches version 2.0.0 in both `manifest.json` and `package.json`.
- Dashboard declarations, listing copy, and `PRIVACY.md` use the same language.
- No host permissions, externally connectable endpoints, or web-accessible resources
  are present.
- The ZIP contains no source maps, remote URLs, telemetry SDKs, or marketing images.
