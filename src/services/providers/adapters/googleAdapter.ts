// Google (Gemini) adapter — completely different API format from OpenAI.
//
// Key differences:
// - Message format: contents[] with role (user/model), parts[{text}]
// - System prompt prepended to first user message
// - API key passed as URL query parameter
// - Streaming via ?alt=sse query parameter
// - generationConfig for temperature/topP/topK/maxOutputTokens

import { Message } from '@/types/chat';
import { BaseProviderConfig, GoogleConfig, ProviderOptions } from '@/types/providers';
import { ModelSetting } from '@/types/setting';
import { ProviderAdapter } from '../core/types';
import { parseSSEStream } from '../core/streamParsers';
import { deriveGoogleApiBase } from '../core/urlResolvers';

interface GoogleMessage {
  role: string;
  parts: Array<{ text: string }>;
}

const GOOGLE_DEFAULT_ORIGIN = 'https://generativelanguage.googleapis.com';

export const googleAdapter: ProviderAdapter = {
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

  buildChatBody(
    messages: Message[],
    options: ProviderOptions,
    config: BaseProviderConfig
  ): any {
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

    return {
      contents: googleMessages,
      generationConfig: {
        temperature: options?.temperature,
        maxOutputTokens: options?.max_tokens,
        topP: options?.top_p,
        topK: topK,
      },
    };
  },

  async parseStreamResponse(
    res: Response,
    onToken?: (token: string) => void
  ): Promise<string> {
    return parseSSEStream(
      res,
      (data) => data.candidates?.[0]?.content?.parts?.[0]?.text || null,
      onToken,
      'Google'
    );
  },

  extractContentFromResponse(data: any): string {
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  },

  buildListModelsRequest(config: BaseProviderConfig) {
    if (!config.apiKey) return null;
    const base = deriveGoogleApiBase(config.host || GOOGLE_DEFAULT_ORIGIN);
    return {
      url: `${base}/models?key=${config.apiKey}`,
      headers: { Accept: 'application/json' },
    };
  },

  parseModelsResponse(data: any): ModelSetting[] {
    if (!Array.isArray(data.models)) return [];
    return data.models.map(
      (model: { name: string; displayName?: string; description?: string }) =>
        ({
          id: model.name.split('/').pop(),
          name: model.displayName || model.name,
          type: 'chat',
          capabilities: ['chat'],
          description: model.description || `Google ${model.name} model`,
        }) as ModelSetting
    );
  },
};
