## macOS notarization (optional)

Packaging can submit the app for Apple notarization and staple the ticket automatically.

Set these environment variables before running `npm run build:prod`:

- `NOTARIZE=true`
- `APPLE_ID` – Apple ID email
- `APPLE_APP_SPECIFIC_PASSWORD` – app-specific password
- `APPLE_TEAM_ID` – Developer Team ID (recommended)

Notes:
- Requires Xcode command line tools and a valid Developer ID Application certificate with hardened runtime (already configured in `electron-builder.json`).
- The afterSign hook (`scripts/notarize.cjs`) uses notarytool via `@electron/notarize`.
- After artifacts are built, `scripts/staple.cjs` staples the ticket to the `.app` and `.dmg`.