# PixelParity 3.0.0 Release Checklist

## Current publication status — verified November 16, 2026

Version 3.0.0 is publicly available under a new item ID. The November 13 conclusion
that v3 was unpublished was incomplete: it described the recorded draft session
and the legacy item, not the separate live v3 listing. Use this section for current
status; the dated records below are retained as historical evidence.

| Public field | Canonical v3 listing | Legacy v2 listing |
| --- | --- | --- |
| Item ID | `imkeldjbndhihjcniafdolkhcfbkglfd` | `nobkjipoljcbnldmicopkjkbinggcipa` |
| Title | PixelParity — Layout, Grid & Capture | PixelParity — Viewport & Display Metrics |
| Version | 3.0.0 | 2.1.0 |
| Store update date | November 11, 2026 | September 12, 2026 |
| Offered by | aaarslan | aaarslan |
| Developer contact | arslan.abdallah@gmail.com | arslan.abdallah@gmail.com |
| Category / language | Developer Tools / English | Developer Tools / English |
| Feature scope | Layout grids, rulers, element inspection, local screenshots, responsive metrics | Viewport/display metrics, baselines, breakpoint profiles, measurement exports |
| Store privacy disclosure | Handles website content | Declares no data collection |
| Support / privacy links | Repository issues / `main/PRIVACY.md` | Repository issues / `main/PRIVACY.md` |

Sources, fetched directly from the public pages on November 16, 2026:

- [v3 public listing](https://chromewebstore.google.com/detail/pixelparity-%E2%80%94-layout-grid/imkeldjbndhihjcniafdolkhcfbkglfd?hl=en)
- [Legacy public listing](https://chromewebstore.google.com/detail/pixelparity-%E2%80%94-viewport-di/nobkjipoljcbnldmicopkjkbinggcipa?hl=en)
- [Repository metadata](https://api.github.com/repos/aaarslan/pixelparity): `homepage`
  points to `https://chromewebstore.google.com/detail/imkeldjbndhihjcniafdolkhcfbkglfd`.

The new ID is the canonical **v3 documentation and installation target** because
it serves v3 and matches the repository homepage. The matching public developer
identity supports attribution to this project; it does not establish why a second
item was created. Intentional separate distribution versus an accidental duplicate
remains unconfirmed. These are distinct installations; legacy users must not be
promised automatic migration or preference transfer to the new ID.

### Publication evidence versus qualification evidence

- **Verified:** both listings are public with the versions and details above.
- **Unknown:** submission time, review history, first-publication time, distribution
  settings, and the published package's exact source commit and archive checksum.
  A store update date is not an observed submission confirmation. No dashboard was
  inspected or changed for this reconciliation.
- **Still incomplete in the recorded evidence:** full installed-extension
  qualification and the planned five-image set. The later Mac record contains a
  partial review and three screenshots; no new runtime or screenshot checks were
  performed here. Public availability does not complete these checks.
- **Historical only:** the 65,100-byte candidate ZIP and SHA-256 below identify the
  locally verified artifact. They have not been matched to the live store package.

Before any store mutation, show the owner the exact proposed action and obtain
explicit approval. This includes deleting either item, changing distribution
settings, or submitting another package. Do not upload to the legacy item merely
because the historical plan below named it.

## Historical reconciliation — November 13, 2026 (publication conclusion superseded)

The following record is preserved as written. Its unpublished/draft conclusion
is superseded by the November 16 public-listing verification above; it is not the
current publication status or an instruction to submit v3 again.

The November 10 record below describes the original Linux audit. Later Mac work
partially advanced the release; it did not complete every qualification item.

| Item | Reconciled status |
| --- | --- |
| Public source and privacy policy | PR #4 merged as `014e0ce`; version 3 source and `PRIVACY.md` are on `main`. |
| Installed extension | Later Mac session installed version 3 and captured its Inspect, Layout, and Capture surfaces. This is partial qualification, not a completed cross-platform E2E checklist. |
| Product screenshots | Three 1280×800 PNGs exist in the local release kit: `01-inspect`, `02-layout`, and `03-capture`. The planned five-image set is incomplete. |
| Developer dashboard | Later Mac session saved a **new listing draft**, ready for submission. This does not update the existing public listing. |
| Version 3 submission / publication | **Not submitted; not published.** |
| Existing public listing | Version **2.1.0**, updated September 12, 2026; checked November 13. The earlier 2.0.0 observation below is historical. |

Evidence: `main` at `014e0ce`; the local `pixelparity-3.0.0-release-kit`
archive and screenshot files; and the recorded later Mac installation/dashboard
session. The ZIP remains 65,100 bytes with SHA-256
`9209207e7ab418df4590566949b6c0144e7db905eac2cd0906b16ee78584060b`.
The kit's `release-manifest.json` and original checklist retain their earlier Linux
snapshot (including blocked browser checks); they are not evidence that the later
Mac work completed the full checklist. No new extension execution or store
submission was performed for this documentation reconciliation.

[Existing public store listing](https://chromewebstore.google.com/detail/nobkjipoljcbnldmicopkjkbinggcipa).
Before release, complete and record the outstanding qualification matrix, finish
the planned screenshot set, and reconcile the intended new-versus-existing listing
path. Submission and publication require separate confirmation.

## Original Linux audit — November 10, 2026

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

These checks remain open despite public availability. Run from `main` on a machine
with a usable Chrome for Testing, and record the tested commit and package identity:

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
- [x] Merge the source and v3 privacy policy: PR #4 merged as `014e0ce`.

Static packaging checks already confirm exactly `activeTab`, `scripting`, `storage`,
and `sidePanel`; no permanent host access, service worker, remote executable code,
or additional permissions were introduced. The CSP blocks extension network access.

## Historical store-update plan — target superseded

This was the original plan to update the legacy item. It was not evidence of
execution. The separate v3 item is now public; do not execute this plan without
first reconciling the intended target and obtaining explicit owner approval for
the exact proposed store action.

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

## Original Linux submission record — November 10, 2026 (historical)

This table records the original session only. It does not describe current public
availability; see the November 16 verification above.

| Evidence | Value |
| --- | --- |
| Package/listing saved in dashboard | Not performed |
| Submission timestamp | Not submitted |
| Google review status | No submission confirmation |
| Live v3 availability | Not published |

No rollback was needed: the published package was not changed. For a regression
after a future publication, use the dashboard's available rollback control or submit
a corrected higher version, then verify the resulting status.
