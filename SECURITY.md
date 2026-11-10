# Security Policy

## Supported versions

Security fixes are developed on the default branch and included in the next release.
Use the latest published Chrome Web Store version. Older versions do not receive
separate backports.

## Report a vulnerability

Email **arslan.abdallah@gmail.com** privately with:

- The affected PixelParity and Chrome versions
- Reproduction steps or a minimal proof of concept
- The observed impact and any suggested mitigation

Please avoid posting exploitable details in public issues before a fix is available.
This project does not operate a paid bug-bounty program.

## Security design

PixelParity uses Manifest V3 and four permissions: `activeTab`, `scripting`, `storage`,
and `sidePanel`. It has no permanent host permissions, externally connectable entry
points, remote code, or extension network requests.

Page helpers run in isolated worlds after user invocation. Their message contracts
are validated; captured image data stays in the extension UI. Element inspection reads
bounded computed layout properties without collecting text, identifiers, form values,
or a DOM dump. Page-derived values are rendered as text.

Capture is serialized, rate-limited, bounded in dimensions and frame count, and
cancelled when its tab, page, window, viewport, or zoom changes. Capture cleanup
restores temporary page styles and scrolling. It does not use the debugger or
permanent website access.

Preferences use trusted-context-only storage. Measurements, baseline comparisons,
layout-tool settings, and screenshot previews remain in memory. The extension CSP
blocks remote connections and scripts; local `data:` and `blob:` images support
screenshot previews.

Local verification covers type checking, formatting, linting, behavioral tests,
packaged Chrome flows, package contents, and dependency auditing. See
[the release checklist](store/release-checklist.md) for the recorded status of a release.
