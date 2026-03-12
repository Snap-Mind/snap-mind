// Google (Gemini) response parser — custom response format.
//
// Response: candidates[0].content.parts[0].text
// Model listing: models[] with name like "models/gemini-pro"

import { ModelSetting } from '@/types/setting';
import { ResponseParser } from '@/types/providers';
import { parseSSEStream } from '../core/sseStreamParser';

export const googleResponseParser: ResponseParser = {
  async parseStreamResponse(res: Response, onToken?: (token: string) => void): Promise<string> {
    // Track whether we're inside a thought block
    let inThought = false;
    let thoughtClosed = false;

    return parseSSEStream(
      res,
      (data) => {
        const parts = data.candidates?.[0]?.content?.parts;
        if (!Array.isArray(parts)) return null;

        let token = '';
        for (const part of parts) {
          if (part.thought) {
            // This is a thinking/thought part
            if (!inThought) {
              inThought = true;
              token += '<think>\n';
            }
            token += part.text || '';
          } else if (part.text) {
            // Regular text part
            if (inThought && !thoughtClosed) {
              inThought = false;
              thoughtClosed = true;
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
