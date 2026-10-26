# TabNotes security best-practices review

## Executive summary

The phase 7 review found no unresolved critical or high-severity issue after the fixes below. The most important finding was an HTML injection risk in the PDF/print export path; it is now mitigated with centralized escaping and a regression test. Optional page access remains a deliberate privacy-sensitive capability and is now limited to HTTP(S), requested per site, and disclosed in the release documentation.

## Scope

- Chrome MV3 extension runtime, side panel, background service worker, content scripts, Drive sync, import/export, and rich-text/Markdown rendering.
- Release metadata, permissions documentation, build artifact generation, and public privacy/store material.
- Companion web app was checked for shared Markdown/sanitization usage; server-side infrastructure and Google account configuration are out of scope.

## Findings

### SBP-001 — PDF export HTML injection — Fixed

- Rule ID: REACT-XSS-001 / REACT-DOM-001
- Severity: High before fix; resolved in this review
- Location: `apps/extension/src/sidepanel/hooks/useNoteActions.ts:171-189`, `packages/shared/src/sanitize.ts:90-102`
- Evidence: PDF export creates an HTML document from note title, current domain, and tags, then opens it in a new tab/window. Those fields are now passed through `escapeHtml`; note body content is passed through `renderMarkdown`, which ends in `sanitizeHtml`.
- Impact: Before the fix, crafted title/domain/tag values could become markup in the generated print document and potentially execute in the extension-created document context.
- Fix: Centralized HTML escaping for generated documents; added coverage in `packages/shared/src/sanitize.test.ts:4-8`.
- Mitigation: Keep export output as a generated Blob/document and do not reintroduce raw interpolation of user-controlled fields.
- False positive notes: The remaining `dangerouslySetInnerHTML` sinks are fed by `renderMarkdown`/`sanitizeHtml`; they should remain covered by sanitizer regression tests.

### SBP-002 — Broad optional page access — Mitigated and documented

- Rule ID: REACT-PERM-001 (extension permission minimization)
- Severity: Medium
- Location: `apps/extension/public/manifest.json:54-67`, `apps/extension/src/sidepanel/SidePanelApp.tsx:870-902`
- Evidence: Capture features need `scripting` and optional host access. The manifest now uses `http://*/*` and `https://*/*` as optional patterns; the side panel requests only the active page origin and only after an explicit clip action.
- Impact: A user who enables a capture feature grants page access for that site. Overly broad or undocumented access would increase privacy impact and Store-review risk.
- Fix: Removed `<all_urls>`, restricted patterns to HTTP(S), used per-origin permission requests, and updated privacy/store/security documentation.
- Mitigation: Verify in stable Chrome that permission prompts appear only on the active site and that disabling the floating button removes the site permission.
- False positive notes: The permission is not required or granted by default; the Chrome Web Store permission disclosure still needs to match the uploaded manifest.

### SBP-003 — Rich-text HTML sinks — Controlled, regression-sensitive

- Rule ID: REACT-XSS-001 / REACT-MARKUP-001
- Severity: Medium residual risk
- Location: `packages/shared/src/markdown.ts:11-72`, `packages/shared/src/sanitize.ts:133-183`, `apps/extension/src/sidepanel/views/EditorView.tsx:554-610`
- Evidence: Preview and editor hydration use `renderMarkdown`/`sanitizeHtml`; pasted HTML is sanitized before insertion, and screenshots are restricted to local image data URLs.
- Impact: A future feature that bypasses the shared sanitizer could turn stored note content or clipped page content into stored XSS inside the privileged side panel.
- Fix: No additional code change required in this phase; the existing sanitizer remains the single HTML boundary.
- Mitigation: Keep sanitizer tests for scripts, event handlers, dangerous URLs, styles, remote images, and task markup; review any new HTML sink against this boundary.
- False positive notes: The direct `innerHTML` assignments are either sanitized editor hydration or DOM parsing of already-sanitized paste content.

### SBP-004 — Drive backup is plaintext by default — Accepted and disclosed

- Rule ID: REACT-DATA-001
- Severity: Medium privacy impact, not an injection defect
- Location: `PRIVACY_POLICY.md`, `store/privacy-policy.md`, and the Drive sync implementation under `apps/extension/src/background/driveSync.ts`.
- Evidence: The product clearly states that Drive sync stores notes as locally stored unless the user encrypts notes or uses an encrypted manual backup first.
- Impact: Anyone with access to the user's Google account/app data can read the synced backup contents.
- Fix: No silent behavior change in this release; the limitation is explicit in product UI and public policy.
- Mitigation: Keep encryption available and make the warning visible before first sync; manually verify the warning and encrypted-note flow before release.
- False positive notes: This is an intentional product trade-off, not end-to-end encryption.

## Validation

- Shared typecheck: passed.
- Shared tests: 141 passed.
- Extension typecheck: passed.
- Extension tests: 38 passed.
- Repository lint: passed.
- Full build: passed.
- Release metadata and repository hygiene: passed for version 2.12.0.
- Extension E2E: 33 passed, 2 skipped by documented headless limitations.

## Release follow-up

The remaining security-sensitive step is manual stable-Chrome validation of permission prompts, selection clipping, floating-button injection/removal, restricted pages, and the PDF export payload. The generated artifact is `store/tabnotes-extension-v2.12.0.zip` and is intentionally ignored by Git until the release is published.
