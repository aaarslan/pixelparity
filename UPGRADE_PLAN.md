# PixelParity 3.0: inspect, align, capture

## Product decision

Make PixelParity a focused toolkit for inspecting and documenting website layout.
Preserve the fast viewport popup, live metrics, breakpoint profiles, baseline
comparison, and developer exports. Add visual alignment and screenshot tools
inside the existing tab-scoped side panel.

## Release scope

1. **Inspect:** live viewport, zoom, DPR, breakpoint range, and clear overflow
   signals. Make disconnected states and stale measurements unambiguous.
2. **Layout:** optional column, square, and baseline grids; adjustable spacing,
   gutters, margins, color, and opacity; rulers; element geometry and computed
   spacing. Overlays start off and disappear when their session ends.
3. **Capture:** visible viewport, selected visible area, and bounded full-page PNG
   capture. Show a local preview, save/copy/discard actions, progress, and Cancel.
   Restore page position and temporary styling on success or failure.
4. **Preserve:** validated custom breakpoint profiles, in-memory comparisons,
   JSON/CSS/Markdown/TSV exports, light/dark themes, and keyboard accessibility.
5. **Release:** refresh the name, description, screenshots, promotional images,
   privacy disclosure, and reviewer instructions; produce a deterministic ZIP;
   update the existing Chrome Web Store item and submit for review when dashboard
   access permits.

## Privacy and architecture

- Keep exactly `activeTab`, `scripting`, `storage`, and `sidePanel` permissions.
- Keep all executable code bundled and `connect-src 'none'` in the extension CSP.
- No accounts, analytics, telemetry, advertising, uploads, or developer servers.
- Process screenshots and element geometry in memory after an explicit action.
  Never send image bytes back to page scripts or write them to extension storage.
- Existing display/profile/export preferences may use Chrome Sync. Page metrics,
  baselines, screenshots, and inspected page content must not sync.
- Use isolated content scripts and validated messages. Keep overlays out of normal
  page layout, with clean teardown and Escape support.
- Own capture in the side panel. Serialize jobs, rate-limit captures, validate tab
  and document identity, bound canvas size and tile count, and recover abandoned
  page preparations through disconnect handling and a watchdog.

## Screen-capture integration decision

Reuse the supplied prototype's full-page/region workflow and actual-scroll geometry.
Rebuild its capture engine rather than importing its unbounded tile accumulation,
unreliable service-worker download path, or unnecessary downloads permission.
Full-page capture targets the main document. Nested scrolling, virtualized lists,
moving content, and uncaptured lazy-loaded sections are documented limitations.

## Local qualification

- Formatting, lint, strict TypeScript, unit/component/accessibility checks.
- Real packaged-extension browser flows for metrics, overlays, element inspection,
  screenshot geometry, cancellation, navigation, tab switching, and cleanup.
- Inspect actual UI at narrow and wider side-panel sizes in light and dark themes.
- Audit dependencies and final package; check permissions, CSP, allowlisted files,
  no network behavior, and reproducible archive bytes.
- Generate store screenshots from the built extension on a controlled local page.
- Remove the existing GitHub Actions workflow. Do not add or run hosted CI.

## Official documentation reviewed before implementation

- [Extensions overview](https://developer.chrome.com/docs/extensions)
- [Active tab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [Tabs and screenshot limits](https://developer.chrome.com/docs/extensions/reference/api/tabs)
- [Side panels](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- [User-data handling, including local screenshots](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Store images](https://developer.chrome.com/docs/webstore/images)
- [Updating a published item](https://developer.chrome.com/docs/webstore/update)

Reviewed November 10, 2026. The release status and actual validation results belong
in `store/release-checklist.md`; this plan does not claim that submission occurred.
