# SnapMind source layout — process folders under `src`

Status: design approved, ready for planning
Owner: Louis Liu
Last updated: 2026-10-20

## Goal

Put every TypeScript source file under `src`, with one folder per process. Keep the current build tools: Vite bundles the main process, `tsc` compiles the preload as CommonJS, and Vite builds the renderer. `index.html` stays at the repository root.

The files inside a packaged macOS app stay on the same paths they use today.

## Non-goals

- Do not adopt `electron-vite`, `electron.vite.config.ts`, or `electron-builder.yml`.
- Do not add `src/renderer/src` or a `features/` split.
- Do not rename existing PascalCase page folders (`Settings`, `ChatPopup`).
- Do not move `helper/`, `resources/`, `config/`, `scripts/`, or `settings.default.json`.
- Do not change `sandbox`, IPC channel names, or the `window.electronAPI` method list.
- Do not build or verify a Windows installer. Update `electron-builder-win.json` source paths only.
- Do not rewrite historical files under `docs/superpowers/plans/`.
- Do not repair `.github/copilot-instructions.md` in this change. `CLAUDE.md` and the new Cursor rule are the agent sources.

## Success criteria

1. `src/main`, `src/preload`, `src/renderer`, and `src/shared` exist. The repository root has no `main.ts`, `preload.ts`, or `electron/` directory.
2. `npm test` passes.
3. `npm run build` writes `dist-electron/main.js`, `dist-electron/preload.js`, and `dist/index.html`.
4. `./build.sh` produces a macOS `.app`. If notarization fails for missing credentials, the unpacked `.app` is still present and is the artifact under test.
5. That `.app` contains every packaged path in §4.
6. The built `dist-electron/main.js` still requests the packaged resource paths in §4, and its dev-only paths point at `src/main/assets` and `src/main/db/migrations`.
7. `CLAUDE.md` and `.cursor/rules/source-layout.mdc` describe this layout.

## §1. Source layout

```text
index.html                         # stays at the repo root
src/
├── main/
│   ├── index.ts                   # was main.ts
│   ├── ai/                        # was electron/ai
│   ├── assets/                    # was electron/assets
│   ├── db/                        # was electron/db, including migrations
│   ├── ipc/
│   ├── services/
│   ├── utils/
│   ├── LogService.ts
│   └── userDataPath.ts
├── preload/
│   └── preload.ts                 # was preload.ts
├── renderer/                      # was the contents of src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   ├── pages/
│   ├── stores/
│   ├── hooks/
│   ├── services/
│   ├── types/                     # renderer-only types, plus re-exports
│   └── ...
└── shared/                        # pure types. No Node, no DOM, no Electron
    ├── agent-dto.ts
    ├── provider-dto.ts
    ├── chat.d.ts
    ├── autoUpdate.d.ts
    └── ai-ipc.ts
```

These stay at the repository root: `helper/`, `resources/`, `config/`, `scripts/`, `settings.default.json`, `dev-app-update.yml`, `package.json`, both Vite configs, all four tsconfigs, `electron-builder.json`, `electron-builder-win.json`, `drizzle.config.ts`, `vitest.config.ts`, and `test/`.

`src/preload/preload.ts` keeps that file name. `tsc` with `rootDir` set to `src/preload` then emits `dist-electron/preload.js`. Main loads that file with `path.join(__dirname, 'preload.js')`.

Move files with `git mv` so history follows the files.

## §2. Shared types

Move only the type modules that the main process already imports from `src/types`:

| Module            | Main importers today                                                      |
| ----------------- | ------------------------------------------------------------------------- |
| `agent-dto.ts`    | `resolveAgentForRun.ts`, `AIService` tests                                |
| `provider-dto.ts` | `resolveAgentForRun.ts`, `AIService` tests                                |
| `chat.d.ts`       | `AIService.ts`, `mapMessages.ts`, `registerAiIpc.ts`, `mapMessages` tests |
| `autoUpdate.d.ts` | `AutoUpdateService.ts` (`@/types/autoUpdate`)                             |
| `ai-ipc.ts`       | pure IPC payload types; depends on `Message` from `chat`                  |

Leave these in `src/renderer/types`: `index.d.ts` (`Window.electronAPI`), `setting.d.ts`, `hotkey-dto.ts`.

Each moved module gets a thin re-export at its old renderer path, for example `src/renderer/types/agent-dto.ts` re-exports `src/shared/agent-dto.ts`. Renderer imports such as `@/types/agent-dto` stay valid.

Main imports shared types by a relative path, such as `../../shared/agent-dto.js` from `src/main/ai/`. Keep the `.js` suffix on those relative imports. Remove the `@/` alias from the main Vite config and from `tsconfig.main.json`.

`src/shared` must not import `electron`, Node built-ins, React, or DOM types.

## §3. Build and alias config

| File                     | Change                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `vite.config.main.ts`    | Entry becomes `src/main/index.ts`. Output stays `dist-electron/main.js`. Remove the `@` alias.                                |
| `vite.config.ts`         | `@` resolves to `src/renderer`. Input stays the root `index.html`. Output stays `dist/`.                                      |
| `vitest.config.ts`       | `@` resolves to `src/renderer`. Include globs stay `**/__tests__/**` and sibling `*.test.*`.                                  |
| `tsconfig.json`          | `include` is `src/renderer` and `src/shared`. `paths`: `@/*` → `src/renderer/*`.                                              |
| `tsconfig.main.json`     | `include` is `src/main` and `src/shared`. Do not include the preload. Remove `@/*`.                                           |
| `tsconfig.preload.json`  | `include` is `src/preload/preload.ts`. `module` stays `CommonJS`. `rootDir` is `src/preload`. `outDir` stays `dist-electron`. |
| `tsconfig.node.json`     | Still includes only `vite.config.ts`.                                                                                         |
| `index.html`             | Script source becomes `/src/renderer/main.tsx`.                                                                               |
| `drizzle.config.ts`      | `schema` is `./src/main/db/schema.ts`. `out` is `./src/main/db/migrations`.                                                   |
| `eslint.config.js`       | Node globals apply to `src/main/**` and `src/preload/**`.                                                                     |
| `scripts/copy-assets.js` | Read `src/main/assets`. Write `dist-electron/electron/assets`.                                                                |
| `package.json`           | `"main"` stays `dist-electron/main.js`. Build script names stay the same.                                                     |

`CLAUDE.md` and `.cursor/skills/icon-usage/SKILL.md` use the new paths. The icon component path becomes `src/renderer/components/Icon.tsx`. README image paths become `src/main/assets/snap-mind-app-icon-macOS.png`.

## §4. Packaged paths that stay stable

Source folders move. The installed layout does not.

`__dirname` inside the bundled main file is the `dist-electron` directory, in dev and inside `app.asar`.

| Reader           | Dev path after this change                                    | Installed path (unchanged)                          |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| Selection helper | `<repo>/helper/selectedtext` via `path.join(__dirname, '..')` | `Contents/Resources/helper/selectedtext`            |
| Default settings | `<repo>/settings.default.json` via `process.cwd()`            | `Contents/Resources/settings.default.json`          |
| Migrations       | `<repo>/src/main/db/migrations` via `process.cwd()`           | `Contents/Resources/db-migrations`                  |
| Preload          | `dist-electron/preload.js`                                    | `app.asar/dist-electron/preload.js`                 |
| Renderer page    | Vite dev server                                               | `app.asar/dist/index.html`                          |
| Tray icons       | `<repo>/src/main/assets/`                                     | `app.asar/dist-electron/electron/assets/`           |
| Update config    | `<repo>/dev-app-update.yml` via `process.cwd()`               | unchanged; packaged updater does not read this file |
| User data        | `process.cwd()` when unpackaged                               | `app.getPath('userData')`                           |

Code changes required by the table:

- `resolveMigrationsFolder`: the unpackaged branch joins `process.cwd()`, `src`, `main`, `db`, `migrations`. The packaged branch stays `path.join(resourcesPath, 'db-migrations')`. A unit test asserts both branches.
- Tray icon dev branches join `__dirname`, `..`, `src`, `main`, `assets`, and the icon file name. Packaged branches stay `path.join(__dirname, 'electron', 'assets', iconName)`.
- `electron-builder.json` and `electron-builder-win.json`: change `from` and `icon` to `src/main/db/migrations` and `src/main/assets/...`. Keep every `to` value: `helper/selectedtext`, `settings.default.json`, `db-migrations`, and the Windows helper file names.
- Helper `resourcesPath` in dev stays `path.join(__dirname, '..')`, which is the repo root. Do not change `extraResources` for `helper/` or `settings.default.json`.

## §5. Verification

Run these checks after the move. All of them are required.

1. `npm test`
2. `npm run build`, then confirm `dist-electron/main.js`, `dist-electron/preload.js`, and `dist/index.html` exist.
3. `./build.sh` on macOS. This compiles the helper, builds the app, and runs electron-builder. The unpacked app is `build/mac-arm64/SnapMind.app` or `build/mac-x64/SnapMind.app`, matching the arch flag.
4. Inspect that `.app`:
   - `Contents/Resources/helper/selectedtext` exists and is executable.
   - `Contents/Resources/settings.default.json` exists.
   - `Contents/Resources/db-migrations` contains the SQL migration files.
   - `Contents/Resources/app.asar` lists `dist/index.html`, `dist-electron/main.js`, `dist-electron/preload.js`, and `dist-electron/electron/assets/mind_tray_macos_Template.png`.
5. In `dist-electron/main.js`, confirm the packaged strings `db-migrations`, `settings.default.json`, and `helper/selectedtext` are present, and confirm the dev strings `src/main/assets` and `src/main/db/migrations` are present.

A missing credential for notarization does not fail this spec when the `.app` exists and step 4 passes. A missing file in step 4 is a failed change.

## §6. Agent rule

After the checks in §5 pass, add `.cursor/rules/source-layout.mdc` with `alwaysApply: true`. Update `CLAUDE.md` so its paths match §1 and §4.

The rule states:

- New TypeScript source goes under `src/main`, `src/preload`, `src/renderer`, or `src/shared`.
- `src/shared` is pure TypeScript.
- The renderer reaches the system only through `window.electronAPI`.
- Main-process relative imports keep the `.js` suffix.
- Tests stay next to the source, under `__tests__/`.
- The packaged paths in §4 stay stable. A change to a `from` path updates the matching dev reader and the §5 check in the same change.

## Risks

- `tsc` will emit `dist-electron/src/preload/preload.js` if `rootDir` is omitted. Main would load a missing `preload.js`. §1 and §3 require `rootDir`.
- A case-only rename is not part of this move. Use `git mv` for directory moves.
- `tsconfig.json` today includes all of `src`. After the move it must exclude `src/main` and `src/preload`, or the renderer project type-checks Node code.
- Leaving the copy-script destination at `dist-electron/electron/assets` is intentional. That path is inside the asar. Changing it without changing the packaged tray reader breaks the tray icon.
