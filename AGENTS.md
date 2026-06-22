# TabNotes Agent Notes

## Engineering Rules

- Prefer actively maintained, standards-based APIs, libraries, and tools.
- Do not introduce deprecated APIs, poorly maintained packages, or legacy runtimes for new work.
- If existing browser/platform compatibility requires a legacy API temporarily, isolate it behind a small adapter, document why it remains, cover it with tests, and leave a clear migration path.
- Keep generated build artifacts out of git history. Source, configuration, tests, and documentation belong in the repository; release packages belong in GitHub Releases or local/private artifact folders.
- Preserve the local-first privacy model: no telemetry, no tracking SDKs, and no TabNotes server dependency for user notes.
