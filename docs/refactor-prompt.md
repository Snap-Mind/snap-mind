# Refactoring Prompt: Simplify Provider Architecture

Copy everything below this line into a new Copilot Chat session.

---

## Task

Refactor `src/services/providers/` to simplify the current over-layered composition architecture. The goal: **fewer indirection layers, same composition benefits, all 154 existing tests still pass**.

### What's wrong with the current structure

The current code has too many layers of indirection:
- `AnthropicProvider.ts` → imports `anthropicAdapter` from `adapters/anthropicAdapter.ts` → which uses `parseSSEStream` from `core/streamParsers.ts` + `deriveV1ApiBase` from `core/urlResolvers.ts`
- `OpenAIProvider.ts` → imports `openaiAdapter` from `adapters/openaiAdapter.ts` → which calls `createOpenAICompatibleAdapter` from `adapters/openaiCompatible.ts` → which uses stream parsers + URL resolvers

There are 7 thin wrapper files (`OpenAIProvider.ts`, etc.) that exist **only** for backward compatibility — they extend `UnifiedProvider` and add `_deriveApiBase`/`_buildXxxUrl` test helpers. The `adapters/` folder has 8 files. Total: ~28 files for 7 providers. This can be halved while keeping composition.

### Target structure (implement exactly this)

```
src/services/providers/
  core/
    types.ts                   # RequestBuilder, StreamParser, ModelParser interfaces + shared types
    validation.ts              # validateRequest(), executeRequest() shared logic
    sseStreamParser.ts         # parseSSEStream() — used by 6 providers
    ndjsonStreamParser.ts      # parseNDJSONStream() — used by Ollama only
  adapters/
    openaiRequestBuilder.ts    # OpenAI-compatible request building (covers OpenAI, DeepSeek, Qwen)
    anthropicRequestBuilder.ts # Anthropic-specific request building
    googleRequestBuilder.ts    # Google Gemini-specific request building
    ollamaRequestBuilder.ts    # Ollama-specific request building
    azureRequestBuilder.ts     # Azure OpenAI-specific request building
  parsers/
    openaiResponseParser.ts    # OpenAI-compatible stream + response + model list parsing
    anthropicResponseParser.ts # Anthropic stream + response + model list parsing
    googleResponseParser.ts    # Google stream + response + model list parsing
    ollamaResponseParser.ts    # Ollama NDJSON stream + response + model list parsing
  urlResolvers.ts              # All URL derivation strategies (keep as-is, just move from core/)
  UnifiedProvider.ts           # Single Provider class (~80 lines)
  ProviderFactory.ts           # Wires builder + parser + urlResolver into UnifiedProvider
```

**Key simplifications:**
1. **Delete all 7 thin wrapper files** (`OpenAIProvider.ts`, `AnthropicProvider.ts`, etc.) — `ProviderFactory` returns `UnifiedProvider` directly
2. **Delete `adapters/openaiCompatible.ts`** — merge the factory logic into `openaiRequestBuilder.ts` as a parameterized function
3. **Split the monolithic `ProviderAdapter` interface** into focused interfaces: `RequestBuilder`, `StreamParser`/`ResponseParser`, `ModelParser`
4. **Move URL resolvers** from `core/urlResolvers.ts` to `urlResolvers.ts` (flat, one level up)
5. **Split `streamParsers.ts`** into `sseStreamParser.ts` + `ndjsonStreamParser.ts` (each file does one thing)
6. **Azure reuses** `openaiResponseParser` (same response format as OpenAI)
7. **Tests import from the new locations** — update test imports to use the new paths

### How each adapter maps to the old code

| Old file(s) | New files |
|---|---|
| `adapters/openaiCompatible.ts` + `adapters/openaiAdapter.ts` | `adapters/openaiRequestBuilder.ts` + `parsers/openaiResponseParser.ts` |
| `adapters/deepseekAdapter.ts` | Reuses `openaiRequestBuilder` with different config in ProviderFactory |
| `adapters/qwenAdapter.ts` | Reuses `openaiRequestBuilder` with different config in ProviderFactory |
| `adapters/azureAdapter.ts` | `adapters/azureRequestBuilder.ts` + reuses `parsers/openaiResponseParser.ts` |
| `adapters/anthropicAdapter.ts` | `adapters/anthropicRequestBuilder.ts` + `parsers/anthropicResponseParser.ts` |
| `adapters/googleAdapter.ts` | `adapters/googleRequestBuilder.ts` + `parsers/googleResponseParser.ts` |
| `adapters/ollamaAdapter.ts` | `adapters/ollamaRequestBuilder.ts` + `parsers/ollamaResponseParser.ts` |
| `OpenAIProvider.ts`, `DeepSeekProvider.ts`, etc. (7 files) | **Deleted** |
| `core/streamParsers.ts` | `core/sseStreamParser.ts` + `core/ndjsonStreamParser.ts` |
| `core/urlResolvers.ts` | `urlResolvers.ts` (moved up one level) |

### Design principles

1. **Composition, not inheritance** — no class extends another
2. **Each file does one thing** — a request builder builds requests, a parser parses responses
3. **ProviderFactory is the single wiring point** — it composes builder + parser + URL resolver into a provider config object and passes it to `UnifiedProvider`
4. **OpenAI-compatible providers share code via the same builder/parser** — parameterized by `{ providerName, defaultOrigin, deriveApiBase, modelFilter? }`
5. **All code in English** — comments, variable names, function names

---

## Current code (for reference — read these files if you need exact details)

### Types (DO NOT MODIFY these files)

**`src/types/providers.d.ts`** — Provider interface, config types, ProviderType union:
```typescript
export interface Provider {
  config: BaseProviderConfig;
  initialize(config: BaseProviderConfig): Promise<void>;
  sendMessage(messages: Message[], options?: ProviderOptions, onToken?: (token: string) => void): Promise<string>;
  listModels(): Promise<ModelSetting[]>;
}
export interface ProviderOptions {
  model: string; max_tokens?: number; stream?: boolean;
  temperature?: number; top_p?: number; signal?: AbortSignal;
}
export interface BaseProviderConfig {
  id: ProviderType; name: string; apiKey: string; host: string; models?: ModelSetting[];
}
export interface AzureOpenAIConfig extends BaseProviderConfig { apiVersion: string; }
export interface GoogleConfig extends BaseProviderConfig { config?: { topK?: number }; }
export type ProviderType = 'openai' | 'azure-openai' | 'anthropic' | 'google' | 'deepseek' | 'qwen' | 'ollama';
```

**`src/types/chat.d.ts`**: `export type Message = { role: 'user' | 'assistant' | 'system'; content: string; };`

**`src/types/setting.d.ts`**: `ModelSetting = { id: string; name: string; type: ModelType; description: string; capabilities: Capability[]; }`

### Current `core/types.ts` — the single monolithic ProviderAdapter interface (to be split):
```typescript
export interface ProviderAdapter {
  readonly providerName: string;
  readonly requiresApiKey: boolean;
  validateRequest?(config: BaseProviderConfig, options?: ProviderOptions): string | null;
  buildChatUrl(config: BaseProviderConfig, options?: ProviderOptions): string;
  buildChatHeaders(config: BaseProviderConfig): Record<string, string>;
  buildChatBody(messages: Message[], options: ProviderOptions, config: BaseProviderConfig): any;
  parseStreamResponse(res: Response, onToken?: (token: string) => void): Promise<string>;
  extractContentFromResponse(data: any): string;
  buildListModelsRequest(config: BaseProviderConfig): { url: string; headers: Record<string, string> } | null;
  parseModelsResponse(data: any, config: BaseProviderConfig): ModelSetting[];
}
```

### Current `UnifiedProvider.ts` (orchestration logic — adapt to new split interfaces):
- `sendMessage()`: validate → buildChatUrl + buildChatHeaders + buildChatBody → fetch → parseStreamResponse or extractContentFromResponse
- `listModels()`: buildListModelsRequest → fetch → parseModelsResponse, fallback to config.models
- `initialize()`: reassign config

### Current `ProviderFactory.ts`:
```typescript
const adapterMap: Record<string, ProviderAdapter> = {
  openai: openaiAdapter,
  'azure-openai': azureOpenaiAdapter,
  anthropic: anthropicAdapter,
  google: googleAdapter,
  deepseek: deepseekAdapter,
  qwen: qwenAdapter,
  ollama: ollamaAdapter,
};
class ProviderFactory {
  static createProvider(config: BaseProviderConfig): Provider { /* lookup + new UnifiedProvider */ }
  static getAvailableProviders(): ProviderType[] { return Object.keys(adapterMap) as ProviderType[]; }
}
```

### Current URL resolvers (preserve exact behavior):
- `deriveV1ApiBase(host, providerName)` — appends /v1, used by OpenAI, Anthropic, DeepSeek
- `deriveQwenApiBase(host)` — appends /compatible-mode/v1
- `deriveGoogleApiBase(host)` — appends /v1beta
- `deriveOllamaApiBase(host)` — appends /api, fallback localhost:11434

### Current stream parsers (preserve exact behavior):
- `parseSSEStream(res, extractToken, onToken, logTag)` — buffers on newlines, handles `data: [DONE]`
- `parseNDJSONStream(res, extractToken, onToken, options)` — supports extractError, isDone callbacks

### Key provider-specific behaviors to preserve:

**OpenAI/DeepSeek/Qwen** (OpenAI-compatible):
- Bearer token auth, same body shape, SSE streaming with `choices[0].delta.content`
- DeepSeek: defaultOrigin `https://api.deepseek.com`, no model filter
- Qwen: defaultOrigin `https://dashscope.aliyuncs.com`, uses `deriveQwenApiBase`
- OpenAI: defaultOrigin `https://api.openai.com`, filters models to `id.includes('gpt')`

**Azure OpenAI**:
- Custom validation: requires both host AND apiKey
- Model in URL path: `{host}/openai/deployments/{model}/chat/completions?api-version={apiVersion}`
- `api-key` header (not Bearer)
- No model listing API (returns null → falls back to config.models)
- Same response format as OpenAI (reuse parser)

**Anthropic**:
- System message extracted to top-level `system` field (not in messages array)
- `X-API-Key` + `Anthropic-Version: 2023-06-01` headers
- SSE with `content_block_delta` event type → `data.delta?.text`
- Non-streaming: `content[0].text`
- Model listing: `/v1/models` with same auth headers + Accept header

**Google (Gemini)**:
- `contents[]` with `user`/`model` roles, `parts[{text}]`
- System prompt prepended to first user message
- API key in query string `?key=xxx`, streaming adds `&alt=sse`
- `generationConfig` bag with `topK` from `GoogleConfig.config.topK`
- Response: `candidates[0].content.parts[0].text`
- Model listing: `/models?key=xxx`, response has `models[]` with `name` like `models/gemini-pro`

**Ollama**:
- No API key required, custom validation only checks model
- NDJSON streaming, not SSE
- `options` bag: temperature, top_p, num_predict (mapped from max_tokens)
- Response: `message.content`
- Model listing: `/api/tags`, response has `models[]` with `name` + `details`

---

## Test requirements

There are **7 test files** with **150 tests** in `src/services/providers/__tests__/`. They test the **wrapper classes** by name (`OpenAIProvider`, `AnthropicProvider`, etc.).

**Critical**: After refactoring, all 154 tests (150 provider + 4 component) must pass. The test files import like:
```typescript
import OpenAIProvider from '../OpenAIProvider';
```

**You have two options:**
1. **Re-export from the old paths** — create `OpenAIProvider.ts` that re-exports: `export { default } from './ProviderFactory'; // with proper wiring`
2. **Update test imports** to use the new structure and instantiate `UnifiedProvider` with the right config directly

**I recommend option 1**: keep the 7 wrapper files as **one-liner re-exports** that call `ProviderFactory.createProvider()` or directly construct `UnifiedProvider`. This way test files need minimal changes. But the wrapper files should be **truly thin** — no class declaration, just:
```typescript
// OpenAIProvider.ts
import { createOpenAIProvider } from './ProviderFactory';
export default createOpenAIProvider;
// or: export { UnifiedProvider as default } from './UnifiedProvider' with pre-bound adapter
```

Actually, the tests also test URL helper methods like `provider._deriveApiBase(host)`, `provider._buildChatCompletionsUrl(host)`, etc. Those need to remain accessible. The simplest approach: **keep the thin wrapper files but make them instantiate UnifiedProvider + expose URL helpers as standalone functions or attached methods**. Or refactor the tests to import URL resolvers directly.

**Your call** — pick whichever approach is cleanest. The key constraint is: `npx vitest run` must show 154 tests passing.

---

## Execution plan

1. Create `core/types.ts` with split interfaces (`RequestBuilder`, `StreamParser`/`ResponseParser`, `ModelParser` or however you want to split them)
2. Create `core/sseStreamParser.ts` and `core/ndjsonStreamParser.ts` (split from current `core/streamParsers.ts`)
3. Move `core/urlResolvers.ts` → `urlResolvers.ts` (preserve all 4 functions exactly)
4. Create 5 request builder files in `adapters/`
5. Create 4 parser files in `parsers/` (Azure reuses openai parser)
6. Rewrite `UnifiedProvider.ts` to compose from the new split interfaces
7. Rewrite `ProviderFactory.ts` to wire builders + parsers + URL resolvers
8. Update/create thin wrapper files for backward-compatible imports (or update tests)
9. Delete old files: `adapters/openaiCompatible.ts`, `adapters/*Adapter.ts` (7 files), `core/streamParsers.ts`, `core/urlResolvers.ts`, `core/types.ts` (old)
10. Run `npx vitest run` — all 154 tests must pass
11. Delete `core/validation.ts` idea if you folded it into `UnifiedProvider.ts` — use your judgment

**Important**: Write all code in English. Use composition, not inheritance. Keep it simple.
