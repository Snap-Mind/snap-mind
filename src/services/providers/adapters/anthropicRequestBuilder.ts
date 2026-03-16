// Anthropic request builder — custom message format, headers, and system prompt handling.
//
// Key differences from OpenAI:
// - System prompt is a separate top-level field (not in messages array)
// - Uses X-API-Key header + Anthropic-Version header

import { Message } from '@/types/chat';
import { BaseProviderConfig, ProviderOptions } from '@/types/providers';
import { RequestBuilder } from '@/types/providers';
import { deriveV1ApiBase } from '../core/urlResolvers';
import { toAnthropicContent } from '../core/attachmentFormatters';

const ANTHROPIC_DEFAULT_ORIGIN = 'https://api.anthropic.com';
const ANTHROPIC_API_VERSION = '2023-06-01';

// Extended thinking budget constants (per Anthropic docs)
const THINKING_BUDGET_RATIO = 0.8;
const MIN_THINKING_BUDGET_TOKENS = 1024;
const DEFAULT_MAX_TOKENS_FALLBACK = 2048;

export const anthropicRequestBuilder: RequestBuilder = {
  providerName: 'Anthropic',
  requiresApiKey: true,

  buildChatUrl(config: BaseProviderConfig): string {
    const base = deriveV1ApiBase(config.host || ANTHROPIC_DEFAULT_ORIGIN, 'Anthropic');
    return `${base}/messages`;
  },

  buildChatHeaders(config: BaseProviderConfig, options?: ProviderOptions): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': config.apiKey,
      'Anthropic-Version': ANTHROPIC_API_VERSION,
    };
    // Extended thinking requires the beta header
    if (options?.reasoning) {
      headers['Anthropic-Beta'] = 'interleaved-thinking-2025-05-14';
    }
    return headers;
  },

  buildChatBody(messages: Message[], options: ProviderOptions): any {
    // Separate system prompt from conversation messages
    let systemPrompt = '';
    const anthropicMessages: { role: string; content: any }[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        systemPrompt = message.content;
      } else {
        anthropicMessages.push({
          role: message.role,
          // Convert user messages with attachments to Anthropic content blocks
          content: message.role === 'user' ? toAnthropicContent(message) : message.content,
        });
      }
    }

    const body: any = {
      model: options?.model,
      messages: anthropicMessages,
      system: systemPrompt,
      max_tokens: options?.max_tokens,
      stream: options?.stream !== undefined ? options.stream : true,
    };

    if (options?.reasoning) {
      // Extended thinking: temperature must be 1, add thinking budget
      body.temperature = 1;

      let budgetTokens: number;
      const userMaxTokens =
        typeof options?.max_tokens === 'number' ? options.max_tokens : undefined;

      if (userMaxTokens && userMaxTokens > 0) {
        const baseBudget = Math.floor(userMaxTokens * THINKING_BUDGET_RATIO);
        budgetTokens = Math.min(userMaxTokens, Math.max(MIN_THINKING_BUDGET_TOKENS, baseBudget));
      } else {
        const baseBudget = Math.floor(DEFAULT_MAX_TOKENS_FALLBACK * THINKING_BUDGET_RATIO);
        budgetTokens = Math.max(MIN_THINKING_BUDGET_TOKENS, baseBudget);
      }

      body.thinking = {
        type: 'enabled',
        budget_tokens: budgetTokens,
      };
    } else {
      body.temperature = options?.temperature;
      body.top_p = options?.top_p;
    }

    return body;
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
