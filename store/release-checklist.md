# PixelParity 3.0.0 Release Checklist

## Release status — November 10, 2026

| Item | Status |
| --- | --- |
| Version and title | 3.0.0 · PixelParity — Layout, Grid & Capture |
| Local code and package checks | **Passed:** formatting, lint, strict types, 150 tests, production build, archive checks, dependency audit |
| Installed-Chrome qualification and visual review | **Blocked in this environment; pending on a machine that can run Chrome extensions** |
| Candidate ZIP | **Built:** 65,100 bytes; 14 runtime files; reproducible |
| Promotional artwork | **Complete:** 440×280 and 1400×560 RGB PNGs, visually reviewed |
| Five v3 product screenshots | **Pending:** installed-extension generator is ready but has not run |
| GitHub source | PR #4 on `feature/pixelparity-3-layout-capture`; runtime qualification remains required before release |
| Public privacy policy on `main` | **Pending merge:** v3 policy is included on the review branch |
| Developer-dashboard updates | **Blocked:** connected browser reports “The extensions gallery cannot be scripted.” |
| Chrome Web Store submission | **Not submitted** |
| Google review / public availability | **Pending submission** |

Preparing the source, package, listing, or artwork is not confirmation of submission.
The current public store version observed during this task was 2.0.0; the repository
started at 2.1.0. No production store package or listing was changed.

## Completed local evidence

- [x] `npm run check` passed with the final production source.
- [x] Formatting and lint completed without findings.
- [x] Strict TypeScript checking passed.
- [x] 150 unit/component tests passed across 14 files, including structural accessibility
  checks. Browser color contrast and rendered layouts remain unverified.
- [x] PR #4 regression checks passed for numeric editing, fractional bitmap scaling,
  and HTTP-compatible capture initialization. The bundled CSS establishes cascade
  layer order before component styles.
- [x] Quantized-scroll regressions passed through geometry and the capture client.
  Source-coordinate labels check complete pixel coverage without duplicates, gaps,
  shifted content, rescaling, or scrollbar pixels. Cases include fractional/high DPR,
  measured outer edges, long pages, document changes, and failure cleanup. These
  tests use simulated browser responses; installed-Chrome capture remains unverified.
- [x] Profiles control insets, action spacing, narrow-name wrapping, and native theme
  handling reviewed in source. Rendered visual qualification remains pending.
- [x] Production build and runtime allowlist verification passed.
- [x] `npm audit --audit-level=high` reported **0 vulnerabilities** at all severities.
- [x] Consecutive `node scripts/pack.mjs` runs produced identical bytes.
- [x] Independent Python ZIP inspection verified CRCs, sorted entries, root manifest,
  fixed timestamps, file modes, version, permissions, CSP, and the 150 KiB size limit.
- [x] `git diff --check` passed.
- [x] Asset generators passed syntax and Biome checks.
- [x] The local interface workbench passed HTTP smoke checks; its browser rendering
  remains unverified.
- [x] Repository-level GitHub Actions was disabled and the old workflow removed.

| Evidence | Value |
| --- | --- |
| Package | `builds/pixelparity-3.0.0.zip` |
| SHA-256 | `9209207e7ab418df4590566949b6c0144e7db905eac2cd0906b16ee78584060b` |
| Archive size | 65,100 bytes |
| Uncompressed runtime | 189,981 bytes across 14 files |
| Source commit | Recorded by PR #4 and the downloadable release kit's `release-manifest.json` |
| Node | 24.22.1 |
| OS | Linux x86_64; Debian 13 runtime; glibc 2.41 |
| Available Chromium | 156.0.8078.79; installed-extension test launch did not complete |
| Puppeteer | 25.17.0; use its compatible Chrome for Testing on the qualification machine |

The executor prevented Chromium from opening a required Unix-domain socket. Native
UI control was unavailable, and the cloud browser could not reach the executor's
loopback preview. These limitations do not establish browser compatibility or visual
quality. No installed-extension E2E or successful capture API result is claimed.
The browser URL policy also blocked the isolated Profiles spacing preview; no new
visual verification is claimed for that screen.

## Remaining qualification

Run from the review branch on a machine with a usable Chrome for Testing:

```bash
npm ci
npm run check
npm run test:e2e
npm run assets:store
```

The E2E command supports `PIXELPARITY_HEADLESS=1`; the store asset generator uses a
headed browser. `PUPPETEER_EXECUTABLE_PATH` can select a compatible installed browser.
The screenshot generator stops if native viewport dimensions or real UI states cannot
be verified. It has no mocked screenshot fallback.

- [ ] Run the packaged-extension E2E journey and record Chrome/OS/version evidence.
- [ ] Confirm live viewport/zoom/DPR, profiles, baseline comparison, and exports.
- [ ] Check all grid types, settings, rulers, element locking, Escape, and teardown.
- [ ] Check viewport, region, and full-page PNGs, preview, copy, save, and discard.
- [ ] Capture odd-sized, scrollbar-free and scrollbar-visible pages at 80%, 100%,
  125%, and 150% zoom. Check horizontal and vertical tile joins, final image edges,
  and restoration of a nonzero starting scroll position. Inspect the PNG for missing
  or repeated strips; the local tests simulate browser responses and do not replace
  this installed-Chrome check.
- [ ] Check cancellation, tab/navigation/zoom changes, limits, and scroll/style restoration.
- [ ] Review narrow and wider panels in light/dark themes, visible focus, keyboard
  behavior, contrast, reduced motion, and forced colors.
- [ ] Confirm no extension-originated HTTP(S) requests or screenshot/measurement writes
  to persistent Chrome storage during the installed runtime journey.
- [ ] Review all five generated 1280×800 screenshots and their provenance manifest.
- [ ] Merge the verified source so the public privacy-policy URL serves the v3 policy.

Static packaging checks already confirm exactly `activeTab`, `scripting`, `storage`,
and `sidePanel`; no permanent host access, service worker, remote executable code,
or additional permissions were introduced. The CSP blocks extension network access.

## Store update

- [ ] Use existing item **`nobkjipoljcbnldmicopkjkbinggcipa`** under
  **arslan.abdallah@gmail.com**.
- [ ] Upload the qualified `pixelparity-3.0.0.zip` in the Package tab.
- [ ] Apply `listing.md`: title, summary, full description, category, and links.
- [ ] Upload the 128×128 icon and five actual 1280×800 screenshots in the stated order.
- [ ] Upload the reviewed optional 440×280 tile and 1400×560 marquee.
- [ ] Replace the old screenshots; remove the old v2 demo if attached. Archived v2
  artwork in `store/archive/v2` is reference material only.
- [ ] Apply `privacy-declarations.md`, including local website-content processing and
  permission justifications; verify the live dashboard's field definitions.
- [ ] Verify public privacy/support URLs, reviewer instructions, and contact details.
- [ ] Preserve existing distribution settings.
- [ ] Submit the completed update for review and record the observed confirmation.
- [ ] Record submission time and automatic versus deferred publication choice.
- [ ] Verify the live version after approval and publication.

## Submission record

| Evidence | Value |
| --- | --- |
| Package/listing saved in dashboard | Not performed |
| Submission timestamp | Not submitted |
| Google review status | No submission confirmation |
| Live v3 availability | Not published |

No rollback was needed: the published package was not changed. For a regression
after a future publication, use the dashboard's available rollback control or submit
a corrected higher version, then verify the resulting status.
