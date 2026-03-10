// Anthropic request builder — custom message format, headers, and system prompt handling.
//
// Key differences from OpenAI:
// - System prompt is a separate top-level field (not in messages array)
// - Uses X-API-Key header + Anthropic-Version header

import { Message } from '@/types/chat';
import { BaseProviderConfig, ProviderOptions } from '@/types/providers';
import { RequestBuilder } from '../core/types';
import { deriveV1ApiBase } from '../urlResolvers';

const ANTHROPIC_DEFAULT_ORIGIN = 'https://api.anthropic.com';
const ANTHROPIC_API_VERSION = '2023-06-01';

export const anthropicRequestBuilder: RequestBuilder = {
  providerName: 'Anthropic',
  requiresApiKey: true,

  buildChatUrl(config: BaseProviderConfig): string {
    const base = deriveV1ApiBase(config.host || ANTHROPIC_DEFAULT_ORIGIN, 'Anthropic');
    return `${base}/messages`;
  },

  buildChatHeaders(config: BaseProviderConfig): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': config.apiKey,
      'Anthropic-Version': ANTHROPIC_API_VERSION,
    };
  },

  buildChatBody(messages: Message[], options: ProviderOptions): any {
    // Separate system prompt from conversation messages
    let systemPrompt = '';
    const anthropicMessages: { role: string; content: string }[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        systemPrompt = message.content;
      } else {
        anthropicMessages.push({
          role: message.role,
          content: message.content,
        });
      }
    }

    return {
      model: options?.model,
      messages: anthropicMessages,
      system: systemPrompt,
      max_tokens: options?.max_tokens,
      stream: options?.stream !== undefined ? options.stream : true,
      temperature: options?.temperature,
      top_p: options?.top_p,
    };
  },

  buildListModelsRequest(config: BaseProviderConfig) {
    if (!config.apiKey) return null;
    const base = deriveV1ApiBase(config.host || ANTHROPIC_DEFAULT_ORIGIN, 'Anthropic');
    return {
      url: `${base}/models`,
      headers: {
        'X-API-Key': config.apiKey,
        'Anthropic-Version': ANTHROPIC_API_VERSION,
        Accept: 'application/json',
      },
    };
  },
};
