# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SnapMind is a cross-platform (macOS/Windows) Electron desktop app that lets users invoke LLMs on selected text via global hotkeys. Renderer is React 19 + Vite + HeroUI + Tailwind v4; main process is TypeScript ESM; native helpers in Swift (mac) and .NET (Windows) read the OS-level text selection. Node `>=24 <25`.

## Commands

```bash
npm install
npm run build:helper        # mac: compiles helper/SelectedText.swift → helper/selectedtext
npm run build:win-helper    # Windows equivalent (dotnet build in helper/SelectedTextWin)
npm run dev:electron        # concurrently: vite main build (watch) + tsc preload (watch) + vite renderer + electron .
npm run build               # build:main + build:preload + build:render (artifacts under dist-electron/ and dist/)
npm run build:prod          # macOS production build via ./build.sh (electron-builder)
npm run build:win-prod      # Windows production build via build.cmd
npm run lint                # eslint .
npm run format              # prettier --write
npm test                    # vitest (watch). Use `npm run test:run` for one-shot, `test:coverage` for coverage.
npx vitest run path/to/file.test.ts          # run a single test file
npx vitest run -t "test name substring"      # run by test name
```

Helper binaries must be built before `dev:electron` can exercise the hotkey path end-to-end. Vitest uses `jsdom` and the `@/` alias maps to `src/` (see `vitest.config.ts`).

## Three TypeScript build targets

The project has three distinct TS configs because main, preload, and renderer have different module systems and globals. When changing tsconfigs or imports, pick the right one:

- `tsconfig.main.json` → bundled by `vite.config.main.ts` into `dist-electron/main.js`. Source: `main.ts` + `electron/*.ts`.
- `tsconfig.preload.json` → compiled by `tsc` into `dist-electron/preload.js`. Source: `preload.ts` only — this is the IPC contract.
- `tsconfig.json` → renderer (`src/`), bundled by Vite (`vite.config.ts`) into `dist/`.

The project is native ESM (`"type": "module"`). Keep file extensions on relative imports in main/preload code.

## Architecture: hotkey → AI → UI

The control flow that touches the most code:

1. `main.ts:registerHotkeys()` registers global shortcuts from `hotkeys.json`.
2. On trigger, `main.ts:executeHotkey()` spawns the platform helper binary (`helper/selectedtext` on mac, `SelectedTextWin.exe` on Windows), parses its JSON stdout for the user's current selection.
3. `electron/TextSelectionService.ts` opens the chat popup window and forwards the text + the hotkey's prompt to the renderer via IPC.
4. Renderer (`src/pages/ChatPopup/`) receives `chat-popup:init-message`, calls a provider through `src/services/AIService.ts` → `ProviderFactory`, streams the response back into the UI.

When changing this path, `preload.ts` is the source of truth for the renderer↔main contract (`hotkeys:*`, `settings:*`, `chat-popup:*`, `update:*`, `permission:*`, `theme:*`, etc.). Update `preload.ts` and grep `window.electronAPI.<method>` in `src/` for callers.

## Architecture: provider plugin system

All LLM providers go through `src/services/providers/`. The pattern is **compose, don't subclass**:

- `core/` — protocol primitives (`sseStreamParser`, `ndjsonStreamParser`, `urlResolvers`).
- `adapters/<name>RequestBuilder.ts` — builds the HTTP request (URL, headers, body) for one provider.
- `parsers/<name>ResponseParser.ts` — parses streaming chunks + model list responses.
- `ProviderFactory.ts` — `adapterMap` merges a `RequestBuilder` + `ResponseParser` into a `ProviderAdapter`; `UnifiedProvider` wraps it as a `Provider`.

To add a provider: add a builder + parser, then a single entry in `adapterMap`. OpenAI-compatible providers (DeepSeek, Qwen) reuse `createOpenAIRequestBuilder` / `createOpenAIResponseParser` factories with custom URL derivation and model filters — see how DeepSeek/Qwen are wired in `ProviderFactory.ts`.

## Settings and secrets

- `electron/SettingsService.ts` is file-backed in Electron's `userData` directory. On first launch it copies `settings.default.json` and `hotkeys.default.json` into userData. When you add a settings field, update `settings.default.json` so existing installs get the new default on next load.
- `SettingsService.updateObjectByPath` is **immutable** — it returns a new object. Renderer should use `electronAPI.updateSetting(path, value)` (→ `settings:update-path`) rather than fetching, mutating, and writing back the whole blob.
- API keys are encrypted at rest via `electron/SafeStorageService.ts` and processed by `SettingsService.processApiKeys`. If you add a new secret field, extend that handler so it gets encrypted on save and decrypted on read.

## Conventions worth knowing

- **Icons must go through `src/components/Icon.tsx`.** Never import from `react-icons/*` directly in feature/page components. To add an icon: add the import, extend the `IconType` union (alphabetical), add the `case` in `renderIcon`. AI provider logos use `@lobehub/icons-static-svg`. See `.cursor/skills/icon-usage/SKILL.md`.
- Centralized logging through `electron/LogService.ts` (wraps `electron-log`). Use scoped loggers in main: `logService.scope('myFeature').info(...)`. In renderer, use `src/services/LoggerService.ts`.
- Conventional Branch naming is enforced (see README badge): `feature/...`, `fix/...`, `chore/...`, etc.
- Auto-update: `electron/AutoUpdateService.ts` uses `electron-updater`. In dev (`!app.isPackaged`) it reads `dev-app-update.yml`.

## Platform notes

- **macOS**: app needs Accessibility permission (to read the selection) and Keychain access (for `safeStorage`-encrypted API keys). `electron/SystemPermissionService.ts` exposes the check + `system:open-accessibility` IPC.
- **Windows**: the app must be run as Administrator for global hotkeys + the helper to work reliably (`is-elevated` is used to detect this).
