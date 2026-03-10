// Google (Gemini) response parser — custom response format.
//
// Response: candidates[0].content.parts[0].text
// Model listing: models[] with name like "models/gemini-pro"

import { ModelSetting } from '@/types/setting';
import { ResponseParser } from '@/types/providers';
import { parseSSEStream } from '../core/sseStreamParser';

export const googleResponseParser: ResponseParser = {
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
