# Agent loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an optional controller/worker agent loop in main, behind a `ModelRuntime` wall, with state-driven chat UI. No chat persistence, no filesystem/MCP tools.

**Architecture:** `AgentRun` talks only to `ModelRuntime.stream()` and our `RunEvent` union. `AiSdkRuntime` is the only streaming `ai` import. A root Default run with the loop on gets a per-run `invoke_agent` tool listing the worker agents. Children never get it. Main tags every event with `runId` / `parentRunId` / `parentToolCallId`. The renderer reduces events into `Message.content` (text) and `Message.parts` (tools).

**Tech Stack:** Electron main ESM, React 19 + Zustand, Vitest (jsdom), `ai` 7.0.173 behind the adapter, HeroUI **v2 only**.

**Spec:** [`docs/superpowers/specs/2026-11-17-agent-loop-design.md`](../specs/2026-11-17-agent-loop-design.md). Every type named below is defined there. Copy it verbatim.

## Global Constraints

- Read the spec first. Do not implement filesystem tools, MCP/skill UI, hooks marketplace, persisted permission rules, permission-mode UI, or chat SQLite.
- Node `>=24 <25`. Native ESM. Main-process relative imports keep `.js` suffixes. Kebab-case module files, PascalCase classes and components.
- `src/shared/` stays free of Electron, Node, React, DOM.
- `ai` / `@ai-sdk/*` / `ollama-ai-provider-v2` imports are allowed only in `runtime/ai-sdk-runtime.ts`, `runtime/map-messages.ts`, `providers/create-language-model.ts`, and tests under `runtime/__tests__/` and `providers/__tests__/` (all under `src/main/ai/`).
- Icons only through `src/renderer/components/Icon.tsx` (alphabetical `IconType`).
- Never log API keys. Pass logged objects through `redactValue` (`src/main/ai/redact.ts`).
- Do not bump app `version`. Never `npm install @heroui/react@latest`. Do not bump `drizzle-orm` / `drizzle-kit`. Skip `electron-builder@27`.
- `PERMISSION_MODE = 'default'`, `MAX_STEPS = 10`.
- **Clean tree before each task.** The husky pre-commit hook runs `npm run format` then `git add -u`, so it stages every modified tracked file. Before each commit, run `git status`. If formatting touched unrelated files, run `git restore` on them and recommit.
- Every task's gate: `npx vitest run`, `npm run lint`, `npx tsc -p tsconfig.main.json --noEmit`, `npx tsc -p tsconfig.preload.json --noEmit`, `npx tsc -p tsconfig.json --noEmit`. All must pass before commit. (Below, "**Gate**" means this list.)
- Conventional Commits. One commit per task.

## Review Focus

1. **A new send, or a hotkey, while a worker is running** must stop both root and child, and no late child token may land in the new conversation. Tests: Task 13 `send aborts every open run`, Task 15 `ignores events from stale runs`.
2. **The controller calls** `invoke_agent` **with an unknown or builtin id** → a tool error result, and the parent keeps streaming. Test: Task 11 `rejects agentId outside the roster`.
3. **An abort while an approval is pending** must not hang. The pending decision resolves `deny`, and a late `ai:approval-response` is ignored. Tests: Task 9 `cancelRun resolves pending as deny`, `respond on unknown id returns false`; Task 10 `abort cancels pending approval`.
4. **Default agent, loop on, no worker agents** must be byte-for-byte today's one-shot call (`tools: []`). Test: Task 10 `controller with no workers streams with no tools`.
5. **A worker failure** (unbound model, no API key, provider error) must reach the controller as a tool error and show `output-error` on the SubRunBlock, with no crash. Tests: Task 11 `child error becomes thrown tool error`, Task 15 `child error marks subRun error`.

---

### Task 1: Cluster A — AI SDK 7.0.173

**Files:** Modify `package.json`, `package-lock.json`.

Note: local `node_modules` may already contain these versions while `package.json` and `package-lock.json` still list the old ranges. Steps 1–4 write the versions into both files.

- [ ] **Step 1: Bump**

```bash
npm install ai@7.0.173 @ai-sdk/openai@4.0.118 @ai-sdk/anthropic@4.0.105 \
  @ai-sdk/google@4.0.121 @ai-sdk/azure@4.0.126 @ai-sdk/openai-compatible@3.0.92 \
  ollama-ai-provider-v2@4.1.0
npm ls zod --all | grep -o 'zod@[0-9]*' | sort -u
```

Expected: one major (`zod@4`). If two majors appear, run `npm install ollama-ai-provider-v2@4.0.1`.

- [ ] **Step 2: Gate +** `npm run build`**.** Deprecation warnings for `fullStream` are expected. Leave them (Task 12 switches to `stream`).

- [ ] **Step 3: Commit** `chore(deps): bump ai 7.0.173 and matching @ai-sdk providers` (`package.json package-lock.json`).

---

### Task 2: Cluster B — React 19.3, HeroUI v2

**Files:** Modify `package.json`, `package-lock.json`.

- [ ] **Step 1:** `npm install react@19.3.1 react-dom@19.3.1 && npm install -D @types/react@19 @types/react-dom@19`. Optional: `npm install @heroui/react@2.8.10`.
- [ ] **Step 2: Gate.**
- [ ] **Step 3: Commit** `chore(deps): bump react 19.3; keep heroui v2`.

---

### Task 3: Cluster C — Vite 8 + Vitest 5

**Files:** Modify `package.json`, `package-lock.json`. Touch `vite.config.ts`, `vite.config.main.ts`, `vitest.config.ts` only if the gate fails on a renamed option.

- [ ] **Step 1:** `npm install -D vite@8.3.8 @vitejs/plugin-react@6.3.0 vitest@5.1.0 @vitest/ui@5.1.0 @vitest/coverage-v8@5.1.0`. Keep `overrides.esbuild` at `0.28.2`.
- [ ] **Step 2: Gate +** `npm run build`**.** If a Vitest config key fails, fix it per Vitest 5 docs. `environment: 'jsdom'` stays. Do not edit test assertions.
- [ ] **Step 3: Commit** `chore(deps): bump vite 8, plugin-react 6, vitest 5`.

---

### Task 4: Cluster D — Electron 45 + electron-builder 26.18

**Files:** Modify `package.json`, `package-lock.json`.

- [ ] **Step 1:** `npm install -D electron@45.3.3 electron-builder@26.18.0 @types/node@24 && npm run db:rebuild`. If the rebuild fails, run `npm install better-sqlite3@13.2.0 && npm run db:rebuild`.
- [ ] **Step 2: Gate +** `npm run build`**.**
- [ ] **Step 3: Commit** `chore(deps): bump electron 45 and electron-builder 26.18`.

---

### Task 5: Split `src/main/ai/` folders (move only) + break the import cycle

**Files:**

- `git mv` `create-language-model.ts`, `url-resolvers.ts` → `src/main/ai/providers/`, and their tests → `src/main/ai/providers/__tests__/`
- `git mv` `map-messages.ts` → `src/main/ai/runtime/map-messages.ts`, and its test → `src/main/ai/runtime/__tests__/`
- `git mv` `map-params.ts` → `src/main/ai/mapping/map-params.ts`, and its test → `src/main/ai/mapping/__tests__/`
- Modify: `src/main/ai/ai-service.ts`, `src/main/index.ts`, `src/main/ai/resolve-agent-for-run.ts`, moved tests (relative paths, `.js` suffixes)

**Interfaces:** same exports, new paths. `resolve-agent-for-run.ts` imports `AiSendErrorCode` from `../../shared/ai-ipc.js` (not from `./ai-service.js`), which removes the cycle before `ai-service` moves in Task 13.

- [ ] **Step 1:** Make the moves and fix the imports.
- [ ] **Step 2:** `npx vitest run src/main/ai` → PASS.
- [ ] **Step 3: Gate.**
- [ ] **Step 4: Commit** `refactor(ai): split providers, runtime, and mapping folders`.

---

### Task 6: Runtime types + `ModelRuntime` + permission table

**Files:**

- Create: `src/main/ai/runtime/types.ts`, `src/main/ai/runtime/model-runtime.ts` (copy from spec "Runtime types")
- Create: `src/main/ai/permission/modes.ts`, `src/main/ai/permission/policy.ts`
- Test: `src/main/ai/permission/__tests__/policy.test.ts`

**Interfaces (produces):**

```typescript
// modes.ts
export type Risk = 'safe' | 'moderate' | 'dangerous';
export type Mode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions' | 'dontAsk';
export type Decision = 'allow' | 'deny' | 'ask';
export const MODE_TABLE: Record<Mode, Record<Risk, Decision>>;
export const PERMISSION_MODE: Mode; // 'default'
// policy.ts
export function checkPermission(_toolName: string, risk: Risk, mode: Mode): Decision;
```

- [ ] **Step 1: Write a failing table test.** Use `it.each` over all 15 rows of the spec table, e.g. `['dontAsk','moderate','deny']`, `['acceptEdits','dangerous','ask']`. Also add `PERMISSION_MODE is default`.
- [ ] **Step 2:** `npx vitest run src/main/ai/permission` → FAIL (module missing).
- [ ] **Step 3:** Implement `MODE_TABLE` and `checkPermission` as a table lookup.
- [ ] **Step 4:** Run → PASS. **Gate.**
- [ ] **Step 5: Commit** `feat(ai): add ModelRuntime types and permission table`.

---

### Task 7: ToolRegistry

**Files:** Create `src/main/ai/tools/registry.ts`. Test `src/main/ai/tools/__tests__/registry.test.ts`.

**Interfaces:** `ToolContext`, `ToolDef`, `ToolRegistry` exactly as in spec "ToolRegistry". Consumes `Risk` (Task 6) and `JsonSchema` (Task 6).

- [ ] **Step 1: Failing tests:**
  - `register then list returns the def` (`translate`)
  - `get returns undefined for unknown name`
  - `rejects the reserved name invoke_agent`: `expect(() => r.register({...def, name: 'invoke_agent'})).toThrow(/reserved/)`
  - `rejects duplicate names`: `toThrow(/already registered/)`
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement with a `Map<string, ToolDef>`. `list()` returns insertion order.
- [ ] **Step 4:** Run → PASS. **Gate.**
- [ ] **Step 5: Commit** `feat(ai): add ToolRegistry with reserved invoke_agent`.

---

### Task 8: SessionTree

**Files:** Create `src/main/ai/run/session-tree.ts`. Test `src/main/ai/run/__tests__/session-tree.test.ts`.

**Interfaces:** `SessionNode`, `SessionTree` exactly as in spec.

- [ ] **Step 1: Failing tests:**
  - `createRoot stores node with parentId null`
  - `addChild links child under parent`: `tree.get('root').children[0].id === 'c1'` and `tree.get('c1').parentId === 'root'`
  - `addChild throws for unknown parent`
  - `appendAssistant pushes { role: 'assistant', content: text }`
  - `clear drops all nodes`: `tree.get('root')` is `undefined`
- [ ] **Step 2–4:** FAIL → implement (index nodes in a `Map<string, SessionNode>`) → PASS. **Gate.**
- [ ] **Step 5: Commit** `feat(ai): add in-memory SessionTree`.

---

### Task 9: RunRegistry + ApprovalBroker

**Files:** Create `src/main/ai/run/run-registry.ts` and `src/main/ai/run/approval-broker.ts`. Tests `src/main/ai/run/__tests__/run-registry.test.ts` and `approval-broker.test.ts`.

**Interfaces:** `RunRegistry`, `ApprovalBroker` exactly as in spec "Run lifecycle". Broker ids come from `crypto.randomUUID()`.

- [ ] **Step 1: Failing tests:**
  - RunRegistry: `abort parent aborts child signal`, `abort child leaves parent signal`, `abortAll aborts every open run`, `close removes run (isOpen false)`, `open child of an already-aborted parent returns an aborted signal`, `abort unknown id is a no-op`
  - ApprovalBroker: `respond true resolves allow`, `respond false resolves deny`, `respond on unknown id returns false`, `cancelRun resolves pending as deny` (and leaves other runs' requests pending)
- [ ] **Step 2–4:** FAIL → implement (registry: `Map<runId, { controller, parentRunId }>`, child links by adding an `abort` listener on the parent signal; broker: `Map<requestId, { runId, resolve }>`) → PASS. **Gate.**
- [ ] **Step 5: Commit** `feat(ai): add RunRegistry and ApprovalBroker`.

---

### Task 10: AgentRun on a fake ModelRuntime

**Files:** Create `src/main/ai/run/agent-run.ts`. Test `src/main/ai/run/__tests__/agent-run.test.ts`.

**Interfaces:**

- Consumes: `ModelRuntime`, `RunEvent`, `RunRef`, `StreamRequest` (Task 6); `checkPermission`, `PERMISSION_MODE` (Task 6); `ToolRegistry`, `ToolDef` (Task 7); `SessionTree` (Task 8); `ApprovalBroker` (Task 9); `mapParams` (Task 5).
- Produces: `ResolvedTarget`, `RunOutcome`, `StartRunInput`, `AgentRun` exactly as in spec "Run lifecycle".

Build `StreamRequest` as follows. `model = { provider: { kind, apiKey, host: host ?? '', apiVersion: apiVersion ?? null }, modelId: model.modelId }`. `params` comes from `mapParams(agent)` (drop `webSearch`). `instructions` = trimmed agent instructions, or `undefined`. `maxSteps = MAX_STEPS` (export `MAX_STEPS = 10` from this file).

Test helper: `fakeRuntime(script: RunEvent[] | ((req) => AsyncIterable<RunEvent>))` records each `StreamRequest`.

- [ ] **Step 1: Failing tests:**
  - `loop off streams with no tools`: `req.tools` equals `[]` and `req.onApprove` is `undefined`
  - `controller with no workers streams with no tools`: builtin agent, loop on, `makeInvokeAgentTool` → `null`, empty registry → `req.tools` is `[]`
  - `controller gets invoke_agent when roster non-empty`: tool names `['invoke_agent']`
  - `child run never gets invoke_agent`: `parentRunId: 'p'`, builtin agent, loop on → `makeInvokeAgentTool` not called
  - `non-builtin root never gets invoke_agent`
  - `passes generation params`: `req.params` equals `{ temperature: 0.7, maxOutputTokens: 2048, topP: 0.95, reasoning: false }` and `req.maxSteps === 10`
  - `forwards events tagged with RunRef and returns accumulated text`: script `text-delta 'a'`, `text-delta 'b'`, `done stop` → outcome `{ status: 'stop', text: 'ab' }`, and `onEvent` receives the ref on each event
  - `missing terminal event emits done`
  - `onApprove: safe tool allows without broker`
  - `onApprove: moderate tool emits approval-request and waits for broker` (respond `true` → `'allow'`)
  - `abort cancels pending approval`: abort the signal while waiting → the decision resolves `'deny'`
  - `bound tool execute receives runId in ctx`
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `AgentRun.start` per the spec bullets.
- [ ] **Step 4:** Run → PASS. **Gate.**
- [ ] **Step 5: Commit** `feat(ai): add AgentRun on ModelRuntime`.

---

### Task 11: `invoke_agent`

**Files:** Create `src/main/ai/tools/invoke-agent.ts`. Test `src/main/ai/tools/__tests__/invoke-agent.test.ts`.

**Interfaces:** `createInvokeAgentTool(deps)` exactly as in spec. Consumes `RunRegistry`, `SessionTree`, `StartRunInput`, `RunOutcome`, `ResolvedTarget`.

Description format (exact):

```
Delegate a task to another saved agent and get its reply as text. Call one agent at a time.
Available agents:
- <id>: <name> — <description or "no description">
```

- [ ] **Step 1: Failing tests:**
  - `returns null when no workers`
  - `lists workers in description and enum`: `def.inputSchema.properties.agentId.enum` equals `[2, 3]`, the description contains `- 2: Translator — Translates text`, and `def.risk === 'safe'`
  - `rejects agentId outside the roster`: `await expect(def.execute({ agentId: 1, prompt: 'x' }, ctx)).rejects.toThrow(/not available/)`
  - `starts child with parent links and returns text`: `startChild` called with `parentRunId: ctx.runId`, `parentToolCallId: ctx.toolCallId`, `loopEnabled: true`, `messages: [{ role: 'user', content: 'hi' }]` → resolves `'done text'`; the tree has the child under the parent
  - `child error becomes thrown tool error` (`/no API key/`)
  - `child abort throws Worker run was aborted.`
  - `closes child run even when child throws`: `runs.isOpen(childId) === false`
  - `aborting parent signal aborts child signal` (real `RunRegistry`)
- [ ] **Step 2–4:** FAIL → implement → PASS. **Gate.**
- [ ] **Step 5: Commit** `feat(ai): add invoke_agent tool with worker roster`.

---

### Task 12: `AiSdkRuntime` adapter

**Files:** Create `src/main/ai/runtime/ai-sdk-runtime.ts`. Test `src/main/ai/runtime/__tests__/ai-sdk-runtime.test.ts`.

**Interfaces:**

- `export type StreamTextLike = (opts: Record<string, unknown>) => { stream: AsyncIterable<unknown> };`
- `export class AiSdkRuntime implements ModelRuntime { constructor(deps: { streamText: StreamTextLike; createLanguageModel: typeof createLanguageModel }) }`
- Uses `tool`, `jsonSchema`, `isStepCount` from `ai`. Implements the spec "AiSdkRuntime" mapping table.

Fake `streamText`: `vi.fn(() => ({ stream: (async function* () { yield* parts })() }))`.

- [ ] **Step 1: Failing tests:**
  - `maps text, reasoning and source parts` → `[text-delta 'hi', reasoning-delta 'r', source {url,title}, done stop]`
  - `empty tools omits tools, stopWhen and toolApproval` (inspect `streamText` call options)
  - `non-empty tools passes tools record, stopWhen and toolApproval`. The record keys equal the tool names. Calling `opts.tools.t1.execute({a:1}, { toolCallId: 'c', abortSignal })` reaches the `RuntimeTool.execute`.
  - `toolApproval returns approved/denied from onApprove`: call `opts.toolApproval({ toolCall: { toolCallId:'c', toolName:'t1', input:{} } })` → `'approved'` for allow and `'denied'` for deny
  - `maps tool-call, tool-result, tool-error and tool-output-denied`; tool-error output is a string, and `isError` is `true` for the last two
  - `error part yields error with describeAiError and stops`
  - `abort part yields done aborted`
  - `thrown error after abort yields done aborted`, `thrown error otherwise yields error`
  - `createLanguageModel throwing yields error 'Unknown provider kind: x'`
  - `passes params, instructions, abortSignal and mapped messages` (system/error roles dropped)
- [ ] **Step 2–4:** FAIL → implement → PASS. **Gate.**
- [ ] **Step 5: Commit** `feat(ai): wrap AI SDK behind AiSdkRuntime`.

---

### Task 13: AIService on AgentRun + wiring + import wall

**Files:**

- `git mv src/main/ai/ai-service.ts src/main/ai/run/ai-service.ts`, and the test → `src/main/ai/run/__tests__/ai-service.test.ts` (rewrite)
- Modify: `src/main/index.ts` (construct `AiSdkRuntime({ streamText, createLanguageModel })` and `ToolRegistry`; drop the `ai` import), `src/main/ipc/register-ai-ipc.ts` (import path, plus a temporary adapter that maps `onEvent` to today's channels using `streamId: ref.runId` for root events only; Task 14 replaces it), `eslint.config.js`

**Interfaces:**

- `AIService` exactly as in spec. Wire `makeInvokeAgentTool` with `createInvokeAgentTool({ listWorkers, runs, tree, startChild: (i) => agentRun.start(i), newRunId: () => crypto.randomUUID(), parent })`. `listWorkers` = agents where `!isBuiltin` and `resolveAgentForRun` returns ok.
- Until Task 14, `AiSendResult` keeps the shape `{ streamId }`. `send` returns `{ streamId: runId }`. Add `loopEnabled?: boolean` (optional) to the shared `AiSendRequest` now; `AIService` treats a missing value as `false`. Task 14 makes it required.
- ESLint: add to the main/preload block and the TS block:

```js
'no-restricted-imports': ['error', { patterns: [{ group: ['ai', '@ai-sdk/*', 'ollama-ai-provider-v2'], message: 'Import the AI SDK only inside src/main/ai/runtime or providers.' }] }],
```

and a later override block turning it `'off'` for `src/main/ai/runtime/ai-sdk-runtime.ts`, `src/main/ai/runtime/map-messages.ts`, `src/main/ai/providers/create-language-model.ts`, `src/main/ai/runtime/__tests__/**`, `src/main/ai/providers/__tests__/**`.

- [ ] **Step 1: Failing tests (fake** `ModelRuntime`**; use** `vi.useFakeTimers()` **or** `await new Promise(setImmediate)` **to flush the start):**
  - `resolve failure returns error code and starts nothing` (`no-api-key`)
  - `returns runId before the first event`: `onEvent` not called synchronously before `send` resolves
  - `send aborts every open run`: the first send's runtime signal is aborted once the second send is called
  - `abort(rootId) aborts active child`; `abort(childId) leaves root running`
  - `respondApproval resolves a pending broker request`
  - `controller invokes worker A then B then A`: the parent fake yields three `invoke_agent` tool calls by calling the bound `execute` sequentially; the child fake returns `'A'`/`'B'`; outputs are `['A','B','A']`
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement, wire `index.ts`, add the ESLint rule.
- [ ] **Step 4:** Run → PASS. **Gate** (lint must pass with the new rule). Then confirm the wall:

```bash
rg -l "from '(ai|@ai-sdk/[^']+|ollama-ai-provider-v2)'" src
```

Expected: only the five allowed locations from Global Constraints.

- [ ] **Step 5: Commit** `feat(ai): run chats through AgentRun with isolated aborts`.

---

### Task 14: IPC contract `streamId` → `runId` (main + preload + store, one task)

**Files:**

- Modify: `src/shared/ai-ipc.ts`, `src/shared/__tests__/sharedTypes.test.ts`, `src/renderer/types/ai-ipc.ts` (re-export new types), `src/renderer/types/index.d.ts`, `src/preload/preload.ts`, `src/main/ipc/register-ai-ipc.ts`, `src/main/ai/run/ai-service.ts`, `src/renderer/stores/useChatStore.ts`, `src/renderer/stores/__tests__/useChatStore.test.ts`
- Test: `src/main/ipc/__tests__/register-ai-ipc.test.ts` (create; mock `electron`'s `ipcMain`)

**Interfaces (produces):** the spec "IPC" section. `AiRunRef`; `AiSendRequest` adds `loopEnabled: boolean`; `AiSendResult = { runId } | { error }`; event types `AiTokenEvent`, `AiReasoningEvent`, `AiSourceEvent`, `AiToolCallEvent`, `AiApprovalRequestEvent`, `AiToolResultEvent`, `AiDoneEvent`, `AiErrorEvent`, each `AiRunRef & {...}`; `AiApprovalResponse = { requestId: string; approved: boolean }`. The preload adds `aiRespondApproval(res)`, `onAiToolCall`, `onAiApprovalRequest`, `onAiToolResult` and the `off`\* counterparts. `aiAbort(runId: string)`.

In this task the store only renames `streamId` → `runId` (`currentRunId`, state `runId`) and sends `loopEnabled: false`. Tool events are handled in Task 15.

- [ ] **Step 1: Failing tests:**
  - register-ai-ipc: `maps each RunEvent type to its channel with AiRunRef` (8 cases), `ai:approval-response calls respondApproval`, `ai:abort passes runId`
  - useChatStore: existing tests updated to `runId`; add `ignores token events whose runId is not current`
- [ ] **Step 2–4:** FAIL → implement → PASS. **Gate.**
- [ ] **Step 5: Commit** `feat(ipc): tag AI events with run refs and add approval channel`.

---

### Task 15: Store reducer for tool parts and sub-runs

**Files:**

- Modify: `src/shared/chat.d.ts` (add `ToolPartState`, `SubRun`, `ToolPart`; `Message` gains `runId?`, `parts?`), `src/renderer/types/chat.d.ts` (re-export)
- Create: `src/renderer/stores/apply-ai-event.ts`. Test `src/renderer/stores/__tests__/apply-ai-event.test.ts`
- Modify: `src/renderer/stores/useChatStore.ts` (bind the new listeners; add `loopEnabled`, `setLoopEnabled`; pass `loopEnabled` to `aiSend`; `hydrateFromSettings` / `setActiveAgent` / `resetWithSeed` set `loopEnabled = agent?.isBuiltin ?? false`)

**Interfaces (produces):**

```typescript
export type AiStreamEvent =
  | { kind: 'token'; e: AiTokenEvent }
  | { kind: 'done'; e: AiDoneEvent }
  | { kind: 'error'; e: AiErrorEvent }
  | { kind: 'tool-call'; e: AiToolCallEvent }
  | { kind: 'approval-request'; e: AiApprovalRequestEvent }
  | { kind: 'tool-result'; e: AiToolResultEvent };
export function applyAiEvent(messages: Message[], rootRunId: string, ev: AiStreamEvent): Message[];
```

The reducer handles root tool events and all child events. Root `token`/`reasoning`/`source`/`done`/`error` keep today's store paths. For child `token`/`done`/`error`, the reducer updates `subRun`. Child tool events are ignored in v1. `subRun` is created on the parent `tool-call` when `toolName === 'invoke_agent'` (`agentId` from `input`, `runId: ''`, `status: 'running'`, `text: ''`). The first child event fills in `runId`.

- [ ] **Step 1: Failing reducer tests:**
  - `root tool-call appends input-available part to last assistant`
  - `approval-request sets state approval-requested and requestId`
  - `tool-result sets output-available or output-error`
  - `invoke_agent tool-call creates running subRun`
  - `child token appends to subRun.text, not to content`
  - `child done marks subRun done`; `child error marks subRun error` with `error` message
  - `ignores events from stale runs` (runId and parentRunId both ≠ root → returns the same array reference)
  - store: `loopEnabled defaults true for builtin agent and false otherwise`; `send passes loopEnabled to aiSend`
- [ ] **Step 2–4:** FAIL → implement → PASS. **Gate.**
- [ ] **Step 5: Commit** `feat(chat): reduce tool and sub-run events into message parts`.

---

### Task 16: Chat UI blocks + loop toggle

**Files:**

- Create: `src/renderer/components/chat/ToolCallBlock.tsx`, `ToolApprovalCard.tsx`, `SubRunBlock.tsx`, `LoopToggle.tsx`, `ToolParts.tsx` (switch: `approval-requested` → card; `invoke_agent` → SubRunBlock; else ToolCallBlock)
- Test: `src/renderer/components/chat/__tests__/ToolApprovalCard.test.tsx`, `ToolParts.test.tsx`
- Modify: `src/renderer/pages/ChatMessage/ChatMessage.tsx` (render `<ToolParts parts={message.parts} />` under assistant content when non-empty), `src/renderer/pages/ChatPopup/ChatPopup.tsx` (LoopToggle next to `ReasoningToggle`), `src/renderer/components/Icon.tsx` (add `LuWorkflow` as `'workflow'`)
- i18n (`en.json`, `zh-hans.json`, `zh-hant.json`) under `chat`: `loop` ("Agent loop"), `toolAllow` ("Allow"), `toolDeny` ("Deny"), `toolNeedsApproval` ("{{tool}} needs your approval"), `subRunRunning` ("Running {{name}}…"), `subRunFailed` ("{{name}} failed")

**Interfaces:** `ToolApprovalCard({ part }: { part: ToolPart })` calls `window.electronAPI.aiRespondApproval({ requestId: part.requestId!, approved })`. `SubRunBlock({ part })` reads the agent name from `useAgentsStore` by `part.subRun.agentId`. `LoopToggle` has the same props as `ReasoningToggle`.

- [ ] **Step 1: Failing tests:**
  - `Allow click sends approved true`; `Deny click sends approved false`
  - `buttons disable after a click` (state stays `approval-requested` until the tool-result arrives)
  - `ToolParts renders SubRunBlock with worker name and streamed text`
  - `ToolParts renders error text for output-error`
- [ ] **Step 2–4:** FAIL → implement → PASS. **Gate.**
- [ ] **Step 5: Commit** `feat(chat): render tool parts, approval, and loop toggle`.

---

### Task 17: Final gate

- [ ] **Step 1:** **Gate** + `npm run build` → PASS.
- [ ] **Step 2:** `rg -l "from '(ai|@ai-sdk/[^']+|ollama-ai-provider-v2)'" src` → only the allowed files.
- [ ] **Step 3:** Run the app with `npm run dev:electron`. With the loop on and no worker agents, a Default chat streams as before. Add a worker agent, ask Default to delegate, and confirm a SubRunBlock streams its text. Press Stop during the worker run: both stop, and the next send works.
- [ ] **Step 4:** Commit only if fixes were needed: `chore(ai): final gate fixes`.
