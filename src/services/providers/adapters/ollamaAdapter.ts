// Ollama adapter — local models via Ollama REST API.
//
// Key differences from all other providers:
// - No API key required
// - NDJSON streaming (not SSE)
// - Options bag for temperature/top_p/num_predict
// - /api/* URL scheme instead of /v1/*
// - /api/tags for model listing (not /models)

import { Message } from '@/types/chat';
import { BaseProviderConfig, ProviderOptions } from '@/types/providers';
import { ModelSetting } from '@/types/setting';
import { ProviderAdapter } from '../core/types';
import { parseNDJSONStream } from '../core/streamParsers';
import { deriveOllamaApiBase } from '../core/urlResolvers';

const OLLAMA_DEFAULT_ORIGIN = 'http://localhost:11434';

export const ollamaAdapter: ProviderAdapter = {
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

  async parseStreamResponse(
    res: Response,
    onToken?: (token: string) => void
  ): Promise<string> {
    return parseNDJSONStream(
      res,
      (obj) => obj?.message?.content || null,
      onToken,
      {
        logTag: 'Ollama',
        extractError: (obj) => {
          if (obj?.error) {
            return typeof obj.error === 'string' ? obj.error : JSON.stringify(obj.error);
          }
          return null;
        },
        isDone: (obj) => obj?.done === true,
      }
    );
  },

  extractContentFromResponse(data: any): string {
    return data?.message?.content || '';
  },

  buildListModelsRequest(config: BaseProviderConfig) {
    const base = deriveOllamaApiBase(config.host || OLLAMA_DEFAULT_ORIGIN);
    return {
      url: `${base}/tags`,
      headers: {},
    };
  },

  parseModelsResponse(data: any): ModelSetting[] {
    const models = data?.models;
    if (!Array.isArray(models)) return [];
    return models.map(
      (m: { name: string; details?: { family?: string; parameter_size?: string } }) => ({
        id: m.name,
        name: m.name,
        type: 'chat' as const,
        capabilities: ['chat' as const],
        description: m.details?.family
          ? `Ollama ${m.details.family}${m.details.parameter_size ? ' ' + m.details.parameter_size : ''}`
          : 'Ollama local model',
      })
    );
  },
};
