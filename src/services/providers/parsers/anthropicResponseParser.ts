// Anthropic response parser — custom streaming format and model listing.
//
// Key differences from OpenAI:
// - SSE streaming with content_block_delta events
// - Non-streaming response: content[0].text

import { ModelSetting } from '@/types/setting';
import { ResponseParser } from '@/types/providers';
import { parseSSEStream } from '../core/sseStreamParser';

export const anthropicResponseParser: ResponseParser = {
  async parseStreamResponse(res: Response, onToken?: (token: string) => void): Promise<string> {
    // Track whether we're inside a thinking block
    let inThinking = false;

    return parseSSEStream(
      res,
      (data) => {
        let token = '';

        // Handle thinking block start
        if (data.type === 'content_block_start' && data.content_block?.type === 'thinking') {
          if (!inThinking) {
            inThinking = true;
            token += '<think>\n';
          }
          return token || null;
        }

        // Handle thinking block stop
        if (data.type === 'content_block_stop' && inThinking) {
          inThinking = false;
          token += '\n</think>\n\n';
          return token;
        }

        // Handle thinking delta
        if (data.type === 'content_block_delta' && data.delta?.type === 'thinking_delta') {
          return data.delta?.thinking || null;
        }

        // Handle regular text delta
        if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
          return data.delta?.text || null;
        }

        // Fallback for standard text content
        if (data.type === 'content_block_delta') {
          return data.delta?.text || null;
        }

        return null;
      },
      onToken,
      'Anthropic'
    );
  },

  extractContentFromResponse(data: any): string {
    if (!Array.isArray(data.content)) return '';

    let thinking = '';
    let text = '';

    for (const block of data.content) {
      if (block.type === 'thinking') {
        thinking += block.thinking;
      } else if (block.type === 'text') {
        text += block.text;
      }
    }

    if (thinking) {
      return `<think>\n${thinking}\n</think>\n\n${text}`;
    }
    return text || data.content?.[0]?.text || '';
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
