// OpenAI-compatible response parser factory.
// Handles SSE streaming, non-streaming content extraction, and model list parsing.
// Parameterized to support OpenAI, DeepSeek, Qwen, and Azure with shared logic.

import { ModelSetting } from '@/types/setting';
import { ResponseParser } from '@/types/providers';
import { parseSSEStream } from '../core/sseStreamParser';

export interface OpenAIResponseParserOptions {
  /** Human-readable name used as SSE log tag. */
  providerName: string;
  /** Optional filter applied to the raw model list (default: accept all). */
  modelFilter?: (model: any) => boolean;
  /** Build a description string for a model entry. */
  modelDescription?: (model: any) => string;
}

/**
 * Creates a ResponseParser for any OpenAI-compatible API.
 *
 * All OpenAI-compatible providers share:
 * - SSE streaming with `choices[0].delta.content`
 * - Non-streaming: `choices[0].message.content`
 * - `/models` response with `data[]` array
 */
export function createOpenAIResponseParser(opts: OpenAIResponseParserOptions): ResponseParser {
  const {
    providerName,
    modelFilter = () => true,
    modelDescription = (m: any) => `${providerName} ${m.id} model`,
  } = opts;

  return {
    async parseStreamResponse(res: Response, onToken?: (token: string) => void): Promise<string> {
      // Track whether we're inside a reasoning block
      let inReasoning = false;

      return parseSSEStream(
        res,
        (data) => {
          // Handle reasoning_content (DeepSeek-R1, Qwen QwQ, OpenAI o-series)
          const reasoningContent = data.choices?.[0]?.delta?.reasoning_content;
          const content = data.choices?.[0]?.delta?.content;

          let token = '';

          if (reasoningContent) {
            if (!inReasoning) {
              inReasoning = true;
              token += '<think>\n';
            }
            token += reasoningContent;
          }

          if (content) {
            if (inReasoning) {
              inReasoning = false;
              token += '\n</think>\n\n';
            }
            token += content;
          }

          return token || null;
        },
        onToken,
        providerName
      );
    },

    extractContentFromResponse(data: any): string {
      const reasoning = data.choices?.[0]?.message?.reasoning_content;
      const content = data.choices?.[0]?.message?.content || '';
      if (reasoning) {
        return `<think>\n${reasoning}\n</think>\n\n${content}`;
      }
      return content;
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
