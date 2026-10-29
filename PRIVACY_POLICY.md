# Privacy Policy — TabNotes

**Last updated: October 29, 2026**

## Overview

TabNotes is a local-first browser extension with a companion web app. By default, your notes stay
on your device. If you choose Google Drive or OneDrive sync, TabNotes sends sync data directly
to your account with that provider. No cloud sync is enabled automatically.

## Data We Collect

**We collect no data.**

TabNotes does not collect, store, sell, or share personal information, browsing data, or note
content with the TabNotes developer or any TabNotes server.

## How Your Data Is Stored

Notes, workspaces, tags, and settings are stored locally on your device:

- `chrome.storage.local` for the extension
- IndexedDB for the companion web app, scoped to that web origin

This data never leaves your device unless you export it or explicitly enable cloud sync. It is never
sent to a TabNotes server and is never used for analytics, advertising, or profiling.

## Optional Google Drive Sync

If you connect Google Drive, TabNotes uses Chrome's `identity` API and the Google Drive
`drive.appdata` scope to create or update a JSON sync file in your private Google Drive
`appDataFolder`.

When enabled:

- Notes sync directly between TabNotes and Google Drive.
- The sync file is stored in your Google account, not on TabNotes infrastructure.
- The file is hidden from normal "My Drive" view by Google Drive.
- Drive sync is not end-to-end encrypted by default; notes are uploaded as stored locally.
- For sensitive content, use per-note encryption or an encrypted manual backup before syncing.
- TabNotes does not persist your Google access token in extension storage.
- You can disconnect Google Drive at any time.

## Optional OneDrive Sync

If you connect OneDrive, the extension uses Microsoft OAuth authorization code with PKCE and
delegated `Files.ReadWrite.AppFolder` access. It requests access to Microsoft login and Graph
sites only when you click Connect OneDrive. Notes, tags, workspaces, history and deletion markers
travel directly to/from the TabNotes app folder in your OneDrive. Each browser profile writes
its own JSON snapshot and combines snapshots from other connected profiles. The folder is
visible to you in OneDrive; it is not a hidden or end-to-end-encrypted vault.

Microsoft access and refresh tokens are stored locally, restricted to trusted extension contexts,
for automatic synchronization while the browser runs. They are excluded from note backups,
exports and cloud snapshot files. Expired or revoked authorization may require reconnection.
Disconnect stops future synchronization and removes local Microsoft tokens; it does not delete
local notes or remote files. You can delete the app folder or revoke access through Microsoft.
Only one provider can be enabled per profile; changing providers does not migrate cloud files.

Cloud sync is not end-to-end encrypted by default. Encrypt sensitive notes before connecting.
An encrypted manual export protects that export, not otherwise-unencrypted notes in cloud sync.

## Permissions Used

| Permission                                                             | Why it's needed                                                                                                                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                                              | Save notes locally on your device                                                                                                                             |
| `unlimitedStorage`                                                     | Support local-first note collections that may grow beyond standard storage quotas                                                                             |
| `tabs`                                                                 | Read the current tab's URL to link notes to the right page                                                                                                    |
| `activeTab`                                                            | Access the active tab's URL when the panel is open                                                                                                            |
| `sidePanel`                                                            | Display the notes panel alongside browser content                                                                                                             |
| `contextMenus`                                                         | Add "Clip selection to TabNotes" when the user selects text and opens the context menu                                                                        |
| `identity`                                                             | Optional Google sign-in and Microsoft authorization for the chosen cloud provider                                                                             |
| `offscreen`                                                            | Play local reminder audio when a note reminder fires                                                                                                          |
| `alarms`                                                               | Schedule reminders and periodic Drive sync checks                                                                                                             |
| `notifications`                                                        | Show reminders and daily digest notifications                                                                                                                 |
| `scripting`                                                            | Read a user-selected page selection or inject the optional floating capture button                                                                            |
| `http://*/*`, `https://*/*`                                            | Optional per-site capture access; Microsoft login/Graph access requested only on OneDrive connection                                                          |
| `https://www.googleapis.com/*`                                         | Optional Google Drive sync API calls                                                                                                                          |
| `https://login.microsoftonline.com/*`, `https://graph.microsoft.com/*` | Optional origins requested on OneDrive connection, covered by the optional HTTPS host declaration; Microsoft authorization, token renewal and app-folder sync |

No permission is used for data collection or tracking.

## Export & Import

Export downloads your notes as a JSON file directly to your device. That file never passes through
a TabNotes server. Import reads a local file that you choose from your device.

## Third-Party Services

TabNotes does not use third-party analytics, crash reporting, advertising, telemetry, or tracking
services. Google Drive or Microsoft services are contacted for cloud sync only after you opt in.

## Children's Privacy

TabNotes does not collect information from anyone, including children.

## Changes to This Policy

If this policy changes, the updated policy will be published here and users will be notified through
extension update notes.

## Contact

Questions about this privacy policy? Open an issue at:
[https://github.com/AtlasPCSupport/TabNotes/issues](https://github.com/AtlasPCSupport/TabNotes/issues)
