# Edge and OneDrive sync — implementation handoff

Status (2026-10-29): OneDrive code+PKCE authentication, separate provider UI and automatic bidirectional synchronization are implemented in candidate 2.13.0. Real Chrome/Edge sign-in, note/edit round trips, conflicts, deletion, token refresh, reload and disconnect passed in isolated profiles. Local tests passed; packaging and GitHub CI are release gates. No Store submission has been made for this feature. Google Drive web authentication in Edge remains unimplemented; native Google Drive in Chrome is preserved.

## OneDrive implementation now in the branch

- Uses the owner's Microsoft client ID and the exact two configured SPA callbacks; no embedded secret and no TabNotes server.
- Connect requests only the two optional Microsoft login/Graph origins under the existing optional HTTPS declaration.
- Tokens stay local with trusted-context-only access; scope/state/callback/PKCE checks, refresh and late-disconnect invalidation have tests.
- UI has explicit Connect, Sync now, Reconnect and Disconnect in EN/ES. Error states do not claim a successful sync. One provider per profile is enforced without silently disconnecting the other.
- Each profile writes `tabnotes-<random-device-uuid>.json` in the app folder. Other profiles never overwrite that file, avoiding a shared-file lost-update race. Existing merge/conflict/tombstone rules are reused without changing Google Drive's file or note schema.
- All remote snapshots are bounded and validated before local merge. No upload is attempted on an invalid/missing-permission/network read. Writes are not replayed after an ambiguous failure.
- A snapshot retains its own deletion ledger on upload failure. Local language/theme/scope/project preferences are not overwritten by remote profiles.
- OneDrive deletion markers do not expire: inactive profile files persist and would otherwise resurrect old deleted notes. The existing Google Drive 90-day default and wire schema are unchanged. Snapshot size and marker-count bounds still apply.
- Automatic sync runs after local changes and at five-minute browser-alarm intervals, while the browser is running. Microsoft session expiry can require reconnect; do not promise unattended permanent login.
- Existing 2.12.2 desktop release ZIP is untouched.

## Approved product behavior

- Keep native Google Drive authentication in Chrome unchanged.
- Add Google Drive authentication in Edge using a separately validated `identity.launchWebAuthFlow` integration.
- Add a separate **Connect OneDrive** button with bidirectional automatic synchronization, not just uploads or manual restore.
- Explicit connection and consent are required. Do not detect a Microsoft account and silently enable uploads.
- Initial implementation allows one active cloud provider per profile to avoid introducing two-cloud synchronization loops. The UI asks the user to disconnect the current provider explicitly; no automatic switch or deletion of either provider's remote files or local notes. Connecting a provider is not a cloud-to-cloud migration.
- Local notes and manual backups work without either provider. No TabNotes server, telemetry or secret embedded in the extension.

## Completed first step

- Detect Edge using its User-Agent Client Hints brand or Edge user-agent token, since it can expose an API that rejects every call.
- Avoid `getAuthToken` and native cache refresh calls on Edge. Return a localizable setup status instead of the browser's opaque unsupported-API error.
- Keep Chrome's existing login, refresh and disconnect logic and all storage/backup formats.
- No provider connection, cloud writes, note migration, manifest/permission change, version bump or new release package in this step.

## Owner configuration required before end-to-end implementation

### Public configuration confirmed by owner — 2026-10-29

- Google project name: `TabNotes`; project ID: `tabnotes-499922`.
- Existing Google client name/type: `TabNotesDrive`, Chrome Extension. Client ID matches the one below; associated Store extension ID is `pniapenkdphjolncppcichbahomfiffj`. Leave it unchanged.
- Microsoft application name: `TabNotes`; Application (client) ID: `5ec63453-0f1c-418e-b29b-4f47ea912f4b`.
- Owner screenshots show Microsoft supported accounts `All Microsoft account users`; delegated `Files.ReadWrite.AppFolder` and `User.Read` configured. Both SPA callbacks were added and shown in the owner's final screenshot. Real sign-in subsequently completed in both test profiles. No client secret requested.
- Native Chrome 156 and Edge 156, in fresh ephemeral profiles with the local dist, both returned the same `chrome.identity.getRedirectURL('onedrive')`: `https://noabjgjemigfaimfahmbnlccibmkmaam.chromiumapp.org/onedrive`. This is the verified local-build callback, not a production identity.
- Expected callback for the existing Chrome Web Store identity (including that same Store package installed in Edge): `https://pniapenkdphjolncppcichbahomfiffj.chromiumapp.org/onedrive`. This is derived from the known Store ID and browser callback pattern; reverify in the actual Store installation before production signoff. A separate Edge Add-ons identity would require another callback.
- Both callbacks are configured as SPA redirects for the code+PKCE pilot, without implicit-flow checkboxes or a client secret. Token exchange from the worker succeeded in real Chrome and Edge. SPA refresh tokens have a 24-hour lifetime; handle renewal/reconnection explicitly and do not promise permanent unattended login.
- Browser diagnostic only: no cloud login, token retrieval or remote writes. Both temporary browser contexts were closed after inspection.

### Google

1. Identify the Google Cloud project that owns the existing Chrome OAuth client:
   `770771238390-p2lkbe0j4vk2ihco2s50dhd9dq956en0.apps.googleusercontent.com`.
2. Prepare a compatible public-client/web authorization registration for the Edge identity flow in that same project. Validate the exact client type, supported grant and token-renewal behavior with Google; do not assume that a Web application client can redeem codes without a secret just because PKCE is enabled.
3. Record the actual runtime extension ID and `chrome.identity.getRedirectURL()` in the intended distribution (Chrome Web Store installation in Edge versus a separate Edge Add-ons package). Register exact authorized callbacks where required; never use a wildcard.
4. Retain only `https://www.googleapis.com/auth/drive.appdata` unless a separately justified scope is required. Verify access to an existing **synthetic** Chrome backup before claiming cross-browser compatibility. A different application's app-data folder is not a transferable backup location.
5. Never replace or delete the working Chrome client. Do not add a client secret to source, Vite configuration or distributed files. If the chosen registration requires a backend to hold a secret, stop and resolve that design with the owner rather than violating the local-first requirement.

Needed from the owner: project name/ID, compatible public client ID if a new one is necessary, and confirmation of the approved callback. No passwords, tokens or client secrets in chat.

### Microsoft OneDrive

1. In Microsoft Entra → App registrations, create/reuse an application owned by the publisher, e.g. `TabNotes`.
2. Support both personal Microsoft accounts and organizational accounts if available for the publisher's tenant. Organizational tenants can impose administrator-consent policies; do not promise universal access that bypasses those policies.
3. Use authorization code + PKCE for a public client; confirm the SPA/public-client platform and Origin/CORS handling with the real extension in the pilot before finalizing redirects. No client secret in the extension.
4. Register exact callbacks returned by `chrome.identity.getRedirectURL()` for the approved Chrome and Edge extension identities. Do not invent a production ID for unpacked builds.
5. Request delegated Microsoft Graph `Files.ReadWrite.AppFolder`, and `offline_access` for token renewal. Do not request `Files.ReadWrite.All` or application-only permissions. Verify the scope with both a personal and a work/school test account.
6. Supply the Application (client) ID and supported account types/tenant setting. This ID is public configuration, not a secret.

## Implementation order once configuration is available

1. Pilot Google web-auth in Edge with a synthetic account; validate callback origin/path, cryptographic state, rejected/cancelled consent, scope, expiration, account identity and renewal after browser/service-worker restart. Avoid falling back from arbitrary Chrome auth errors to another provider/account.
2. Pilot Microsoft public-client PKCE auth: exact callback, state, verifier, refresh-token rotation, cancellation and disconnect. Keep credentials out of notes, manual exports, remote backup files, logs and UI message responses. Restrict persisted credentials to trusted extension contexts. Never allow late token responses to reconnect after disconnect.
3. Add a minimal OneDrive transport using Graph v1.0 and the app folder. Read/validate before writing. The implemented design uses separate single-writer profile snapshots instead of a shared file requiring conditional writes; never overwrite another profile's remote backup. Treat corruption or permission/network errors differently from a genuinely absent file.
4. Reuse the tested merge/conflict/tombstone rules in `packages/shared/src/sync.ts` without changing the existing Drive wire format. Keep provider file IDs, accounts, sync checkpoints, alarms and credentials separate. Avoid duplicating the full Drive engine or a sweeping rewrite before proving one full sync round trip.
5. Implement two-way automatic sync on local changes and a periodic browser alarm. Restore reminders after remote merges. Ensure disconnect stops queued/in-flight writes, expired authorization cannot open sign-in windows from alarms, and first connection never replaces existing notes without a safe merge.
6. Add the separate bilingual OneDrive UI only when it can connect. Show connected provider, last successful sync, retry/reconnect and disconnect. Retain the warning that cloud sync is not end-to-end encrypted by default; do not present OneDrive's app folder as hidden or inaccessible to the user.
7. Update permission justifications and privacy docs for actual Microsoft endpoints before packaging. Do not grant broad required host access or change existing Google permissions to make a prototype pass.

## Release gates

- Chrome Drive login, sync and restore unchanged; synthetic legacy/manual/encrypted backups still round-trip.
- Edge notes, editor, screenshot/crop, manual backup and sidebar verified in a fresh profile.
- Real Google Edge login, silent renewal, reconnect and access to existing synthetic Chrome backup.
- Real OneDrive Chrome↔Edge sync: new notes, edits, deletion, same-note conflicts, encrypted notes, images, expired login, network failures and restart.
- Concurrent remote changes remain in separate single-writer snapshots and produce conflict copies rather than lost updates.
- Reject corrupt backups and wrong-account/wrong-provider file identifiers; disconnect never deletes local notes or cloud files.
- Unit/E2E/type/lint/build gates pass. Version/metadata/changelog/Store disclosure updated only for the implementation actually delivered.
- Keep the existing desktop `TabNotes-2.12.2-final.zip` untouched until a genuinely verified replacement is ready.

## First-step validation — 2026-10-29

- Branch `codex/edge-cloud-auth`, based on the existing 2.12.2 source. Version and published/package metadata deliberately unchanged: this is not a new release.
- 225 unit tests passed (shared 147, extension 69, web 8, i18n 1).
- Lint, typecheck, full build, modified-file formatting, release metadata and repository hygiene passed.
- Native Chrome isolated E2E selection: four passed (setup-safe Drive settings, manual backup round trip, autosave and encrypted history/editing).
- Native Edge isolated E2E selection: settings (including bilingual unsupported-auth explanation), manual backup round trip and autosave passed. Encrypted-history test initially failed at the existing helper's saved-note lookup; its isolated rerun passed (19 seconds). This is recorded as a test instability, not a fully clean first-run Edge suite. No test assertion was weakened or skipped.
- No Google/Microsoft account login, remote backup operation, provider registration, broad permission grant, Store upload or ZIP replacement performed.
- No OneDrive UI placeholder or fake client ID added. Full implementation remains gated on the owner configuration above.

## Primary references

- [Edge supported APIs](https://learn.microsoft.com/en-us/microsoft-edge/extensions/developer-guide/api-support)
- [Extension identity and web-auth callbacks](https://developer.chrome.com/docs/extensions/reference/api/identity)
- [Google OAuth for installed/public clients](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Google client-side token flow](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow)
- [Google Drive app-data isolation](https://developers.google.com/workspace/drive/api/guides/appdata)
- [Register a Microsoft application](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
- [Microsoft code flow and PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
- [OneDrive app folder and permissions](https://learn.microsoft.com/en-us/graph/onedrive-sharepoint-appfolder)
