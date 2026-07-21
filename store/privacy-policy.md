# TabNotes Privacy Policy

**Effective date:** June 20, 2026

## The one-line version

TabNotes collects zero data. Your notes stay local unless you explicitly enable optional Google
Drive sync.

## Data storage

Notes, workspaces, tags, and settings are stored exclusively in:

- **chrome.storage.local** (extension) — sandboxed to your browser, on your device
- **IndexedDB** (web app) — stored in your browser for that origin only

No data is transmitted to a TabNotes server. TabNotes works offline by default.

Password-protected backup exports are encrypted. Local browser storage and optional Google Drive sync are not encrypted by TabNotes.

## Optional Google Drive sync

If enabled, TabNotes uses Chrome identity and the Google Drive `drive.appdata` scope to store JSON
sync data in your private Google Drive app data folder. Sync data travels directly between TabNotes
and Google Drive; the TabNotes developer cannot access it.

## Permissions

| Permission                     | Why                                                                   |
| ------------------------------ | --------------------------------------------------------------------- |
| `storage`                      | Save notes locally on your device                                     |
| `unlimitedStorage`             | Support local-first note collections that may grow over time          |
| `tabs`                         | Read the current tab URL to link notes contextually                   |
| `activeTab`                    | Access the current tab URL when the panel is open                     |
| `sidePanel`                    | Display the notes panel alongside browser content                     |
| `contextMenus`                 | Let users clip selected text into notes from the browser context menu |
| `identity`                     | Optional Google sign-in for Drive sync                                |
| `offscreen`                    | Play local reminder audio when a reminder fires                       |
| `alarms`                       | Sync debounce, reminders, and scheduled notifications                 |
| `notifications`                | User reminders and daily digest                                       |
| `https://www.googleapis.com/*` | Optional Google Drive sync API calls                                  |

## No analytics, no tracking

TabNotes contains no analytics, telemetry, crash reporting, advertising SDKs, or tracking of any
kind. Google Drive is contacted only if you enable Drive sync.

## Open source

Every line of code is public: https://github.com/mikepchelper-spec/TabNotes

## Contact

Open an issue at: https://github.com/mikepchelper-spec/TabNotes/issues
