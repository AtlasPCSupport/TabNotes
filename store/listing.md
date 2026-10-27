# TabNotes — Chrome Web Store Listing

## Next update package (not yet published)

- Version: `2.12.2`
- Chrome Web Store ID: `pniapenkdphjolncppcichbahomfiffj`
- Public listing: `https://chromewebstore.google.com/detail/tabnotes/pniapenkdphjolncppcichbahomfiffj`
- Website: `https://tabnotes.atlaspcsupport.com/`
- Privacy policy: `https://tabnotes.atlaspcsupport.com/privacy/`
- Terms: `https://tabnotes.atlaspcsupport.com/terms/`
- ZIP: locally generated `tabnotes-extension-v2.12.2.zip`; GitHub Release asset not yet published.

## What's new in 2.12.2

- About now shows your installed version and one summary of recent improvements in English and Spanish.
- A small, dismissible update notice opens What's new without interrupting your work.
- Includes the previous capture and interface improvements below; notes and backups remain compatible.

### Included improvements from 2.12.0 and 2.12.1

- Clearer capture workflow: choose your destination, then select text, screenshot or crop.
- Easier-to-understand Page, Site, Project and Global scopes with contextual explanations.
- Cleaner header with the duplicate Settings button removed.
- More readable note lists, checklist previews and fewer empty groups.
- Improved Spanish labels and keyboard dismissal of the capture menu.
- Existing notes, manual backups, encryption and Google Drive compatibility are preserved.

## Name

TabNotes

## Short description

Contextual notes per page, domain, workspace, or browser context. Local-first, private, and sync-ready.

## Detailed description

TabNotes is a contextual note-taking extension for Chrome.

It helps you capture notes connected to the page, domain, workspace, or browser context you are working in, so your research, ideas, reminders, and project notes stay organized where they belong.

Key features:

- URL notes: create notes linked to a specific page.
- Domain notes: keep shared notes for an entire website or web app.
- Workspace notes: organize notes by project, client, task, or workflow.
- Global notes: use a general scratchpad that is available everywhere.
- Multiple notes per context: create more than one note for the same page, domain, or workspace.
- Search and tags: find notes across titles, content, tags, and scopes.
- Templates: insert common note structures quickly.
- Capture Hub: create notes, clip selected text, take screenshots, and crop visible areas.
- Optional floating capture button: trigger a screenshot, crop, or text clip from the current site.
- Reminders: create note reminders and receive browser notifications.
- Export and restore: back up notes manually with JSON export and restore.
- Optional Google Drive sync: if enabled, TabNotes stores sync data in your private Google Drive app data folder using the limited drive.appdata scope.
- Themes and language support: light mode, dark mode, and multilingual interface support.

Privacy:

TabNotes does not collect, sell, track, or analyze your personal data. Notes are stored locally by default. Google Drive sync runs only when you choose to enable it. Password-protected backup exports are encrypted; local browser storage and optional Google Drive sync are not encrypted by TabNotes.

TabNotes is designed for researchers, students, developers, support technicians, writers, and anyone who needs notes that stay connected to their browsing context.

## Category

Work and planning / Productivity

## Permissions justification

- `storage`: stores notes, workspaces, reminders, preferences, sync settings, and app state locally in the browser.
- `unlimitedStorage`: supports local-first note collections that may include many or long notes.
- `tabs`: reads the active tab URL, title, and domain so notes can be associated with the correct page or domain.
- `activeTab`: accesses the current tab only when the user invokes TabNotes.
- `sidePanel`: provides the main TabNotes interface inside Chrome's side panel.
- `alarms`: schedules user-created reminders and background sync checks.
- `notifications`: shows browser notifications when reminders or backup reminders are due.
- `identity`: enables optional Google OAuth authentication for Google Drive sync and restore.
- `offscreen`: plays local reminder audio when a reminder fires.
- `contextMenus`: adds "Clip selection to TabNotes" when the user selects text and uses the context menu.
- `scripting`: reads selected text after an explicit capture action and injects the optional floating capture button.
- `http://*/*`, `https://*/*`: optional per-site access requested only when the user enables clipping or the floating button for that site.
- `https://www.googleapis.com/*`: used only for optional Google Drive appData sync and restore after the user enables Drive sync.

## Data usage disclosure

TabNotes may process:

- Web history: current URL, title, and domain used to attach notes to browser context.
- Website content: user-selected text clipped into notes by explicit user action.

TabNotes does not sell user data, does not use data for advertising, and does not transfer data for purposes unrelated to the single purpose of the extension.

## Screenshot assets

Use the final screenshots in:

```text
store/assets-final-20260619/
```

Recommended upload order:

1. `01-editor-url-note-1280x800.png`
2. `02-search-and-all-notes-1280x800.png`
3. `03-drive-backup-settings-1280x800.png`
4. `04-reminders-1280x800.png`
5. `05-workspaces-light-mode-1280x800.png`

Promo images:

- `promo-small-440x280.png`
- `promo-marquee-1400x560.png`
