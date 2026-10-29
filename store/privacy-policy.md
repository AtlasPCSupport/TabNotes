# TabNotes Privacy Policy

**Effective date:** October 29, 2026

## The one-line version

TabNotes collects zero data. Your notes stay local unless you export them or explicitly enable
Google Drive or OneDrive sync. Sync transfers data directly to your chosen provider, not to TabNotes.

## Data storage

Notes, workspaces, tags, and settings are stored exclusively in:

- **chrome.storage.local** (extension) — sandboxed to your browser, on your device
- **IndexedDB** (web app) — stored in your browser for that origin only

No data is transmitted to a TabNotes server. TabNotes works offline by default.

Password-protected backup exports are encrypted. Local browser storage and optional cloud sync are not end-to-end encrypted by default.

## Optional Google Drive sync

If enabled, TabNotes uses Chrome identity and the Google Drive `drive.appdata` scope to store JSON
sync data in your private Google Drive app data folder. Sync data travels directly between TabNotes
and Google Drive; the TabNotes developer cannot access it.

Drive sync is not end-to-end encrypted by default. Notes are uploaded as stored locally. Use
per-note encryption or an encrypted manual backup before syncing sensitive content.

## Optional OneDrive sync

OneDrive uses Microsoft authorization code + PKCE and delegated `Files.ReadWrite.AppFolder`,
with access only to the app folder. Each connected browser profile writes a separate JSON snapshot
and merges notes, workspaces, history and deletion markers from other profiles. The folder is
visible to you. Cloud sync is not end-to-end encrypted by default; encrypt sensitive notes first.
An encrypted manual export does not encrypt other cloud-synced notes automatically.

Microsoft access/refresh tokens are stored locally with trusted-extension-context access only and
are never included in notes, manual exports or cloud backups. Authorization can expire or be revoked.
Disconnect removes local Microsoft tokens and stops sync without deleting local notes or cloud files.
One provider can be enabled per profile. Switching does not migrate files between providers.

## Permissions

| Permission                                                             | Why                                                                                                                   |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `storage`                                                              | Save notes locally on your device                                                                                     |
| `unlimitedStorage`                                                     | Support local-first note collections that may grow over time                                                          |
| `tabs`                                                                 | Read the current tab URL to link notes contextually                                                                   |
| `activeTab`                                                            | Access the current tab URL when the panel is open                                                                     |
| `sidePanel`                                                            | Display the notes panel alongside browser content                                                                     |
| `contextMenus`                                                         | Let users clip selected text into notes from the browser context menu                                                 |
| `identity`                                                             | Optional Google or Microsoft authorization for the chosen cloud provider                                              |
| `offscreen`                                                            | Play local reminder audio when a reminder fires                                                                       |
| `alarms`                                                               | Sync debounce, reminders, and scheduled notifications                                                                 |
| `notifications`                                                        | User reminders and daily digest                                                                                       |
| `scripting`                                                            | Reads a selection after clipping or injects the optional floating capture button                                      |
| `http://*/*`, `https://*/*`                                            | Optional per-site capture access; Microsoft login/Graph access requested only when connecting OneDrive                |
| `https://www.googleapis.com/*`                                         | Optional Google Drive sync API calls                                                                                  |
| `https://login.microsoftonline.com/*`, `https://graph.microsoft.com/*` | Optional sites for Microsoft authorization, token renewal and OneDrive app-folder sync, requested on Connect OneDrive |

## No analytics, no tracking

TabNotes contains no analytics, telemetry, crash reporting, advertising SDKs, or tracking of any
kind. Google or Microsoft cloud sync is contacted only if you enable that provider.

## Open source

Every line of code is public: https://github.com/AtlasPCSupport/TabNotes

## Contact

Open an issue at: https://github.com/AtlasPCSupport/TabNotes/issues
