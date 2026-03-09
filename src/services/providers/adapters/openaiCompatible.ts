// Shared factory for OpenAI-compatible adapters.
// OpenAI, DeepSeek, and Qwen all use the same request/response format
// and only differ in default origin, URL derivation, and model filtering.

import { Message } from '@/types/chat';
import { BaseProviderConfig, ProviderOptions } from '@/types/providers';
import { ModelSetting } from '@/types/setting';
import { ProviderAdapter } from '../core/types';
import { parseSSEStream } from '../core/streamParsers';

export interface OpenAICompatibleOptions {
  /** Human-readable name (e.g. "OpenAI", "DeepSeek"). */
  providerName: string;
  /** Default API origin when config.host is empty. */
  defaultOrigin: string;
  /** Derive a versioned API base from a host string. */
  deriveApiBase: (host: string) => string;
  /** Path appended to the API base for chat completions (default: /chat/completions). */
  chatPath?: string;
  /** Path appended to the API base for model listing (default: /models). */
  modelsPath?: string;
  /** Optional filter applied to the raw model list (default: accept all). */
  modelFilter?: (model: any) => boolean;
  /** Build a description string for a model entry. */
  modelDescription?: (model: any) => string;
}

/**
 * Creates a ProviderAdapter for any OpenAI-compatible API.
 *
 * All OpenAI-compatible providers share:
 * - Bearer token auth
 * - Same request body shape (model, messages, stream, temperature, …)
 * - SSE streaming with `choices[0].delta.content`
 * - `/models` endpoint with `data[]` response
 *
 * To add a new OpenAI-compatible provider, call this factory with
 * just the differences (origin, URL resolver, model filter).
 */
export function createOpenAICompatibleAdapter(
  opts: OpenAICompatibleOptions
): ProviderAdapter {
  const {
    providerName,
    defaultOrigin,
    deriveApiBase,
    chatPath = '/chat/completions',
    modelsPath = '/models',
    modelFilter = () => true,
    modelDescription = (m: any) => `${providerName} ${m.id} model`,
  } = opts;

  return {
    providerName,
    requiresApiKey: true,

    buildChatUrl(config: BaseProviderConfig): string {
      const base = deriveApiBase(config.host || defaultOrigin);
      return `${base}${chatPath}`;
    },

    buildChatHeaders(config: BaseProviderConfig): Record<string, string> {
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      };
    },

    buildChatBody(messages: Message[], options: ProviderOptions): any {
      return {
        model: options.model,
        messages,
        max_tokens: options.max_tokens,
        stream: options.stream !== undefined ? options.stream : true,
        temperature: options.temperature,
        top_p: options.top_p,
      };
    },

    async parseStreamResponse(
      res: Response,
      onToken?: (token: string) => void
    ): Promise<string> {
      return parseSSEStream(
        res,
        (data) => data.choices?.[0]?.delta?.content || null,
        onToken,
        providerName
      );
    },

    extractContentFromResponse(data: any): string {
      return data.choices?.[0]?.message?.content || '';
    },

    buildListModelsRequest(config: BaseProviderConfig) {
      if (!config.apiKey) return null;
      const base = deriveApiBase(config.host || defaultOrigin);
      return {
        url: `${base}${modelsPath}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
      };
    },

    parseModelsResponse(data: any): ModelSetting[] {
      if (!Array.isArray(data.data)) return [];
      return data.data.filter(modelFilter).map(
        (m: any) =>
          ({
            id: m.id,
            name: m.display_name || m.id,
            type: 'chat',
            capabilities: ['chat'],
            description: modelDescription(m),
          }) as ModelSetting
      );
    },
  };
}
