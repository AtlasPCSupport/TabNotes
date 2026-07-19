# Privacy Policy — TabNotes

**Last updated: June 20, 2026**

## Overview

TabNotes is a local-first browser extension with a companion mobile PWA. By default, your notes
stay on your device. If you choose to enable optional Google Drive sync, TabNotes sends sync data
directly to your own Google Drive app data folder.

## Data We Collect

**We collect no data.**

TabNotes does not collect, store, sell, or share any personal information, browsing data, or note
content with the TabNotes developer or any TabNotes server.

## How Your Data Is Stored

All notes, workspaces, and settings created in TabNotes are stored in your browser's local storage
(`chrome.storage.local`) on your own device. This data:

- Never leaves your device unless you explicitly enable Google Drive sync or submit an optional Groq AI chat request
- Is never sent to any TabNotes server
- Is never accessible to the TabNotes developer
- Is never used for analytics, advertising, or profiling

## Optional Google Drive Sync

If you connect Google Drive, TabNotes uses Chrome's `identity` API and the Google Drive
`drive.appdata` scope to create or update a JSON sync file in your private Google Drive
`appDataFolder`.

When enabled:

- Your notes sync data is transmitted directly between TabNotes and Google Drive
- The sync file is stored in your own Google account, not on TabNotes infrastructure
- The sync file is hidden from your normal "My Drive" view by Google Drive
- TabNotes does not persist your Google access token in extension storage
- You can disconnect Google Drive from TabNotes at any time

## Optional Groq AI Chat

The **Ask** feature is disabled until you enter your own Groq API key in Settings. When you submit
an AI chat request, TabNotes sends your question, up to eight recent chat messages, and excerpts
from up to ten locally selected notes (up to 800 characters per note) directly to Groq's API to
generate a response. Note ranking happens locally before the request is sent.

- Groq receives this content only when you actively submit a chat request
- Your Groq API key is stored only in this browser's local extension storage
- Your key is not included in TabNotes backup exports or Google Drive sync data
- You can remove the key at any time in Settings
- Groq's handling of request data is governed by Groq's own privacy terms

## Permissions Used

TabNotes requests the following Chrome permissions:

| Permission | Why it's needed |
|---|---|
| `storage` | Save your notes locally on your device |
| `unlimitedStorage` | Support local-first note collections that may grow beyond standard storage quotas |
| `tabs` | Read the current tab's URL to link notes to the right page |
| `activeTab` | Access the active tab's URL when the panel is open |
| `sidePanel` | Display the notes panel alongside your browser content |
| `contextMenus` | Add "Clip selection to TabNotes" when the user selects text and uses the context menu |
| `identity` | Optional Google sign-in for Google Drive sync |
| `offscreen` | Play local reminder audio when a note reminder fires |
| `alarms` | Schedule reminders and periodic Drive sync checks |
| `notifications` | Show reminders and daily digest notifications |
| `https://www.googleapis.com/*` | Optional Google Drive sync API calls |

No permission is used for data collection or tracking.

## Export & Import

The Export feature downloads your notes as a JSON file directly to your device. This file never
passes through a TabNotes server. The Import feature reads a local file from your device.

## Third-Party Services

TabNotes does not use third-party analytics, crash reporting, advertising, or tracking services.
Google Drive is used only if you opt in to Drive sync. Groq is contacted only when you opt in by
adding your own API key and submit an AI chat request.

## Children's Privacy

TabNotes does not collect any information from anyone, including children.

## Changes to This Policy

If this policy changes, the updated policy will be published here and users will be notified via
the extension update notes.

## Contact

Questions about this privacy policy? Open an issue at:
[https://github.com/mikepchelper-spec/TabNotes/issues](https://github.com/mikepchelper-spec/TabNotes/issues)
