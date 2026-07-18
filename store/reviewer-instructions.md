# Chrome Web Store Reviewer Instructions — PixelParity 2.0.0

PixelParity requires no account, sign-in, server, payment, or configuration.

## Primary review flow

1. Open a normal HTTPS website.
2. Select the PixelParity toolbar action.
3. Confirm the popup shows layout viewport, Chrome browser zoom, device pixel ratio,
   active breakpoint, and expandable metric groups.
4. Select **Copy snapshot** and confirm the live-region success feedback.
5. Select **Open live inspector**. The side panel should show a green **Live** state
   and remain bound to the invoked tab.
6. Resize the browser window. Layout and visual viewport values should update within
   approximately 100 ms, subject to browser rendering.
7. Change the tab zoom to 125%. The Browser zoom card should show 125%; it remains
   distinct from device pixel ratio and visual-viewport scale.
8. Select **Set baseline**, resize again, and confirm numeric deltas appear. Navigate
   to a different origin and confirm the baseline clears and a reconnect state appears.

## Breakpoints and exports

1. Open the **Breakpoints** section.
2. Switch between PixelParity Classic and Tailwind-style.
3. Create a custom profile. Duplicate labels, fractional/negative widths, and
   non-increasing values should be rejected. A profile supports up to 12 points; the
   extension stores up to 10 custom profiles.
4. Open **Export** and copy JSON, CSS variables, Markdown, and TSV.
5. Download JSON. This uses an in-page Blob and does not require the `downloads`
   permission.
6. Confirm output contains measurements and breakpoint context but no URL, title, page
   content, or history.

## Protected-page state

Open `chrome://settings` or the Chrome Web Store and invoke PixelParity. Chrome blocks
script injection on these surfaces; the popup should show **This page is protected**
without requesting additional access.

## Migration

When updated from v1.0.1, v2 maps the prior theme and compact-mode preferences,
selects PixelParity Classic, and deletes the obsolete local last-metrics object and old
keys. The migration is idempotent and covered by automated tests.

## Permission and network notes

The manifest contains exactly `activeTab`, `scripting`, `storage`, and `sidePanel`.
There is no service worker, host permission, remote code, external request, telemetry,
or persisted measurement. The page bridge is injected only following user invocation
and stops observing when the panel is hidden, disconnected, or destroyed by navigation.
