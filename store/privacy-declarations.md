# Chrome Web Store Privacy Declarations — PixelParity 3.0.0

These declarations describe the v3 source. Dashboard entry and final submission are
tracked separately in [release-checklist.md](release-checklist.md).

## Single purpose

PixelParity helps developers, designers, and QA engineers inspect and document website
layouts through live measurements, alignment guides, element geometry, and local
screenshots of the tab they explicitly invoke.

## Website-content disclosure

PixelParity processes website content locally when the user requests a screenshot.
It also reads computed element layout values for the requested inspection. No data is
sent to the developer or another server. There are no analytics, accounts, tracking,
ads, remote code, or extension network requests.

Declare **Website content** in the dashboard's user-data handling categories. Do not
claim that screenshots involve no use of website content. Google's
[User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
requires disclosure even when data is processed or stored only on the user's device.
The exact dashboard fields should be checked against their displayed definitions.

| Data or practice | Actual behavior |
| --- | --- |
| Website content | Rendered pixels are processed locally on explicit capture; computed layout properties support element inspection. |
| Developer/server collection | None. |
| Automatic upload or sharing | None. Copying and saving happen only through user-selected controls. |
| Browsing-history collection | None. Tab/window identifiers are transient routing context, not a browsing log. |
| Accounts, identifiers, analytics | None. No login or telemetry. |
| Stored preferences | Theme, density, breakpoint profiles, and export format in Chrome Sync; synchronization follows the user's Chrome settings. |
| Stored screenshots or measurements | No persistent extension storage. Previews and measurements remain in memory. |
| Sale or transfer to third parties | None. |
| Use for advertising, credit, or unrelated purposes | None. |
| Remote code | No. All executable code is packaged. |

PNG exports contain the visible content the user chose. Measurement exports exclude
URLs, titles, element text, form values, and browsing history. Saved files and copied
images remain under the user's control after leaving the extension UI.

## Permission justifications

### activeTab

Provides temporary, user-initiated access to the tab on which PixelParity is invoked.
This enables responsive measurements, alignment guides, element inspection, and
explicitly requested screenshots using `captureVisibleTab`, without permanent access
to websites. Chrome revokes the grant on cross-origin navigation or closing the tab.

### scripting

Injects only packaged, isolated page helpers after invocation: `bridge.js` for numeric
metrics, `overlay.js` for grids/rulers and computed element geometry, and
`capture-bridge.js` for visible-region selection, dimensions, temporary page
preparation, scrolling, and cleanup. No remote code or page-script execution is used.

### storage

Saves theme, density, active and custom breakpoint profiles, and preferred measurement
export format. Access is limited to trusted extension contexts. Screenshots,
measurements, baselines, and overlay settings are not written to Chrome storage.

### sidePanel

Displays the tab-scoped inspection tools and local screenshot preview after the user
opens the live inspector from the popup.

## Remote-code declaration

**No, I am not using remote code.**

The extension bundles its executable code and uses `connect-src 'none'`.
`data:` and `blob:` image sources are used solely for local screenshot decoding and
preview. There are no remotely hosted scripts, WebAssembly modules, or telemetry SDKs.

## Limited-use certifications

The extension's behavior supports all three certifications:

- User data is not sold or transferred to third parties.
- User data is used only for the disclosed layout-inspection and capture functionality.
- User data is not used or transferred to determine creditworthiness or for lending.

## Consistency checks before submission

- The public privacy-policy URL resolves to the v3 policy.
- The ZIP, manifest, package metadata, and store description identify version 3.0.0.
- Dashboard disclosure, listing text, and `PRIVACY.md` all explain local website-content
  processing and user-directed exports.
- Only `activeTab`, `scripting`, `storage`, and `sidePanel` appear as permissions.
- No host permissions, externally connectable endpoints, or web-accessible resources
  are present.
- The final package passes the runtime allowlist and network/remote-code checks.
