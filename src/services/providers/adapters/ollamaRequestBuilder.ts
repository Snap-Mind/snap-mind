// Ollama request builder — local models via Ollama REST API.
//
// Key differences from all other providers:
// - No API key required
// - Options bag for temperature/top_p/num_predict
// - /api/* URL scheme instead of /v1/*
// - /api/tags for model listing (not /models)

import { Message } from '@/types/chat';
import { BaseProviderConfig, ProviderOptions } from '@/types/providers';
import { RequestBuilder } from '@/types/providers';
import { deriveOllamaApiBase } from '../core/urlResolvers';

const OLLAMA_DEFAULT_ORIGIN = 'http://localhost:11434';

export const ollamaRequestBuilder: RequestBuilder = {
  providerName: 'Ollama',
  requiresApiKey: false,

  validateRequest(_config: BaseProviderConfig, options?: ProviderOptions): string | null {
    if (!options?.model) {
      return 'Model not specified for Ollama';
    }
    return null;
  },

  buildChatUrl(config: BaseProviderConfig): string {
    const base = deriveOllamaApiBase(config.host || OLLAMA_DEFAULT_ORIGIN);
    return `${base}/chat`;
  },

  buildChatHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    };
  },

  buildChatBody(messages: Message[], options: ProviderOptions): any {
    // Map common options into Ollama's `options` bag
    const runtimeOptions: Record<string, any> = {};
    if (typeof options?.temperature === 'number') runtimeOptions.temperature = options.temperature;
    if (typeof options?.top_p === 'number') runtimeOptions.top_p = options.top_p;
    if (typeof options?.max_tokens === 'number') runtimeOptions.num_predict = options.max_tokens;

    const body: any = {
      model: options?.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: options?.stream !== false,
    };
    if (Object.keys(runtimeOptions).length > 0) body.options = runtimeOptions;
    return body;
  },

  buildListModelsRequest(config: BaseProviderConfig) {
    const base = deriveOllamaApiBase(config.host || OLLAMA_DEFAULT_ORIGIN);
    return {
      url: `${base}/tags`,
      headers: {},
    };
  },
};
