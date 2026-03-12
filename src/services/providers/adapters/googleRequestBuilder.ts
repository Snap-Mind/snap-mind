// Google (Gemini) request builder — completely different API format from OpenAI.
//
// Key differences:
// - Message format: contents[] with role (user/model), parts[{text}]
// - System prompt prepended to first user message
// - API key passed as URL query parameter
// - Streaming via ?alt=sse query parameter
// - generationConfig for temperature/topP/topK/maxOutputTokens

import { Message } from '@/types/chat';
import { BaseProviderConfig, GoogleConfig, ProviderOptions } from '@/types/providers';
import { RequestBuilder } from '@/types/providers';
import { deriveGoogleApiBase } from '../core/urlResolvers';

interface GoogleMessage {
  role: string;
  parts: Array<{ text: string }>;
}

const GOOGLE_DEFAULT_ORIGIN = 'https://generativelanguage.googleapis.com';

// Thinking budget constants (per Google Gemini docs)
const THINKING_BUDGET_RATIO = 0.8;
const MIN_THINKING_BUDGET_TOKENS = 128;
const DEFAULT_MAX_TOKENS_FALLBACK = 2048;

export const googleRequestBuilder: RequestBuilder = {
  providerName: 'Google AI',
  requiresApiKey: true,

  buildChatUrl(config: BaseProviderConfig, options?: ProviderOptions): string {
    const base = deriveGoogleApiBase(config.host || GOOGLE_DEFAULT_ORIGIN);
    const model = options?.model;
    const streaming = options?.stream !== false;
    return `${base}/models/${model}:generateContent?key=${config.apiKey}${streaming ? '&alt=sse' : ''}`;
  },

  buildChatHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    };
  },

  buildChatBody(messages: Message[], options: ProviderOptions, config: BaseProviderConfig): any {
    const googleConfig = config as GoogleConfig;
    const topK = googleConfig.config?.topK;

    // Convert messages to Google format
    const googleMessages: GoogleMessage[] = [];
    let systemPrompt = '';

    for (const message of messages) {
      if (message.role === 'system') {
        systemPrompt = message.content;
      } else if (message.role === 'user') {
        googleMessages.push({ role: 'user', parts: [{ text: message.content }] });
      } else if (message.role === 'assistant') {
        googleMessages.push({ role: 'model', parts: [{ text: message.content }] });
      }
    }

    // Prepend system prompt to first user message
    if (systemPrompt && googleMessages.length > 0) {
      for (let i = 0; i < googleMessages.length; i++) {
        if (googleMessages[i].role === 'user') {
          const originalContent = googleMessages[i].parts[0].text;
          googleMessages[i].parts[0].text = `${systemPrompt}\n\n${originalContent}`;
          break;
        }
      }
    } else if (systemPrompt) {
      googleMessages.push({ role: 'user', parts: [{ text: systemPrompt }] });
    }

    const generationConfig: any = {
      temperature: options?.temperature,
      maxOutputTokens: options?.max_tokens,
      topP: options?.top_p,
      topK: topK,
    };

    // Gemini thinking mode: add thinkingConfig
    if (options?.reasoning) {
      const maxTokens = options?.max_tokens;
      let thinkingBudget: number;

      if (typeof maxTokens === 'number' && maxTokens > 0) {
        const baseBudget = Math.floor(maxTokens * THINKING_BUDGET_RATIO);
        thinkingBudget = Math.min(maxTokens, Math.max(MIN_THINKING_BUDGET_TOKENS, baseBudget));
      } else {
        const baseBudget = Math.floor(DEFAULT_MAX_TOKENS_FALLBACK * THINKING_BUDGET_RATIO);
        thinkingBudget = Math.max(MIN_THINKING_BUDGET_TOKENS, baseBudget);
      }

      generationConfig.thinkingConfig = {
        thinkingBudget,
      };
    }

    return {
      contents: googleMessages,
      generationConfig,
    };
  },

  buildListModelsRequest(config: BaseProviderConfig) {
    if (!config.apiKey) return null;
    const base = deriveGoogleApiBase(config.host || GOOGLE_DEFAULT_ORIGIN);
    return {
      url: `${base}/models?key=${config.apiKey}`,
      headers: { Accept: 'application/json' },
    };
  },
};
