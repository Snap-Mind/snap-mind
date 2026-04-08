// Ollama response parser — NDJSON streaming and custom model listing.
//
// Key differences from all other providers:
// - NDJSON streaming (not SSE)
// - Response: message.content; with `think` enabled also message.thinking (reasoning trace)
// - Model listing: /api/tags with models[] array

import { ModelSetting } from '@/types/setting';
import { ChatSource } from '@/types/chat';
import { ResponseParser } from '@/types/providers';
import { parseNDJSONStream } from '../core/ndjsonStreamParser';

export const ollamaResponseParser: ResponseParser = {
  async parseStreamResponse(
    res: Response,
    onToken?: (token: string) => void,
    _onWebSources?: (sources: ChatSource[]) => void
  ): Promise<string> {
    let inThinking = false;

    const full = await parseNDJSONStream(
      res,
      (obj) => {
        const thinking = obj?.message?.thinking;
        const content = obj?.message?.content;
        let token = '';

        if (thinking) {
          if (!inThinking) {
            inThinking = true;
            token += '<think>\n';
          }
          token += thinking;
        }

        if (content) {
          if (inThinking) {
            inThinking = false;
            token += '\n</think>\n\n';
          }
          token += content;
        }

        return token || null;
      },
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

    if (inThinking) {
      const close = '\n</think>\n\n';
      if (typeof onToken === 'function') onToken(close);
      return full + close;
    }

    return full;
  },

  extractContentFromResponse(data: any): string {
    const thinking = data?.message?.thinking;
    const content = data?.message?.content || '';
    if (thinking) {
      return `<think>\n${thinking}\n</think>\n\n${content}`;
    }
    return content;
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
