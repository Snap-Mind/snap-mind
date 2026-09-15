import type { ModelMessage } from 'ai';
import type { ContentPart, Message } from '../../src/types/chat.js';

function mapContent(content: string | ContentPart[]): string | ModelMessage['content'] {
  if (typeof content === 'string') return content;
  return content.map((part) => {
    if (part.type === 'text') {
      return { type: 'text' as const, text: part.text };
    }
    return {
      type: 'image' as const,
      image: part.data,
      mediaType: part.mimeType,
    };
  });
}

/**
 * Maps chat history to AI SDK messages.
 *
 * `system` roles are dropped on purpose. AI SDK 7 rejects system messages in
 * `messages`; agent instructions go through `streamText({ instructions })`.
 */
export function mapMessages(history: Message[]): ModelMessage[] {
  const out: ModelMessage[] = [];
  for (const message of history) {
    if (message.role === 'error' || message.role === 'system') continue;
    out.push({
      role: message.role,
      content: mapContent(message.content),
    } as ModelMessage);
  }
  return out;
}
