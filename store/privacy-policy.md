# TabNotes Privacy Policy

**Effective date:** June 2026

## The one-line version
TabNotes collects zero data. Your notes stay local unless you explicitly enable optional Google
Drive backup.

## Data storage
All notes, workspaces, tags, and settings are stored exclusively in:
- **chrome.storage.local** (extension) — sandboxed to your browser, on your device
- **localStorage** (web app) — stored in your browser for that origin only

No data is transmitted to any TabNotes server. TabNotes works offline by default.

## Optional Google Drive backup
If enabled by the user, TabNotes uses Chrome identity and the Google Drive `drive.appdata` scope to
store a JSON backup in the user's private Google Drive app data folder. The backup goes directly
from the extension to Google Drive. The TabNotes developer cannot access it.

## Permissions
| Permission | Why |
|---|---|
| `storage` | Save notes locally on your device |
| `tabs` | Read current tab URL to link notes contextually |
| `activeTab` | Access current tab URL when the panel is open |
| `sidePanel` | Display the notes panel alongside browser content |
| `identity` | Optional Google sign-in for Drive backup |
| `alarms` | Backup debounce, reminders, and scheduled notifications |
| `notifications` | User reminders and daily digest |
| `https://www.googleapis.com/*` | Optional Google Drive backup API calls |

## No analytics, no tracking
TabNotes contains no analytics, telemetry, crash reporting, advertising SDKs, or tracking of any kind.

## Open source
Every line of code is public: https://github.com/mikepchelper-spec/TabNotes

## Contact
Open an issue at: https://github.com/mikepchelper-spec/TabNotes/issues
