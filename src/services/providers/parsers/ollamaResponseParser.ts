// Ollama response parser — NDJSON streaming and custom model listing.
//
// Key differences from all other providers:
// - NDJSON streaming (not SSE)
// - Response: message.content
// - Model listing: /api/tags with models[] array

import { ModelSetting } from '@/types/setting';
import { ResponseParser } from '../core/types';
import { parseNDJSONStream } from '../core/ndjsonStreamParser';

export const ollamaResponseParser: ResponseParser = {
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
