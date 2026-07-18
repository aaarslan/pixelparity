# PixelParity Privacy Policy

Last updated: July 18, 2026

Applies to: PixelParity 2.0.0 and later

PixelParity is a local, account-free Chrome extension for inspecting viewport,
display, zoom, and responsive-layout measurements. It has no analytics, telemetry,
advertising, tracking, external APIs, or developer-operated servers.

## What PixelParity processes

After you explicitly invoke PixelParity on a tab, the extension temporarily reads
browser-exposed display properties from that tab:

- Layout and visual viewport dimensions, offset, and visual scale
- Outer-window and scrollbar dimensions
- Screen and available-screen dimensions in CSS pixels
- Device pixel ratio, color depth, orientation, and document extent
- Root and body font sizes
- Color scheme, reduced-motion, forced-colors, pointer, hover, and color-gamut media
  capabilities
- The current tab’s browser zoom through Chrome’s Tabs API

This processing occurs on your device only so the popup and side panel can show the
requested measurements. PixelParity does not read or include the page URL, page title,
page content, form values, browsing history, cookies, or account identity in a
measurement snapshot.

## What PixelParity stores

Live measurements and comparison baselines are held only in the memory of the open
popup or side panel. They are not written to Chrome storage and disappear when that
extension view closes. A baseline also clears when the inspected page navigates.

PixelParity stores only these preferences in `chrome.storage.sync`:

- Theme: system, light, or dark
- Display density: comfortable or compact
- Active breakpoint profile
- Up to 10 custom breakpoint profiles
- Default export format

Chrome may sync these preferences between browsers signed into the same Google
account when Chrome Sync is enabled. That synchronization is operated by Google under
the user’s Chrome settings; the PixelParity developer does not receive the synced
values or a user identity. Storage access is restricted to trusted extension pages,
not the injected measurement bridge.

When upgrading from v1, PixelParity deletes the obsolete local metrics cache,
including any URL previously stored there, and removes the old preference keys. The
migration does not transmit that value.

## Data collection and transmission

PixelParity does not collect, sell, share, or transmit user data. The extension makes
no network requests. All JavaScript, CSS, HTML, and image files execute from the
installed package under a Content Security Policy that blocks network connections and
remote code.

Exports are created only when you select a copy or download control. JSON, CSS,
Markdown, and TSV output contain measurements and breakpoint context only. They never
include a URL, title, page content, or browsing history. Clipboard and downloaded Blob
contents remain under your control.

## Permission purposes

- `activeTab` provides temporary access to the tab on which you invoke the extension.
  Chrome revokes that access on a cross-origin navigation or when the tab closes.
- `scripting` injects the packaged, isolated measurement bridge after that explicit
  invocation.
- `storage` saves only the preferences listed above.
- `sidePanel` opens the tab-scoped live inspector when you select its popup button.

PixelParity requests no permanent website access and no host, browsing-history,
identity, clipboard, downloads, debugger, or externally connectable permission.

## Retention and control

You can change saved preferences in the popup and remove all extension data by
uninstalling PixelParity. Chrome Sync controls, including whether extension settings
sync between browsers, are available in Chrome’s own sync settings. PixelParity has no
server-side record to access or delete.

## Changes and contact

Material changes to this policy will be versioned with the source and reflected in an
extension update before new handling begins.

For privacy questions, contact **arslan.abdallah@gmail.com** or open an issue at
[github.com/aaarslan/pixelparity/issues](https://github.com/aaarslan/pixelparity/issues).
Security reports should follow [SECURITY.md](SECURITY.md).
