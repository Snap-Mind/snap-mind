// Anthropic adapter — custom message format, headers, and streaming.
//
// Key differences from OpenAI:
// - System prompt is a separate top-level field (not in messages array)
// - Uses X-API-Key header + Anthropic-Version header
// - SSE streaming with content_block_delta events
// - Non-streaming response: content[0].text

import { Message } from '@/types/chat';
import { BaseProviderConfig, ProviderOptions } from '@/types/providers';
import { ModelSetting } from '@/types/setting';
import { ProviderAdapter } from '../core/types';
import { parseSSEStream } from '../core/streamParsers';
import { deriveV1ApiBase } from '../core/urlResolvers';

const ANTHROPIC_DEFAULT_ORIGIN = 'https://api.anthropic.com';
const ANTHROPIC_API_VERSION = '2023-06-01';

export const anthropicAdapter: ProviderAdapter = {
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

  async parseStreamResponse(
    res: Response,
    onToken?: (token: string) => void
  ): Promise<string> {
    return parseSSEStream(
      res,
      (data) =>
        data.type === 'content_block_delta' ? data.delta?.text || null : null,
      onToken,
      'Anthropic'
    );
  },

  extractContentFromResponse(data: any): string {
    return data.content?.[0]?.text || '';
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

  parseModelsResponse(data: any): ModelSetting[] {
    if (!Array.isArray(data.data)) return [];
    return data.data.map(
      (m: { id: string; display_name?: string; description?: string }) =>
        ({
          id: m.id,
          name: m.display_name || m.id,
          type: 'chat',
          capabilities: ['chat'],
          description: m.description || `Anthropic ${m.id} model`,
        }) as ModelSetting
    );
  },
};
