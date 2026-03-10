// OpenAI-compatible request builder factory.
// Parameterized to support OpenAI, DeepSeek, and Qwen with shared request logic.

import { Message } from '@/types/chat';
import { BaseProviderConfig, ProviderOptions } from '@/types/providers';
import { RequestBuilder } from '@/types/providers';

export interface OpenAIRequestBuilderOptions {
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
}

/**
 * Creates a RequestBuilder for any OpenAI-compatible API.
 *
 * All OpenAI-compatible providers share:
 * - Bearer token auth
 * - Same request body shape (model, messages, stream, temperature, ...)
 * - /models endpoint for model listing
 */
export function createOpenAIRequestBuilder(opts: OpenAIRequestBuilderOptions): RequestBuilder {
  const {
    providerName,
    defaultOrigin,
    deriveApiBase,
    chatPath = '/chat/completions',
    modelsPath = '/models',
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
  };
}
