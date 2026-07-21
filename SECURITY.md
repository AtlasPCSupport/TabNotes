# Security Policy — TabNotes

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.11.x  | ✅ Active support  |
| < 2.11  | ❌ No longer supported |

## Reporting a Vulnerability

If you discover a security vulnerability in TabNotes, please report it responsibly:

1. **Do NOT open a public issue** — this could expose users before a fix is available.
2. **Email**: Open a private issue via [GitHub Security Advisories](https://github.com/mikepchelper-spec/TabNotes/security/advisories/new).
3. **Include**:
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if you have one)

We aim to acknowledge reports within **48 hours** and release a patch within **7 days** for critical issues.

## Security Practices

TabNotes follows these security practices:

### Data Storage
- Notes are stored locally in `chrome.storage.local` (extension) or IndexedDB (web app)
- No data is sent to any TabNotes server — there is no TabNotes server
- Google Drive sync is optional and uses the user's own Drive `appDataFolder`

### Encryption
- AES-256-GCM via the Web Crypto API
- PBKDF2 key derivation with 100,000 iterations and SHA-256
- Random 16-byte salt and 12-byte IV per encryption operation
- Passwords are never stored

### Input Sanitization
- All HTML content is sanitized with DOMPurify using a strict allowlist
- CSS properties are filtered to block `url()`, `expression()`, and `javascript:` attacks
- External links are rewritten to `target="_blank"` with `rel="noopener noreferrer"`

### Chrome Permissions
- No `<all_urls>` — host permissions are limited to `https://www.googleapis.com/*` for Drive sync
- Content scripts are restricted to the TabNotes web app domain only
- Each permission is documented in `PRIVACY_POLICY.md`

### Import/Export
- JSON imports are validated with strict type guards and size limits (10 MB max)
- Schema version and envelope type are verified before any data is applied

### CI/CD
- Every PR runs: lint, typecheck, unit tests, build, and Playwright E2E tests
- Dependencies are kept up to date

## Disclosure Policy

- We will credit reporters (unless anonymity is preferred)
- Critical fixes will be released as soon as possible
- A security advisory will be published for any confirmed vulnerability
