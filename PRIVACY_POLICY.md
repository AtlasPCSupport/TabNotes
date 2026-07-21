# Privacy Policy — TabNotes

**Last updated: June 20, 2026**

## Overview

TabNotes is a local-first browser extension with a companion web app. By default, your notes stay
on your device. If you choose to enable optional Google Drive sync, TabNotes sends sync data
directly to your own Google Drive app data folder.

## Data We Collect

**We collect no data.**

TabNotes does not collect, store, sell, or share personal information, browsing data, or note
content with the TabNotes developer or any TabNotes server.

## How Your Data Is Stored

Notes, workspaces, tags, and settings are stored locally on your device:

- `chrome.storage.local` for the extension
- IndexedDB for the companion web app, scoped to that web origin

This data never leaves your device unless you explicitly enable Google Drive sync. It is never
sent to a TabNotes server and is never used for analytics, advertising, or profiling.

## Optional Google Drive Sync

If you connect Google Drive, TabNotes uses Chrome's `identity` API and the Google Drive
`drive.appdata` scope to create or update a JSON sync file in your private Google Drive
`appDataFolder`.

When enabled:

- Notes sync directly between TabNotes and Google Drive.
- The sync file is stored in your Google account, not on TabNotes infrastructure.
- The file is hidden from normal "My Drive" view by Google Drive.
- TabNotes does not persist your Google access token in extension storage.
- You can disconnect Google Drive at any time.

## Permissions Used

| Permission                     | Why it's needed                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `storage`                      | Save notes locally on your device                                                      |
| `unlimitedStorage`             | Support local-first note collections that may grow beyond standard storage quotas      |
| `tabs`                         | Read the current tab's URL to link notes to the right page                             |
| `activeTab`                    | Access the active tab's URL when the panel is open                                     |
| `sidePanel`                    | Display the notes panel alongside browser content                                      |
| `contextMenus`                 | Add "Clip selection to TabNotes" when the user selects text and opens the context menu |
| `identity`                     | Optional Google sign-in for Google Drive sync                                          |
| `offscreen`                    | Play local reminder audio when a note reminder fires                                   |
| `alarms`                       | Schedule reminders and periodic Drive sync checks                                      |
| `notifications`                | Show reminders and daily digest notifications                                          |
| `https://www.googleapis.com/*` | Optional Google Drive sync API calls                                                   |

No permission is used for data collection or tracking.

## Export & Import

Export downloads your notes as a JSON file directly to your device. That file never passes through
a TabNotes server. Import reads a local file that you choose from your device.

## Third-Party Services

TabNotes does not use third-party analytics, crash reporting, advertising, telemetry, or tracking
services. Google Drive is contacted only when you opt in to Drive sync.

## Children's Privacy

TabNotes does not collect information from anyone, including children.

## Changes to This Policy

If this policy changes, the updated policy will be published here and users will be notified through
extension update notes.

## Contact

Questions about this privacy policy? Open an issue at:
[https://github.com/AtlasPCSupport/TabNotes/issues](https://github.com/AtlasPCSupport/TabNotes/issues)
