## SnapMind — Quick guide for AI coding agents

Goal: give a new AI agent enough concrete, actionable knowledge to be immediately productive in this repository.

High level architecture (what to read first)
- Electron main process (native/OS integration): `main.ts` — single-instance lock, global hotkeys, window creation, helper binary invocation.
- Electron services (business logic & platform glue): `electron/AutoUpdateService.ts`, `electron/SettingsService.ts`, `electron/LogService.ts`, `electron/SystemPermissionService.ts`, `electron/TextSelectionService.ts`.
- Preload bridge: `preload.ts` — the explicit list of renderer↔main IPC APIs the UI consumes (use this to find what renderer expects).
- Renderer (UI): `src/` (React app). Entry: `src/main.tsx`, top-level `src/App.tsx`, pages under `src/pages/` (`ChatPopup`, `Settings`).
- Native helper binaries: `helper/SelectedText.swift` (macOS) and `helper/SelectedTextWin/` (Windows). These are invoked by `main.ts` when running hotkeys.

Important developer workflows and commands
- Start dev (recommended):
  - `npm install` then `npm run dev:electron` — this concurrently builds main/preload, runs Vite dev server and then launches Electron (read `package.json` scripts for exact pipeline).
- Build helper (macOS): `npm run build:helper` or `./build-macos-helper.sh` (script compiles `helper/SelectedText.swift` for arm64/x64).
- Build production (macOS): `npm run build:prod` which runs `./build.sh` -> uses `electron-builder` and outputs artifacts under `build/` (see `build/` and `dist-electron/`).
- Windows helper: `npm run build:win-helper` (dotnet build in `helper/SelectedTextWin`).
- Release helper scripts: `scripts/release.sh` (tag version, bump package.json, create annotated git tag).

Key patterns & conventions (project-specific)
- ESM + TypeScript: project uses native ESM (package.json `type: "module"`) and multiple tsconfig targets (`tsconfig.main.json`, `tsconfig.preload.json`). Keep imports using file extensions when editing built files in `dist-electron`.
- Settings are file-backed in the app userData directory: `electron/SettingsService.ts` ensures defaults by copying `settings.default.json` and `hotkeys.default.json` into userData. When changing config shapes, update defaults in `settings.default.json` too.
- Secrets/API keys: stored via `SafeStorageService` and processed by `SettingsService.processApiKeys`. The code expects provider API keys to be encrypted when persisted. Use `SafeStorageService.encrypt`/`decrypt` helpers when testing.
- Immutable updates for nested settings/hotkeys: `SettingsService.updateObjectByPath` returns a new object (no mutation). UI uses `ipcRenderer.invoke('settings:update-path', { path, value })` and similar for hotkeys.

Data & control flow examples (most common change paths)
- Hotkey flow (select text -> hotkey -> AI):
  1. Global hotkey triggers in `main.ts` (registered by `registerHotkeys()`).
  2. For non-zero hotkey IDs `main.ts` runs the helper binary (`helper/selectedtext` on mac), parses JSON stdout, then calls `textSelectionService.handleTextSelection(result.selectedText, prompt, 'hotkey')`.
  3. `TextSelectionService` orchestrates showing the chat popup window and sending the selected text to renderer UI.
  Tip: see `main.ts:executeHotkey(...)` for exact arguments and helper path resolution.

- IPC surface (use `preload.ts` as authoritative list)
  - sync/invoke handlers renderer expects: `hotkeys:get`, `hotkeys:update`, `hotkeys:update-path`, `settings:get`, `settings:update`, `settings:update-path`, `logs:get-path`, `logs:open-file`, `permission:check`, `system:open-accessibility`, `update:check`, `update:install`, `app:get-version`, etc.
  - Example renderer call: `window.electronAPI.getHotkeys()` → calls `ipcRenderer.invoke('hotkeys:get')`.

Logging and debugging
- Centralized logging: `electron/LogService.ts` (wraps `electron-log`). Main logs are `main.log*` files (path from `LogService.getCurrentLogFile()`). In development console logging is enabled (`app.isPackaged` gating).
- Debugging main process: use `npm run dev:electron` and open DevTools (main windows created with `devTools: isDev()`). For packaged behavior, inspect `dist-electron/main.js` and `build/` outputs.

Auto-update and packaging notes
- `electron/AutoUpdateService.ts` wires `electron-updater`. In development the updater reads `dev-app-update.yml` (the service sets `updateConfigPath` when `!app.isPackaged`).
- Packaging config: `electron-builder.json` and `electron-builder-win.json` + `build.sh`/`build.cmd`. Output artifacts land in `build/` (mac: `.dmg` in `build/` seen in repo).

Where to make common changes
- UI changes: `src/pages/*`, `src/components/*`, and `src/contexts/ServiceProvider.jsx` (wires services to React). Use Vite dev server to iterate.
- Main/native work: `main.ts` and `electron/*.ts`. Use small, well-tested edits to preload API (`preload.ts`) to avoid breaking the renderer contract.
- Helpers/native integration: `helper/SelectedText.swift` (mac), `helper/SelectedTextWin` (windows) — tests and local runs should use `npm run build:helper` then `npm run dev:electron`.

Quick checklist for an AI making edits
1. If you change renderer↔main IPC, update `preload.ts` and search for usages in `src/`.
2. If you change settings schema, update `settings.default.json` and `SettingsService.processApiKeys` behavior if fields holding secrets are added.
3. If you touch hotkeys, run `npm run build:helper` and `npm run dev:electron` to validate end-to-end (helper → main → UI).
4. Use `LogService` scoped loggers for main-side debugging: `logService.scope('myFeature').info(...)`.

Files worth opening first when onboarding
- `main.ts`, `preload.ts`, `electron/SettingsService.ts`, `electron/TextSelectionService.ts`, `electron/AutoUpdateService.ts`, `src/pages/ChatPopup/ChatPopup.jsx`, `helper/SelectedText.swift`, `package.json`, `build.sh`.

If any of these notes are unclear or you'd like examples added (small code snippets showing how to add an IPC handler, or an end-to-end test plan for hotkeys), tell me which area to expand and I'll iterate.
