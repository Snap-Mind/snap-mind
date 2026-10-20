# Source Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move TypeScript source under `src/main`, `src/preload`, `src/renderer`, and `src/shared` without changing the files inside a packaged macOS app.

**Architecture:** Keep three build targets. Vite bundles `src/main/index.ts` to `dist-electron/main.js`. `tsc` compiles `src/preload/preload.ts` as CommonJS to `dist-electron/preload.js`. Vite builds the renderer from the root `index.html` into `dist/`. Shared DTO types live in `src/shared`. Renderer files re-export them so `@/types/...` imports stay valid. Packaged `extraResources` destinations stay the same. Only builder `from` paths and dev-only readers change.

**Tech Stack:** Electron 41, Vite 7, TypeScript 5, Vitest 4, electron-builder 26, Drizzle, better-sqlite3. Node `>=24 <25`. Native ESM.

## Global Constraints

- Node `>=24 <25`. Native ESM. Main-process relative imports that already use a `.js` suffix keep that suffix.
- Three build tools stay: `vite.config.main.ts`, `tsc -p tsconfig.preload.json`, `vite.config.ts`.
- `index.html` stays at the repository root.
- Do not adopt electron-vite, `electron-builder.yml`, `src/renderer/src`, or a `features/` split.
- Do not rename PascalCase page folders.
- Do not move `helper/`, `resources/`, `config/`, `scripts/`, or `settings.default.json`.
- Do not change `sandbox`, IPC channel names, or the `window.electronAPI` method list.
- Do not build a Windows installer. Update `electron-builder-win.json` `from` and `icon` paths only.
- Do not rewrite `docs/superpowers/plans/` history or `.github/copilot-instructions.md`.
- Move files with `git mv`.
- Do not stage the pre-existing dirty `package.json` and `package-lock.json` changes. This plan does not edit them.
- Installed paths that must remain: `Contents/Resources/helper/selectedtext`, `Contents/Resources/settings.default.json`, `Contents/Resources/db-migrations`, `app.asar/dist-electron/main.js`, `app.asar/dist-electron/preload.js`, `app.asar/dist/index.html`, `app.asar/dist-electron/electron/assets/`.

## File map

Move:

- `main.ts` → `src/main/index.ts` (Task 3, after the renderer move)
- `electron/**` → `src/main/**` (Task 3)
- `preload.ts` → `src/preload/preload.ts` (Task 4)
- Current renderer files under `src/` (`App.tsx`, `main.tsx`, `assets/`, `components/`, `hooks/`, `i18n/`, `pages/`, `services/`, `stores/`, `styles/`, `types/`, `utils/`, `index.css`, `vite-env.d.ts`) → `src/renderer/` (Task 2)
- `src/types/agent-dto.ts`, `provider-dto.ts`, `chat.d.ts`, `autoUpdate.d.ts`, `ai-ipc.ts` → `src/shared/` (Task 1)

Create:

- Thin re-exports at the old renderer type paths (Task 1, then path fix in Task 2)
- `src/shared/__tests__/sharedTypes.test.ts` (Task 1)
- `src/main/db/__tests__/migrate.test.ts` (Task 3)
- `.cursor/rules/source-layout.mdc` (Task 6)

Modify path readers and configs in Tasks 2–4. Update `CLAUDE.md` and the icon skill in Task 6.

---

### Task 1: Extract shared DTO types

**Files:**

- Create: `src/shared/agent-dto.ts`, `src/shared/provider-dto.ts`, `src/shared/chat.d.ts`, `src/shared/autoUpdate.d.ts`, `src/shared/ai-ipc.ts`
- Create: `src/shared/__tests__/sharedTypes.test.ts`
- Create: re-exports at `src/types/agent-dto.ts`, `src/types/provider-dto.ts`, `src/types/chat.d.ts`, `src/types/autoUpdate.d.ts`, `src/types/ai-ipc.ts`
- Modify: `electron/ai/AIService.ts`, `electron/ai/mapMessages.ts`, `electron/ai/resolveAgentForRun.ts`, `electron/ai/__tests__/AIService.test.ts`, `electron/ai/__tests__/mapMessages.test.ts`, `electron/ipc/registerAiIpc.ts`, `electron/services/AutoUpdateService.ts`
- Test: `src/shared/__tests__/sharedTypes.test.ts`

**Interfaces:**

- Consumes: the current exports of those five type modules.
- Produces: `src/shared/*` modules. Renderer `@/types/<name>` still resolves through the re-export. Main imports `../../src/shared/<name>.js` until Task 3 shortens that path.

- [ ] **Step 1: Write the failing test**

Create `src/shared/__tests__/sharedTypes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AgentDTO } from '../agent-dto.js';
import type { AiSendRequest } from '../ai-ipc.js';
import type { UpdateEvent } from '../autoUpdate.js';
import type { Message } from '../chat.js';
import type { ProviderDTO } from '../provider-dto.js';

describe('shared types', () => {
  it('resolves the DTO modules', () => {
    const agent = { id: 1 } as AgentDTO;
    const provider = { id: 2 } as ProviderDTO;
    const message = { role: 'user', content: 'hi' } as Message;
    const event = { type: 'checking' } as UpdateEvent;
    const request = { agentId: 1, messages: [message] } as AiSendRequest;
    expect(agent.id).toBe(1);
    expect(provider.id).toBe(2);
    expect(message.role).toBe('user');
    expect(event.type).toBe('checking');
    expect(request.agentId).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/shared/__tests__/sharedTypes.test.ts`

Expected: FAIL. The module `../agent-dto.js` cannot be resolved.

- [ ] **Step 3: Move the type modules and add re-exports**

```bash
mkdir -p src/shared
git mv src/types/agent-dto.ts src/shared/agent-dto.ts
git mv src/types/provider-dto.ts src/shared/provider-dto.ts
git mv src/types/chat.d.ts src/shared/chat.d.ts
git mv src/types/autoUpdate.d.ts src/shared/autoUpdate.d.ts
git mv src/types/ai-ipc.ts src/shared/ai-ipc.ts
```

`src/shared/ai-ipc.ts` already imports `./chat`. That relative import stays valid.

Write `src/types/agent-dto.ts`:

```ts
export type { AgentDTO, CreateAgentInput, UpdateAgentPatch } from '../shared/agent-dto.js';
```

Write `src/types/provider-dto.ts`:

```ts
export type {
  ModelCapability,
  ModelDTO,
  ProviderDTO,
  CreateProviderInput,
  UpdateProviderPatch,
  UpsertModelInput,
} from '../shared/provider-dto.js';
```

Write `src/types/chat.d.ts`:

```ts
export type {
  ChatSource,
  TextContentPart,
  ImageContentPart,
  ContentPart,
  Message,
} from '../shared/chat.js';
```

Write `src/types/autoUpdate.d.ts`:

```ts
export type { UpdateStatus, UpdateEvent } from '../shared/autoUpdate.js';
```

Write `src/types/ai-ipc.ts`:

```ts
export type {
  AiSendErrorCode,
  AiSendRequest,
  AiSendResult,
  AiTokenEvent,
  AiReasoningEvent,
  AiSourceEvent,
  AiDoneEvent,
  AiErrorEvent,
} from '../shared/ai-ipc.js';
```

Replace these import specifiers:

| File                                        | Old specifier                        | New specifier                         |
| ------------------------------------------- | ------------------------------------ | ------------------------------------- |
| `electron/ai/AIService.ts`                  | `../../src/types/chat.js`            | `../../src/shared/chat.js`            |
| `electron/ai/mapMessages.ts`                | `../../src/types/chat.js`            | `../../src/shared/chat.js`            |
| `electron/ai/resolveAgentForRun.ts`         | `../../src/types/agent-dto.js`       | `../../src/shared/agent-dto.js`       |
| `electron/ai/resolveAgentForRun.ts`         | `../../src/types/provider-dto.js`    | `../../src/shared/provider-dto.js`    |
| `electron/ai/__tests__/AIService.test.ts`   | `../../../src/types/agent-dto.js`    | `../../../src/shared/agent-dto.js`    |
| `electron/ai/__tests__/AIService.test.ts`   | `../../../src/types/provider-dto.js` | `../../../src/shared/provider-dto.js` |
| `electron/ai/__tests__/mapMessages.test.ts` | `../../../src/types/chat.js`         | `../../../src/shared/chat.js`         |
| `electron/ipc/registerAiIpc.ts`             | `../../src/types/chat.js`            | `../../src/shared/chat.js`            |

In `electron/services/AutoUpdateService.ts`, replace:

```ts
import { UpdateEvent } from '@/types/autoUpdate';
```

with:

```ts
import { UpdateEvent } from '../../src/shared/autoUpdate.js';
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/shared/__tests__/sharedTypes.test.ts electron/ai/__tests__/AIService.test.ts electron/ai/__tests__/mapMessages.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/shared src/types/agent-dto.ts src/types/provider-dto.ts src/types/chat.d.ts src/types/autoUpdate.d.ts src/types/ai-ipc.ts electron/ai electron/ipc/registerAiIpc.ts electron/services/AutoUpdateService.ts
git commit -m "$(cat <<'EOF'
refactor: move cross-process DTO types into src/shared

EOF
)"
```

---

### Task 2: Move the renderer under `src/renderer`

Do this before creating `src/main/`. The root `index.html` loads `/src/main.jsx`, which Vite resolves to `src/main.tsx`. A `src/main/` directory would steal that URL.

**Files:**

- Move: renderer files listed in the file map into `src/renderer/`
- Modify: `index.html`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`
- Modify: re-export specifiers from `../shared/` to `../../../shared/`
- Test: `npm test`

**Interfaces:**

- Consumes: Task 1 re-exports and `src/shared`.
- Produces: `@/` → `src/renderer`. `index.html` script is `/src/renderer/main.tsx`. Renderer tsconfig `include` is `src/renderer` and `src/shared`.

- [ ] **Step 1: Move the renderer files**

```bash
mkdir -p src/renderer
git mv src/App.tsx src/renderer/App.tsx
git mv src/main.tsx src/renderer/main.tsx
git mv src/index.css src/renderer/index.css
git mv src/vite-env.d.ts src/renderer/vite-env.d.ts
git mv src/assets src/renderer/assets
git mv src/components src/renderer/components
git mv src/hooks src/renderer/hooks
git mv src/i18n src/renderer/i18n
git mv src/pages src/renderer/pages
git mv src/services src/renderer/services
git mv src/stores src/renderer/stores
git mv src/styles src/renderer/styles
git mv src/types src/renderer/types
git mv src/utils src/renderer/utils
```

Leave `src/shared/` where Task 1 put it.

- [ ] **Step 2: Point the re-exports at `src/shared`**

In each file under `src/renderer/types/` that Task 1 created, replace `../shared/` with `../../../shared/`.

The five files are `agent-dto.ts`, `provider-dto.ts`, `chat.d.ts`, `autoUpdate.d.ts`, and `ai-ipc.ts`. `src/renderer/types/index.d.ts` keeps its `./agent-dto` style imports.

- [ ] **Step 3: Update the renderer entry and aliases**

In `index.html`, replace the script tag with:

```html
<script type="module" src="/src/renderer/main.tsx"></script>
```

In `vite.config.ts`, set the alias:

```ts
'@': path.resolve(__dirname, './src/renderer'),
```

Leave `input` as `path.resolve(__dirname, 'index.html')` and `outDir` as `dist`.

In `vitest.config.ts`, set the same alias:

```ts
'@': path.resolve(__dirname, './src/renderer'),
```

Leave the `include` globs and `setupFiles: ['./test/setup.ts']` unchanged.

Replace `tsconfig.json` `compilerOptions.paths` and `include`:

```json
"paths": {
  "@/*": ["src/renderer/*"]
},
```

```json
"include": ["src/renderer", "src/shared"],
```

Keep the existing `exclude` list and the `references` to `tsconfig.main.json` and `tsconfig.preload.json`.

- [ ] **Step 4: Run the renderer tests**

Run: `npm test`

Expected: PASS. Main-process tests still import `electron/**` and `../../main`. Those paths still exist.

- [ ] **Step 5: Commit**

```bash
git add index.html src vite.config.ts vitest.config.ts tsconfig.json
git commit -m "$(cat <<'EOF'
refactor: move the React app to src/renderer

EOF
)"
```

---

### Task 3: Move the main process under `src/main`

**Files:**

- Move: `electron/` → `src/main/`, `main.ts` → `src/main/index.ts`
- Create: `src/main/db/__tests__/migrate.test.ts` (write it at `electron/db/__tests__/migrate.test.ts` before the move)
- Modify: imports inside `src/main/index.ts`, shared import paths, tray dev paths, `resolveMigrationsFolder`
- Modify: `vite.config.main.ts`, `tsconfig.main.json`, `eslint.config.js`, `drizzle.config.ts`, `scripts/copy-assets.js`, `electron-builder.json`, `electron-builder-win.json`
- Modify: `src/main/__tests__/hotkeyFlow.test.ts` import
- Test: `src/main/db/__tests__/migrate.test.ts`

**Interfaces:**

- Consumes: `src/shared` from Task 1. Renderer layout from Task 2.
- Produces: main entry `src/main/index.ts`. Vite output remains `dist-electron/main.js`. Unpackaged migrations path is `path.join(process.cwd(), 'src/main/db/migrations')`. Packaged migrations path stays `path.join(resourcesPath, 'db-migrations')`. Unpackaged tray files are under `src/main/assets`. Packaged tray files stay `path.join(__dirname, 'electron/assets/...')`.

- [ ] **Step 1: Write the failing migration test**

Create `electron/db/__tests__/migrate.test.ts`:

```ts
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveMigrationsFolder } from '../migrate.js';

describe('resolveMigrationsFolder', () => {
  it('reads db-migrations from the packaged resources directory', () => {
    expect(resolveMigrationsFolder(true, '/Resources')).toBe(
      path.join('/Resources', 'db-migrations')
    );
  });

  it('reads migrations from src/main when unpackaged', () => {
    expect(resolveMigrationsFolder(false, '/Resources')).toBe(
      path.join(process.cwd(), 'src/main/db/migrations')
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run electron/db/__tests__/migrate.test.ts`

Expected: FAIL on the unpackaged assertion. The function still returns `electron/db/migrations`. The packaged assertion passes.

- [ ] **Step 3: Move the main tree**

```bash
git mv electron src/main
git mv main.ts src/main/index.ts
```

In `src/main/index.ts`, replace every `./electron/` import prefix with `./`. Do not add or remove `.js` suffixes on those lines.

Examples:

```ts
import SettingsService from './services/SettingsService';
import { openDatabase } from './db/client.js';
import { AIService } from './ai/AIService.js';
```

Apply that prefix change to every import that currently contains `./electron/`.

In `src/main/__tests__/hotkeyFlow.test.ts`, replace:

```ts
import { runSelectionHelper } from '../../main';
```

with:

```ts
import { runSelectionHelper } from '../index';
```

Replace shared import prefixes now that the files live under `src/main`:

| File                                        | Old prefix             | New prefix         |
| ------------------------------------------- | ---------------------- | ------------------ |
| `src/main/ai/AIService.ts`                  | `../../src/shared/`    | `../../shared/`    |
| `src/main/ai/mapMessages.ts`                | `../../src/shared/`    | `../../shared/`    |
| `src/main/ai/resolveAgentForRun.ts`         | `../../src/shared/`    | `../../shared/`    |
| `src/main/ai/__tests__/AIService.test.ts`   | `../../../src/shared/` | `../../../shared/` |
| `src/main/ai/__tests__/mapMessages.test.ts` | `../../../src/shared/` | `../../../shared/` |
| `src/main/ipc/registerAiIpc.ts`             | `../../src/shared/`    | `../../shared/`    |
| `src/main/services/AutoUpdateService.ts`    | `../../src/shared/`    | `../../shared/`    |

- [ ] **Step 4: Update dev readers and keep packaged readers**

In `src/main/db/migrate.ts`, set the unpackaged branch to:

```ts
export function resolveMigrationsFolder(isPackaged: boolean, resourcesPath: string): string {
  return isPackaged
    ? path.join(resourcesPath, 'db-migrations')
    : path.join(process.cwd(), 'src/main/db/migrations');
}
```

Use the single literal `src/main/db/migrations`. The package check looks for that string in `dist-electron/main.js`.

In `src/main/index.ts`, change each unpackaged tray path to a `src/main/assets` literal. Leave each packaged path as an `electron/assets` literal.

Darwin and the final `else` branch, both occurrences:

```ts
const trayIconPath = isDev()
  ? path.join(__dirname, '..', 'src/main/assets/mind_tray_macos_Template.png')
  : path.join(__dirname, 'electron/assets/mind_tray_macos_Template.png');
```

Windows branch:

```ts
return isDev()
  ? path.join(__dirname, '..', 'src/main/assets', iconName)
  : path.join(__dirname, 'electron', 'assets', iconName);
```

Do not change `resourcesPath`, `path.join(__dirname, 'preload.js')`, or `path.join(__dirname, '..', 'dist', 'index.html')`.

Change the macOS helper join so the bundle contains the literal `helper/selectedtext`:

```ts
const helperPath =
  process.platform === 'win32'
    ? path.join(resourcesPath, 'helper', 'SelectedTextWin.exe')
    : path.join(resourcesPath, 'helper/selectedtext');
```

`path.join` accepts that slash on macOS and Windows. The packaged file is still `Contents/Resources/helper/selectedtext`.

- [ ] **Step 5: Update build configs**

`vite.config.main.ts`: delete the `resolve.alias` block. Set the lib entry to `src/main/index.ts`. Keep `outDir: 'dist-electron'`, `fileName: () => 'main.js'`, and `entryFileNames: 'main.js'`.

```ts
export default defineConfig({
  build: {
    outDir: 'dist-electron',
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, 'src/main/index.ts'),
      formats: ['es'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      external: [
        'electron',
        'electron-log',
        'electron-log/main',
        'electron-log/renderer',
        'better-sqlite3',
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
      output: {
        entryFileNames: 'main.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    target: 'node22',
    minify: false,
  },
});
```

Remove the unused `resolve` import usage. Keep `import path from 'node:path'` and `import { builtinModules } from 'node:module'`.

Replace `tsconfig.main.json` `include` and delete `paths`:

```json
"include": ["src/main", "src/shared"]
```

Do not include `src/preload` or `preload.ts`.

In `eslint.config.js`, replace the main/preload `files` array with:

```js
files: ['src/main/**/*.{ts,tsx,js}', 'src/preload/**/*.{ts,tsx,js}'],
```

`drizzle.config.ts`:

```ts
schema: './src/main/db/schema.ts',
out: './src/main/db/migrations',
```

`scripts/copy-assets.js`: change `sourceDir` only.

```js
const sourceDir = path.join(__dirname, '../src/main/assets');
```

Leave `targetDir` as `path.join(__dirname, '../dist-electron/electron/assets')`.

`electron-builder.json`:

```json
"from": "src/main/db/migrations",
```

```json
"icon": "src/main/assets/snap-mind-app-icon-macOS.png",
```

Keep `"to": "db-migrations"`, the helper `from`/`to`, `settings.default.json`, and `mac.binaries`.

`electron-builder-win.json`:

```json
"from": "src/main/db/migrations",
```

```json
"icon": "src/main/assets/snap-mind-app-icon-Win.ico",
```

Keep every helper `to` value and `"to": "db-migrations"`.

In `README.md` and `README.zh.md`, replace `./electron/assets/snap-mind-app-icon-macOS.png` with `./src/main/assets/snap-mind-app-icon-macOS.png`.

- [ ] **Step 6: Run the tests and the main build**

Run: `npx vitest run src/main/db/__tests__/migrate.test.ts src/main/__tests__/hotkeyFlow.test.ts`

Expected: PASS

Run: `npm test`

Expected: PASS

Run: `npx vite build -c vite.config.main.ts`

Expected: writes `dist-electron/main.js`. Then:

```bash
grep -q 'src/main/db/migrations' dist-electron/main.js
grep -q 'src/main/assets' dist-electron/main.js
grep -q 'db-migrations' dist-electron/main.js
grep -q 'helper/selectedtext' dist-electron/main.js
```

Expected: each `grep` exits 0.

- [ ] **Step 7: Commit**

```bash
git add src/main vite.config.main.ts tsconfig.main.json eslint.config.js drizzle.config.ts scripts/copy-assets.js electron-builder.json electron-builder-win.json README.md README.zh.md
git commit -m "$(cat <<'EOF'
refactor: move the Electron main process to src/main

EOF
)"
```

---

### Task 4: Move preload and keep `dist-electron/preload.js`

**Files:**

- Move: `preload.ts` → `src/preload/preload.ts`
- Modify: `tsconfig.preload.json`
- Test: `tsc -p tsconfig.preload.json` output path

**Interfaces:**

- Consumes: the current `preload.ts` source. It imports only `electron`.
- Produces: `dist-electron/preload.js` beside `dist-electron/main.js`. `rootDir` is `src/preload`.

- [ ] **Step 1: Move the file and set `rootDir`**

```bash
mkdir -p src/preload
git mv preload.ts src/preload/preload.ts
```

Replace `tsconfig.preload.json` `compilerOptions` fields that control emit, and replace `include`:

```json
"rootDir": "src/preload",
"outDir": "dist-electron",
```

```json
"include": ["src/preload/preload.ts"]
```

Keep `"module": "CommonJS"` and `"moduleResolution": "node"`. Delete the `paths` block. The preload file does not use `@/`.

- [ ] **Step 2: Compile and check the output path**

```bash
rm -rf dist-electron
npx tsc -p tsconfig.preload.json
test -f dist-electron/preload.js
test ! -f dist-electron/src/preload/preload.js
```

Expected: `dist-electron/preload.js` exists. The nested path does not exist.

- [ ] **Step 3: Commit**

```bash
git add src/preload tsconfig.preload.json
git commit -m "$(cat <<'EOF'
refactor: compile preload from src/preload to dist-electron/preload.js

EOF
)"
```

---

### Task 5: Verify the production build and the macOS package

**Files:**

- Test only, unless a path check fails. A failed check is fixed in the file that owns that path, then this task is re-run.

**Interfaces:**

- Consumes: Tasks 1–4.
- Produces: a macOS `.app` whose resource paths match the spec §4 table.

- [ ] **Step 1: Run unit tests and the three build targets**

```bash
npm test
npm run build
test -f dist-electron/main.js
test -f dist-electron/preload.js
test -f dist/index.html
```

Expected: tests pass and all three files exist.

- [ ] **Step 2: Build the macOS app**

```bash
./build.sh
```

Expected: electron-builder writes `build/mac-arm64/SnapMind.app` or `build/mac-x64/SnapMind.app`.

If `./build.sh` exits non-zero, continue only when both of these are true:

- The log shows notarization failed because Apple credentials are missing.
- The `.app` directory exists.

Any other failure stops this task. Fix the build and run `./build.sh` again.

- [ ] **Step 3: Inspect packaged paths**

```bash
APP=$(find build -type d -name 'SnapMind.app' | head -n 1)
test -n "$APP"
test -x "$APP/Contents/Resources/helper/selectedtext"
test -f "$APP/Contents/Resources/settings.default.json"
test -n "$(find "$APP/Contents/Resources/db-migrations" -name '*.sql' -print -quit)"
ASAR=$(find node_modules -path '*@electron/asar/bin/asar.js' -print -quit)
test -n "$ASAR"
node "$ASAR" list "$APP/Contents/Resources/app.asar" | grep -qx 'dist/index.html'
node "$ASAR" list "$APP/Contents/Resources/app.asar" | grep -qx 'dist-electron/main.js'
node "$ASAR" list "$APP/Contents/Resources/app.asar" | grep -qx 'dist-electron/preload.js'
node "$ASAR" list "$APP/Contents/Resources/app.asar" | grep -qx 'dist-electron/electron/assets/mind_tray_macos_Template.png'
grep -q 'db-migrations' dist-electron/main.js
grep -q 'settings.default.json' dist-electron/main.js
grep -q 'helper/selectedtext' dist-electron/main.js
grep -q 'src/main/assets' dist-electron/main.js
grep -q 'src/main/db/migrations' dist-electron/main.js
```

Expected: every command exits 0.

`settings.default.json` is read from `process.resourcesPath` at runtime. The string check confirms the reader is still in the bundle. The file check confirms the builder copied it.

- [ ] **Step 4: Commit a fix only if Step 3 required one**

If the tree is clean, do not create an empty commit.

```bash
git add -u
git commit -m "$(cat <<'EOF'
fix: keep packaged resource paths after the source move

EOF
)"
```

---

### Task 6: Write the agent rule and update `CLAUDE.md`

**Files:**

- Create: `.cursor/rules/source-layout.mdc`
- Modify: `CLAUDE.md`
- Modify: `.cursor/skills/icon-usage/SKILL.md`

**Interfaces:**

- Consumes: the layout verified in Task 5.
- Produces: an always-on Cursor rule and a `CLAUDE.md` whose paths match the tree.

- [ ] **Step 1: Add the Cursor rule**

Create `.cursor/rules/source-layout.mdc`:

```markdown
---
description: SnapMind source folders and packaged path contract
alwaysApply: true
---

# Source layout

Put new TypeScript in one of these folders:

- `src/main/` — Electron main process. Entry: `src/main/index.ts`.
- `src/preload/` — preload only. Source file: `src/preload/preload.ts`.
- `src/renderer/` — React app. `@/` maps to this folder.
- `src/shared/` — pure types and pure functions. No `electron`, Node built-ins, React, or DOM.

The renderer reaches the system only through `window.electronAPI`.

Keep the `.js` suffix on main-process relative imports.

Put unit tests in `__tests__/` next to the source.

# Packaged paths

These installed paths stay stable:

- `Contents/Resources/helper/selectedtext`
- `Contents/Resources/settings.default.json`
- `Contents/Resources/db-migrations`
- `app.asar/dist-electron/main.js`
- `app.asar/dist-electron/preload.js`
- `app.asar/dist/index.html`
- `app.asar/dist-electron/electron/assets/`

Dev readers use `src/main/assets` and `src/main/db/migrations`. A change to an electron-builder `from` path updates the matching dev reader and the package check in the same change.

`helper/`, `settings.default.json`, and `config/entitlements/` stay at the repo root.
```

- [ ] **Step 2: Update living docs**

In `.cursor/skills/icon-usage/SKILL.md`, replace every `src/components/Icon.tsx` with `src/renderer/components/Icon.tsx`.

In `CLAUDE.md`, apply these replacements first, once each:

| Old                               | New                                      |
| --------------------------------- | ---------------------------------------- |
| `` `@/` alias maps to `src/` ``   | `` `@/` alias maps to `src/renderer/` `` |
| `both \`electron/\` and \`src/\`` | `\`src/main/\` and \`src/renderer/\``    |
| `main.ts + electron/**/*.ts`      | `src/main/**/*.ts`                       |
| ``renderer (`src/`)``             | ``renderer (`src/renderer/`)``           |
| `main.ts:`                        | `src/main/index.ts:`                     |
| `src/pages/`                      | `src/renderer/pages/`                    |
| `src/components/Icon.tsx`         | `src/renderer/components/Icon.tsx`       |
| `src/stores/`                     | `src/renderer/stores/`                   |
| `src/services/LoggerService.ts`   | `src/renderer/services/LoggerService.ts` |
| `` `preload.ts` ``                | `` `src/preload/preload.ts` ``           |
| `` in `src/` ``                   | `` in `src/renderer/` ``                 |

Then replace every remaining `electron/` with `src/main/`. Do not change `electron-builder`, `electron-updater`, or `electron-log`.

After the replacements, add this sentence to the "Three TypeScript build targets" section:

```markdown
`src/shared/` holds pure DTO types used by main and the renderer. It must not import Node, Electron, React, or DOM types.
```

Add this sentence to the persistence section, after the migrations bullet:

```markdown
Unpackaged runs read migrations from `src/main/db/migrations`. Packaged runs read `Contents/Resources/db-migrations`. Tray icons are copied to `dist-electron/electron/assets` and stay at that path inside `app.asar`.
```

- [ ] **Step 3: Check the docs for stale source paths**

```bash
grep -n 'electron/\|`main.ts`\|`preload.ts`\|src/components/Icon' CLAUDE.md .cursor/skills/icon-usage/SKILL.md || true
```

Expected: the only `electron/` hit is `dist-electron/electron/assets` in `CLAUDE.md`. No `` `main.ts` ``, `` `preload.ts` ``, or `src/components/Icon` hits.

- [ ] **Step 4: Commit**

```bash
git add .cursor/rules/source-layout.mdc .cursor/skills/icon-usage/SKILL.md CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: record the src process layout and packaged path contract

EOF
)"
```
