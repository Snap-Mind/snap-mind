# SnapMind — Agent loop (controller + tools)

Status: approved, ready for implementation planning
Owner: Louis Liu
Last updated: 2026-11-17
Parent: none (standalone design; the v0.6 roadmap is obsolete)

This document is the source of truth. Cursor `.cursor/plans/agent_loop_direction_*.plan.md` is scratch only. Do not sequence this work as a v0.6 roadmap phase.

## Goal

Keep SnapMind a lightweight hotkey assistant. Main owns the run. The renderer only paints. Add an **optional** agent loop: tools, a permission table, and a controller Default agent that may call other saved agents **sequentially**. Workers may use tools. Workers must not call other agents.

The product does not persist chats in this slice. The in-memory session is a tree so a later SQLite write is serialize-only.

## Non-goals (this slice)

- Filesystem tools (`read_file`, `write_file`, `bash`) and path sandbox
- MCP / skill install UI
- Hooks marketplace
- Persisted allow/deny rules, `allowAlways`
- Permission-mode UI (mode is the constant `default` in v1)
- Chat persistence
- Context compaction
- Replaying tool calls to the model on later turns (see "History")
- Step / usage events on the wire
- HeroUI v3
- Hand-written tutorial loop in app code
- Nested agent-to-agent invoke (worker calling `invoke_agent`)

## Success criteria

1. Only these files import `ai`, `@ai-sdk/*`, or `ollama-ai-provider-v2`: `src/main/ai/runtime/ai-sdk-runtime.ts`, `src/main/ai/runtime/map-messages.ts`, `src/main/ai/providers/create-language-model.ts`, and tests under `src/main/ai/runtime/__tests__/` and `src/main/ai/providers/__tests__/`. ESLint `no-restricted-imports` enforces this.
2. `ai:send` accepts `{ agentId, messages, loopEnabled }`. `loopEnabled: false`, or an empty tool list, is today's one-shot generation (`tools` and `stopWhen` omitted).
3. A root run of the Default agent (`isBuiltin`) with `loopEnabled: true` and at least one worker gets `invoke_agent` plus registry tools. A child run never gets `invoke_agent`. `ToolRegistry.register` rejects the name `invoke_agent`.
4. Default may call worker A, then B, then A again. Each call returns the worker's text to Default. No grandchild agent.
5. Every main→renderer AI event carries `runId`, `parentRunId`, `parentToolCallId`. Each run has its own `AbortController`.
6. The renderer store is the source of truth. Assistant `Message` keeps `content` for text and reasoning (today's `<think>` convention) and adds `parts: ToolPart[]` for tool calls and sub-runs. UI renders from the store only.
7. PermissionPolicy is a pure function: risk × mode → `allow | deny | ask`. Deny is a tool error result, not a thrown exception.
8. After every task: `npm test`, `npm run lint`, tsc ×3 pass. After Step 0 and the final task, `npm run build` also passes.

## Locked decisions

- Controller = existing built-in Default agent. No extra `canInvokeAgents` flag.
- `invoke_agent` risk is `safe`. UI still shows which worker is running.
- v1 permission pipeline = mode table + ask IPC. No persisted rules.
- Modes: `default`, `acceptEdits`, `plan`, `bypassPermissions`, `dontAsk` (tutorial ch.18). v1 runs with the constant `PERMISSION_MODE = 'default'`. The full table lives in code.
- Loop toggle: chat chrome `loopEnabled`. Default agent defaults true; other agents default false. Not persisted.
- Workers use the same ToolRegistry tools. `invoke_agent` is never in the registry. Later: optional per-agent allowlist on `agents.configJson`.
- Stay on HeroUI v2 (`^2.8.9`, optional patch 2.8.10). Never `npm i @heroui/react@latest` (that is v3).
- **Worker roster.** Workers = agents with `isBuiltin === false` whose `resolveAgentForRun` succeeds. `invoke_agent` is built per controller run. Its description lists each worker as `- <id>: <name> — <description or "no description">`. Its `agentId` schema is an integer `enum` of worker ids.
- **No workers → no tools.** If the roster is empty and the registry is empty, the controller run is a one-shot stream. With the loop on, a fresh install behaves exactly like today.
- **Approval waits inside the SDK callback.** The SDK's `'user-approval'` status **ends** the tool loop (ai 7.0.173). The adapter never returns it. It awaits `onApprove` inside `toolApproval` and returns `'approved'` or `'denied'`.
- **Approval lifecycle.** `ApprovalBroker` owns pending requests. Aborting a run resolves its pending approvals as `deny`. A response for an unknown `requestId` is ignored.
- **History.** The renderer stays the source of truth for chat history and still sends `messages` on every turn. `mapMessages` maps `content` only. Tool parts are UI state and are not replayed to the model.
- **SessionTree lifetime.** Each new root send clears the tree. Main needs no `chat:reset` hook.
- **Max steps.** `MAX_STEPS = 10` for every looped run.
- **Wire naming.** `streamId` is renamed to `runId` everywhere (`AiSendResult`, events, `aiAbort`). Renderer and main change in the same task.
- **Start ordering.** `AIService.send` starts the run with `setImmediate`, so the `ai:send` reply reaches the renderer before the first run event.

## Step 0 — dependency bump (before loop code)

Four clusters. Gate after each. Revert only the failed cluster. Do not bump drizzle / drizzle-kit. electron-builder 27 is alpha: skip.

| Cluster | Action                                                                                                                                               |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| A       | `ai` 7.0.89 → 7.0.173 and matching `@ai-sdk/*`. `ollama-ai-provider-v2` 4.1.0 only if zod stays a single major.                                      |
| B       | React 19.3.1. HeroUI stays v2.                                                                                                                       |
| C       | Vite 8.3.8 + `@vitejs/plugin-react` 6.3.0 + Vitest 5.1.0. Keep `overrides.esbuild` 0.28.2.                                                           |
| D       | Electron 45.3.3, electron-builder 26.18.0, `@types/node` 24, `npm run db:rebuild`. Bump `better-sqlite3` 13.2.0 only if ABI rebuild fails on 13.0.3. |

Gate: `npm install` (D also `db:rebuild`), `npm test`, `npm run lint`, tsc ×3, `npm run build`.

## Architecture

```
Renderer  useChatStore (Message.content + Message.parts)
    ipc  ai:send { agentId, messages, loopEnabled }
Main  AIService            // resolves root, owns RunRegistry, SessionTree, ApprovalBroker
    AgentRun.start()       // one call per run (root or child)
        ToolRegistry.list() + invoke_agent (controller root only)
        checkPermission(tool, risk, PERMISSION_MODE) → onApprove
        ModelRuntime.stream(StreamRequest)
            AiSdkRuntime   // only streaming `ai` import
    ipc  tagged RunEvents
Renderer  reduce events into store; paint
```

### Runtime types (`src/main/ai/runtime/types.ts`)

```typescript
import type { Message } from '../../../shared/chat.js';

export type ProviderConfig = {
  kind: string;
  apiKey: string | null;
  host: string;
  apiVersion: string | null;
};
export type ModelRef = { provider: ProviderConfig; modelId: string };
export type GenerationParams = {
  temperature: number;
  maxOutputTokens: number;
  topP: number;
  reasoning: boolean;
};
export type JsonSchema = Record<string, unknown>; // JSON Schema 7 object
export type ToolCall = { toolCallId: string; toolName: string; input: unknown };

export type RuntimeTool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute(input: unknown, opts: { toolCallId: string; abortSignal: AbortSignal }): Promise<unknown>;
};

export type StreamRequest = {
  model: ModelRef;
  params: GenerationParams;
  messages: Message[]; // app DTO; adapter maps
  instructions?: string;
  tools: RuntimeTool[]; // [] = one-shot
  maxSteps: number;
  abortSignal: AbortSignal;
  onApprove?: (call: ToolCall) => Promise<'allow' | 'deny'>;
};

export type RunEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'reasoning-delta'; text: string }
  | { type: 'source'; url: string; title?: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }
  | {
      type: 'approval-request';
      toolCallId: string;
      toolName: string;
      input: unknown;
      requestId: string;
    }
  | { type: 'tool-result'; toolCallId: string; toolName: string; output: unknown; isError: boolean }
  | { type: 'done'; reason: 'stop' | 'aborted' }
  | { type: 'error'; message: string };

export type RunRef = { runId: string; parentRunId: string | null; parentToolCallId: string | null };
```

`src/main/ai/runtime/model-runtime.ts`:

```typescript
export interface ModelRuntime {
  stream(req: StreamRequest): AsyncIterable<RunEvent>;
}
```

Runtime contract:

- Never throws. Every stream ends with exactly one `done` or `error`.
- Never yields `approval-request`. `AgentRun` emits that event, because it owns the policy and the broker.
- Abort yields `done { reason: 'aborted' }`.
- A model-factory failure (unknown kind) yields `error`.

### AiSdkRuntime (swap wall)

`new AiSdkRuntime({ streamText, createLanguageModel })`. `index.ts` injects the real `streamText`, and tests inject a fake.

- `createLanguageModel(provider, modelId)`. If it throws, yield `error` with the message.
- `messages` → `mapMessages` (moved to `runtime/map-messages.ts`).
- Tools → `{ [name]: tool({ description, inputSchema: jsonSchema(schema), execute }) }`. Omit `tools`, `stopWhen`, `toolApproval` when `tools` is empty. Otherwise `stopWhen: isStepCount(maxSteps)`.
- `onApprove` → `toolApproval: async ({ toolCall }) => (await onApprove(call)) === 'allow' ? 'approved' : 'denied'`.
- Read `result.stream` (`fullStream` is deprecated in 7.0.173).

| SDK part             | RunEvent                                                                           |
| -------------------- | ---------------------------------------------------------------------------------- |
| `text-delta`         | `text-delta`                                                                       |
| `reasoning-delta`    | `reasoning-delta`                                                                  |
| `source` with `url`  | `source`                                                                           |
| `tool-call`          | `tool-call`                                                                        |
| `tool-result`        | `tool-result`, `isError: false`                                                    |
| `tool-error`         | `tool-result`, `isError: true`, `output: describeAiError(error)`                   |
| `tool-output-denied` | `tool-result`, `isError: true`, `output: 'Denied by permission policy or user.'`   |
| `error`              | `error` with `describeAiError(error)`, then stop                                   |
| `abort`              | `done: aborted`, then stop                                                         |
| stream end           | `done` (`aborted` if the signal is aborted, else `stop`)                           |
| thrown               | `done: aborted` if the signal is aborted, else `error` with `describeAiError(err)` |

### ToolRegistry (`src/main/ai/tools/registry.ts`)

```typescript
export type ToolContext = { runId: string; toolCallId: string; abortSignal: AbortSignal };
export type ToolDef = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  risk: Risk;
  execute(input: unknown, ctx: ToolContext): Promise<unknown>;
};
export class ToolRegistry {
  register(def: ToolDef): void; // throws on 'invoke_agent' or duplicate name
  get(name: string): ToolDef | undefined;
  list(): ToolDef[];
}
```

v1 registers no tools. The registry exists so workers and controller share one tool set later.

### PermissionPolicy (`src/main/ai/permission/`)

`modes.ts`: `Risk`, `Mode`, `Decision`, `MODE_TABLE`, `PERMISSION_MODE = 'default'`. `policy.ts`: pure `checkPermission(toolName, risk, mode): Decision`.

| mode              | safe  | moderate | dangerous |
| ----------------- | ----- | -------- | --------- |
| default           | allow | ask      | ask       |
| acceptEdits       | allow | allow    | ask       |
| plan              | allow | deny     | deny      |
| bypassPermissions | allow | allow    | allow     |
| dontAsk           | allow | deny     | deny      |

`ask` → `ApprovalBroker` → IPC → resume. `deny` → SDK `'denied'` → `tool-result` with `isError: true`. Do not throw.

### Run lifecycle (`src/main/ai/run/`)

`RunRegistry` (this is the `Map<runId, InFlight>`):

```typescript
export class RunRegistry {
  open(runId: string, parentRunId: string | null): AbortSignal; // child signal aborts when the parent's does
  abort(runId: string): void; // that run and its descendants; never its parent
  abortAll(): void;
  close(runId: string): void;
  isOpen(runId: string): boolean;
}
```

`ApprovalBroker`:

```typescript
export class ApprovalBroker {
  request(
    runId: string,
    call: ToolCall
  ): { requestId: string; decision: Promise<'allow' | 'deny'> };
  respond(requestId: string, approved: boolean): boolean; // false when unknown
  cancelRun(runId: string): void; // resolves that run's pending decisions as 'deny'
}
```

`SessionTree`:

```typescript
export type SessionNode = {
  id: string; // runId
  parentId: string | null;
  agentId: number;
  messages: Message[];
  children: SessionNode[];
};
export class SessionTree {
  createRoot(runId: string, agentId: number, messages: Message[]): SessionNode;
  addChild(parentRunId: string, runId: string, agentId: number, messages: Message[]): SessionNode;
  appendAssistant(runId: string, text: string): void;
  get(runId: string): SessionNode | undefined;
  clear(): void;
}
```

`AgentRun`:

```typescript
export type ResolvedTarget = { agent: AgentDTO; provider: ProviderDTO; model: ModelDTO };
export type RunOutcome = { status: 'stop' | 'aborted' | 'error'; text: string; message?: string };
export type StartRunInput = RunRef & {
  target: ResolvedTarget;
  messages: Message[];
  loopEnabled: boolean;
  signal: AbortSignal;
};
export class AgentRun {
  constructor(deps: {
    runtime: ModelRuntime;
    registry: ToolRegistry;
    broker: ApprovalBroker;
    tree: SessionTree;
    onEvent: (ref: RunRef, event: RunEvent) => void;
    makeInvokeAgentTool: (parent: RunRef) => Promise<ToolDef | null>; // null = no workers
  });
  start(input: StartRunInput): Promise<RunOutcome>;
}
```

- `controller = parentRunId === null && target.agent.isBuiltin && loopEnabled`.
- `tools = loopEnabled ? [...registry.list(), ...(controller ? [invokeAgent ?? none] : [])] : []`.
- Each `ToolDef` is bound to a `RuntimeTool` with `ctx.runId = runId`.
- `onApprove` is set only when `tools.length > 0`. It looks up the tool's risk and runs `checkPermission(name, risk, PERMISSION_MODE)`. `allow`/`deny` return directly. `ask` calls `broker.request`, emits `approval-request` through `onEvent`, and awaits the decision.
- When the signal aborts, call `broker.cancelRun(runId)`.
- Forward every runtime event through `onEvent(ref, event)`. Accumulate `text-delta`. Resolve `RunOutcome` on `done`/`error`. If the iterable ends with no terminal event, emit and resolve `done` (`aborted` if the signal is aborted, else `stop`).

`invoke_agent` (`src/main/ai/tools/invoke-agent.ts`):

```typescript
export function createInvokeAgentTool(deps: {
  listWorkers: () => Promise<ResolvedTarget[]>;
  runs: RunRegistry;
  tree: SessionTree;
  startChild: (input: StartRunInput) => Promise<RunOutcome>;
  newRunId: () => string;
  parent: RunRef;
}): Promise<ToolDef | null>;
```

- Returns `null` when `listWorkers()` is empty.
- `risk: 'safe'`. Input schema `{ agentId: integer enum of worker ids, prompt: string (minLength 1) }`, both required.
- `execute(input, ctx)` throws when `agentId` is not in the roster. That becomes a `tool-error` → `isError: true`.
- `childRunId = newRunId()`, `signal = runs.open(childRunId, ctx.runId)`, `tree.addChild(...)`, then `startChild({ runId: childRunId, parentRunId: ctx.runId, parentToolCallId: ctx.toolCallId, target, messages: [{ role: 'user', content: prompt }], loopEnabled: true, signal })`. Always call `runs.close(childRunId)` afterward.
- `stop` → return the text. `aborted` → throw `Error('Worker run was aborted.')`. `error` → throw `Error(message)`.
- Aborting a child alone surfaces as a tool error to the parent, and the parent continues.

`AIService` (`src/main/ai/run/ai-service.ts`):

```typescript
export class AIService {
  constructor(
    agentsService,
    providersService,
    deps: { runtime: ModelRuntime; registry: ToolRegistry }
  );
  send(req: AiSendRequest, onEvent: (ref: RunRef, event: RunEvent) => void): Promise<AiSendResult>;
  abort(runId: string): void;
  respondApproval(requestId: string, approved: boolean): void;
}
```

- `send`: `runs.abortAll()` and `tree.clear()`, resolve the root with `resolveAgentForRun`, return `{ error }` on failure, else open the root run, start `AgentRun` on `setImmediate`, and return `{ runId }`.
- `abort(runId)` → `runs.abort(runId)`. Parent abort cascades to the active child. Child abort leaves the parent.
- v1: one worker at a time (the parent waits inside `execute`).

## IPC

`AiRunRef = { runId: string; parentRunId: string | null; parentToolCallId: string | null }`. Every main→renderer AI payload is `AiRunRef & {...}`.

| Channel (main → renderer) | Payload extra fields                     |
| ------------------------- | ---------------------------------------- |
| `ai:token`                | `text`                                   |
| `ai:reasoning`            | `text`                                   |
| `ai:source`               | `source: { url, title? }`                |
| `ai:tool-call`            | `toolCallId, toolName, input`            |
| `ai:approval-request`     | `toolCallId, toolName, input, requestId` |
| `ai:tool-result`          | `toolCallId, toolName, output, isError`  |
| `ai:done`                 | `reason: 'stop' \| 'aborted'`            |
| `ai:error`                | `message`                                |

Renderer → main:

- `ai:send(AiSendRequest)` → `AiSendResult = { runId } | { error }`
- `ai:abort(runId: string)`
- `ai:approval-response({ requestId, approved })`

Preload adds `aiRespondApproval`, `onAiToolCall`, `onAiApprovalRequest`, `onAiToolResult` (+ `off*`).

## Renderer (state-driven)

Do not import AI SDK UI types. Do not use `useChat`.

`src/shared/chat.d.ts` additions:

```typescript
export type ToolPartState =
  | 'input-available'
  | 'approval-requested'
  | 'output-available'
  | 'output-error';
export type SubRun = {
  runId: string;
  agentId: number;
  text: string;
  status: 'running' | 'done' | 'aborted' | 'error';
  error?: string;
};
export type ToolPart = {
  type: 'tool';
  toolCallId: string;
  toolName: string;
  input: unknown;
  state: ToolPartState;
  requestId?: string;
  output?: unknown;
  subRun?: SubRun;
};
// Message gains: runId?: string; parts?: ToolPart[];
```

Routing in the store:

- Root events (`runId === currentRunId`): text and reasoning keep today's `content` / `<think>` path. Tool events update `parts` on the last assistant message.
- Child events (`parentRunId === currentRunId`): routed to the part whose `toolCallId === parentToolCallId`. Tokens append to `subRun.text`. Done/error set `subRun.status`.
- Everything else is ignored (stale runs).
- The pure reducer `applyAiEvent` lives in `src/renderer/stores/apply-ai-event.ts`.

Components under `src/renderer/components/chat/` (icons via `Icon.tsx` only): `ToolCallBlock` (generic tool with status and output), `ToolApprovalCard` (Allow/Deny), `SubRunBlock` (worker name, status, streamed text), `LoopToggle` (mirrors `ReasoningToggle`). `ChatMessage` renders `message.parts` under the assistant bubble.

## Source layout

```
src/main/ai/
  runtime/     types.ts, model-runtime.ts, ai-sdk-runtime.ts, map-messages.ts
  providers/   create-language-model.ts, url-resolvers.ts
  mapping/     map-params.ts
  run/         ai-service.ts, agent-run.ts, run-registry.ts, approval-broker.ts, session-tree.ts
  tools/       registry.ts, invoke-agent.ts
  permission/  modes.ts, policy.ts
  describe-ai-error.ts, redact.ts, resolve-agent-for-run.ts
```

## Error handling

- Provider failure: `RunEvent.error` with `describeAiError` (existing).
- Tool execute failure: SDK `tool-error` → `tool-result { isError: true }`. The loop continues.
- Permission deny: same as tool error.
- Worker failure (unbound, no key, provider error, abort): a tool error to the controller. The controller continues.
- Model without tool support while the loop is on: a provider error surfaces as today. The user can turn the loop off.
- Runtime and `AgentRun` never throw out of the loop.

## Testing

- Fake `ModelRuntime` yielding scripted `RunEvent`s (replaces today's injected `streamText` outside `runtime/`).
- `AiSdkRuntime` tests inject a fake `streamText` and assert the part mapping table.
- PermissionPolicy table: every mode × risk.
- ToolRegistry rejects `invoke_agent` and duplicates.
- RunRegistry: parent abort aborts child; child abort leaves parent; `abortAll`.
- ApprovalBroker: respond, unknown id, `cancelRun` resolves deny.
- `invoke_agent`: roster in description, unknown id, child error/abort → throw, `close` always called.
- Store reducer: tool-call / approval / tool-result / child token / child done for nested `runId`; stale runs ignored.
