# PixelParity 2.0 Release Checklist

## Source and package

- [ ] Release from the corrected v2 branch with a clean working tree.
- [ ] Public default branch contains the same source, privacy policy, and listing copy.
- [ ] `manifest.json`, `package.json`, changelog, ZIP name, and listing all say 2.0.0.
- [ ] `npm ci && npm run check` passes.
- [ ] A second `npm run pack` produces a byte-identical ZIP.
- [ ] ZIP is below 150 KiB and contains exactly the verified 12-file allowlist.
- [ ] Dependency audit reports zero high or critical findings.
- [ ] Retain the signed v1 package in the Store dashboard for rollback.

## Manual Chrome Stable matrix

- [ ] macOS: popup, live panel, zoom 100%/125%, DPR 1/2 where available, profiles,
  baseline, all exports, protected page, keyboard-only flow, 200% UI zoom.
- [ ] Windows: same flow on Chrome Stable.
- [ ] Linux: same flow on Chrome Stable.
- [ ] Forced-colors check on Windows and reduced-motion check on at least one OS.
- [ ] Cross-origin navigation clears the baseline and shows reconnect.
- [ ] Switching tabs does not inspect a tab that was not explicitly invoked.
- [ ] Browser network log shows no extension-originated HTTP(S) requests.

Automated packaged-extension E2E runs headlessly on Linux, macOS, and Windows in CI,
but the manual Stable checks above remain release sign-off gates.

## Store dashboard

- [ ] Update the existing item ID `nobkjipoljcbnldmicopkjkbinggcipa`; do not create a
  duplicate listing.
- [ ] Paste title, summary, description, and category from `listing.md`.
- [ ] Upload the four square icons, five current 1280×800 screenshots, 440×280 tile,
  1400×560 marquee, and captioned demo.
- [ ] Complete Privacy tab from `privacy-declarations.md`.
- [ ] Verify the public privacy-policy URL resolves and matches the dashboard text.
- [ ] Paste reviewer steps from `reviewer-instructions.md`.
- [ ] Confirm developer/support email is `arslan.abdallah@gmail.com`.

## Publish and rollback

- [ ] Upload `builds/pixelparity-2.0.0.zip` and complete reviewer preview.
- [ ] Publish directly only after source, QA, privacy, and asset sign-off.
- [ ] Record the uploaded ZIP SHA-256 and submission timestamp.
- [ ] If a blocking regression appears, use the retained v1 dashboard package while a
  corrected v2 is reviewed.
- [ ] Monitor aggregate Chrome Web Store analytics and GitHub support issues only; do
  not add in-extension analytics.
