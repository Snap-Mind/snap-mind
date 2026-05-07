import { ChatSource } from '@/types/chat';
import { ResponseParser } from '@/types/providers';
import { ModelSetting } from '@/types/setting';
import { parseSSEStream } from '../core/sseStreamParser';

export const foundryResponseParser: ResponseParser = {
  async parseStreamResponse(
    res: Response,
    onToken?: (token: string) => void,
    _onWebSources?: (sources: ChatSource[]) => void
  ): Promise<string> {
    let inReasoning = false;
    let inThinking = false;

    const full = await parseSSEStream(
      res,
      (data) => {
        // Anthropic-style streaming (Claude in Foundry)
        if (data.type === 'content_block_start' && data.content_block?.type === 'thinking') {
          if (!inThinking) {
            inThinking = true;
            return '<think>\n';
          }
          return null;
        }
        if (data.type === 'content_block_stop' && inThinking) {
          inThinking = false;
          return '\n</think>\n\n';
        }
        if (data.type === 'content_block_delta' && data.delta?.type === 'thinking_delta') {
          return data.delta?.thinking || null;
        }
        if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
          return data.delta?.text || null;
        }

        // OpenAI-style streaming (GPT in Foundry)
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
      'Azure AI Foundry'
    );

    let closeToken = '';
    if (inThinking) {
      closeToken += '\n</think>\n\n';
      inThinking = false;
    }
    if (inReasoning) {
      closeToken += '\n</think>\n\n';
      inReasoning = false;
    }

    if (closeToken) {
      if (typeof onToken === 'function') onToken(closeToken);
      return full + closeToken;
    }

    return full;
  },

  extractContentFromResponse(data: any): string {
    // Anthropic-style non-streaming
    if (Array.isArray(data.content)) {
      let thinking = '';
      let text = '';
      for (const block of data.content) {
        if (block.type === 'thinking') {
          thinking += block.thinking || '';
        } else if (block.type === 'text') {
          text += block.text || '';
        }
      }
      if (thinking) {
        return `<think>\n${thinking}\n</think>\n\n${text}`;
      }
      return text || data.content?.[0]?.text || '';
    }

    // OpenAI-style non-streaming
    const reasoning = data.choices?.[0]?.message?.reasoning_content;
    const content = data.choices?.[0]?.message?.content || '';
    if (reasoning) {
      return `<think>\n${reasoning}\n</think>\n\n${content}`;
    }
    return content;
  },

  extractWebSourcesFromResponse(_data: any): ChatSource[] {
    return [];
  },

  parseModelsResponse(_data: any): ModelSetting[] {
    return [];
  },
};
