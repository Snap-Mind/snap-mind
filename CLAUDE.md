# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SnapMind is a cross-platform (macOS/Windows) Electron desktop app that lets users invoke LLMs on selected text via global hotkeys. Renderer is React 19 + Vite + HeroUI + Tailwind v4; main process is TypeScript ESM; native helpers in Swift (mac) and .NET (Windows) read the OS-level text selection. Node `>=24 <25`.

## Commands

```bash
npm install                 # runs `db:rebuild` postinstall (better-sqlite3 is a native module)
npm run build:helper        # mac: compiles helper/SelectedText.swift → helper/selectedtext
npm run build:win-helper    # Windows equivalent (dotnet build in helper/SelectedTextWin)
npm run dev:electron        # concurrently: vite main build (watch) + tsc preload (watch) + vite renderer + electron .
npm run build               # build:main + build:preload + build:render (artifacts under dist-electron/ and dist/)
npm run build:prod          # macOS production build via ./build.sh (electron-builder)
npm run build:win-prod      # Windows production build via build.cmd
npm run lint                # eslint .
npm run format              # prettier --write
npm test                    # vitest run (one-shot). Use `npm run test:watch` for watch mode, `test:coverage` for coverage.
npx vitest run path/to/file.test.ts          # run a single test file
npx vitest run -t "test name substring"      # run by test name
npm run db:generate         # drizzle-kit generate — writes a new migration into src/main/db/migrations from schema.ts
npm run db:rebuild          # rebuild better-sqlite3 against the current Electron ABI (run after Electron upgrades)
```

Helper binaries must be built before `dev:electron` can exercise the hotkey path end-to-end. Vitest uses `jsdom` and the `@/` alias maps to `src/renderer/` (see `vitest.config.ts`). Tests live under `**/__tests__/` in `src/main/` and `src/renderer/`.

## Three TypeScript build targets

The project has three distinct TS configs because main, preload, and renderer have different module systems and globals. When changing tsconfigs or imports, pick the right one:

- `tsconfig.main.json` → bundled by `vite.config.main.ts` into `dist-electron/main.js`. Source: `src/main/**/*.ts`.
- `tsconfig.preload.json` → compiled by `tsc` into `dist-electron/preload.js`. Source: `src/preload/preload.ts` only — this is the IPC contract.
- `tsconfig.json` → renderer (`src/renderer/`), bundled by Vite (`vite.config.ts`) into `dist/`.

`src/shared/` holds pure DTO types used by main and the renderer. It must not import Node, Electron, React, or DOM types.

The project is native ESM (`"type": "module"`). Keep `.js` extensions on relative imports in main-process code — the TS files reference `./foo.js` even though the source is `./foo.ts`, because that's what the emitted ESM needs at runtime.

## Architecture: hotkey → AI → UI

The control flow that touches the most code:

1. `src/main/index.ts:registerHotkeys()` pulls rows from `HotkeysService` (SQLite-backed) and registers each `accelerator` with Electron's `globalShortcut`.
2. On trigger, `src/main/index.ts:triggerHotkey()`:
   - sends `chat:abort` to cancel any in-flight stream in the renderer,
   - if `hotkey.mode === 'selection'`, spawns the platform helper (`helper/selectedtext` on mac, `helper/SelectedTextWin.exe` on Windows) via `runSelectionHelper()` and parses its JSON stdout for the user's current selection,
   - sends `nav:go '/chat'` and `chat:reset-with-seed { text, agentId }` to the main window, then shows it.
3. Renderer (`src/renderer/pages/ChatPopup/`) receives the seed, calls `window.electronAPI.aiSend({ agentId, messages })` (→ `ai:send` in `src/main/ipc/register-ai-ipc.ts`), and receives tokens back via `ai:token` / `ai:reasoning` / `ai:source` / `ai:done` / `ai:error` events.

`src/preload/preload.ts` is the source of truth for the renderer↔main contract. When touching this path, update `src/preload/preload.ts` and grep `window.electronAPI.<method>` in `src/renderer/` for callers. IPC channel handlers are registered in `src/main/ipc/register-ipc.ts` and `src/main/ipc/register-ai-ipc.ts`.

Note: there is no separate popup window anymore — the hotkey navigates the single main window to `/chat`. `TextSelectionService` no longer exists.

## Architecture: AI provider layer (Vercel AI SDK v7)

Providers are wired through `src/main/ai/`, not the old `src/services/providers/` tree (which is gone).

- `AIService.send(agentId, messages, handlers)` — resolves the agent + provider + model, calls the injected `streamText` (from the `ai` package), iterates `fullStream`, and dispatches `text-delta` / `reasoning-delta` / `source` / `error` parts to the handlers. `streamText` does **not throw** on provider failure; it emits an `error` part into the stream — see `readErrorPart` in `ai-service.ts`. Handled via `describeAiError` for a user-facing message.
- `create-language-model.ts` — the single `switch (kind)` that maps a stored provider row (`openai`, `azure-openai`, `anthropic`, `google`, `deepseek`, `qwen`, `ollama`) to the corresponding `@ai-sdk/*` (or `ollama-ai-provider-v2`) factory. DeepSeek and Qwen go through `createOpenAICompatible` with custom `baseURL` derivation in `url-resolvers.ts`.
- `resolve-agent-for-run.ts` — turns an `agentId` into the concrete `{ agent, provider, model }` and returns typed error codes (`no-agent`, `unbound`, `missing-model`, `no-api-key`).
- `map-messages.ts` / `map-params.ts` — translate the app's `Message` type and agent config into the AI SDK's shapes.

**To add a provider**: add a new `case` in `create-language-model.ts` and, if the base URL is non-standard, a resolver in `url-resolvers.ts`. Providers are user-created rows in SQLite (see `providers` table), so no code changes are needed to add another instance of an existing kind.

`streamText` is injected into `AIService` from `src/main/index.ts:getAIService()` (rather than imported directly) so tests can supply a fake — see `src/main/ai/__tests__/`.

## Architecture: persistence (SQLite + drizzle)

Most state moved from JSON files to SQLite. The DB file is `snapmind.db` in Electron's `userData` directory.

- `src/main/db/schema.ts` — drizzle schema. Tables: `providers`, `provider_models`, `agents`, `hotkeys`.
- `src/main/db/client.ts` opens the connection; `src/main/db/migrate.ts` runs migrations from `src/main/db/migrations/` at startup (`src/main/index.ts:initDatabase`). Generate new migrations with `npm run db:generate` after editing `schema.ts`.

Unpackaged runs read migrations from `src/main/db/migrations`. Packaged runs read `Contents/Resources/db-migrations`. Tray icons are copied to `dist-electron/electron/assets` and stay at that path inside `app.asar`.

- `src/main/db/import.ts` + `src/main/db/import-agents.ts` — one-shot importers that migrate existing users' `settings.json` / `hotkeys.json` into SQLite on first launch after the SQLite migration. The `*.pre-sqlite.bak` / `*.pre-agents.bak` files in the repo root are backups of prior JSON shapes for reference.
- `ProvidersService`, `AgentsService`, `HotkeysService` (in `src/main/services/`) wrap drizzle queries and are the only things IPC handlers call.

`src/main/services/settings-service.ts` still exists but now only handles **app-level** settings that stay in `settings.json` (appearance, general, autoUpdate, etc.) — providers and hotkeys have been extracted. `stripProviders()` in that file exists to prevent the legacy `providers` key from being rewritten.

## Secrets

- API keys on `providers.apiKey` are encrypted at rest via `src/main/services/safe-storage-service.ts` (Electron `safeStorage`). Encryption/decryption happens inside `ProvidersService`; renderer never sees ciphertext.
- The legacy `general.azureApiKey` field on `settings.json` is still handled by `SettingsService.encryptedFields`. If you add a new secret field on settings, extend that list so it gets encrypted on save and decrypted on read.
- `settings.default.json` seeds the initial `settings.json` on first launch. When adding a settings field, update `settings.default.json` so existing installs get the new default.
- `SettingsService.updateObjectByPath` is **immutable** — it returns a new object. Renderer should call `electronAPI.updateSetting(path, value)` (→ `settings:update-path`) rather than fetching, mutating, and writing back the whole blob.

## Conventions worth knowing

- **Icons must go through `src/renderer/components/Icon.tsx`.** Never import from `react-icons/*` directly in feature/page components. To add an icon: add the import, extend the `IconType` union (alphabetical), add the `case` in `renderIcon`. AI provider logos use `@lobehub/icons-static-svg`. See `.cursor/skills/icon-usage/SKILL.md`.
- **Renderer state** — Zustand stores in `src/renderer/stores/` (`useAgentsStore`, `useChatStore`, `useHotkeysStore`, `useProvidersStore`, `useSettingsStore`). Each store subscribes to the corresponding `electronAPI.<domain>.onChanged` event and re-fetches on main-side changes.
- **Logging** — centralized through `src/main/log-service.ts` (wraps `electron-log`). Use scoped loggers in main: `logService.scope('myFeature').info(...)`. In renderer, use `src/renderer/services/logger-service.ts`, which forwards to `logs:log` in main.
- **Branch naming** — Conventional Branch is enforced (see README badge): `feature/...`, `fix/...`, `chore/...`, etc.
- **Auto-update** — `src/main/services/auto-update-service.ts` uses `electron-updater`. In dev (`!app.isPackaged`) it reads `dev-app-update.yml`.

## Platform notes

- **macOS**: app needs Accessibility permission (to read the selection) and Keychain access (for `safeStorage`-encrypted API keys). `src/main/services/system-permission-service.ts` exposes the check + `system:open-accessibility` IPC and polls for changes (`startAccessibilityPolling`) so the renderer gets notified when the user toggles the setting.
- **Windows**: the app must be run as Administrator for global hotkeys + the helper to work reliably (`is-elevated` is used to detect this).
