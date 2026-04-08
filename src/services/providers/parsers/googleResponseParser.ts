// Google (Gemini) response parser — custom response format.
//
// Response: candidates[0].content.parts[0].text
// Model listing: models[] with name like "models/gemini-pro"

import { ModelSetting } from '@/types/setting';
import { ChatSource } from '@/types/chat';
import { ResponseParser } from '@/types/providers';
import { parseSSEStream } from '../core/sseStreamParser';
import { extractGeminiSources, deduplicateSources } from './extractWebSources';

export const googleResponseParser: ResponseParser = {
  async parseStreamResponse(
    res: Response,
    onToken?: (token: string) => void,
    onWebSources?: (sources: ChatSource[]) => void
  ): Promise<string> {
    let inThought = false;
    let collectedSources: ChatSource[] = [];

    const result = await parseSSEStream(
      res,
      (data) => {
        if (onWebSources) {
          const chunkSources = extractGeminiSources(data);
          if (chunkSources.length > 0) {
            collectedSources = deduplicateSources([...collectedSources, ...chunkSources]);
            onWebSources(collectedSources);
          }
        }

        const parts = data.candidates?.[0]?.content?.parts;
        if (!Array.isArray(parts)) return null;

        let token = '';
        for (const part of parts) {
          if (part.thought) {
            if (!inThought) {
              inThought = true;
              token += '<think>\n';
            }
            token += part.text || '';
          } else if (part.text) {
            if (inThought) {
              inThought = false;
              token += '\n</think>\n\n';
            }
            token += part.text;
          }
        }

        return token || null;
      },
      onToken,
      'Google'
    );

    return result;
  },

  extractContentFromResponse(data: any): string {
    const parts = data.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return '';

    let thinking = '';
    let text = '';

    for (const part of parts) {
      if (part.thought) {
        thinking += part.text || '';
      } else {
        text += part.text || '';
      }
    }

    if (thinking) {
      return `<think>\n${thinking}\n</think>\n\n${text}`;
    }
    return text || data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  },

  extractWebSourcesFromResponse(data: any): ChatSource[] {
    return extractGeminiSources(data);
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
