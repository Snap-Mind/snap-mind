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

export function mapMessages(history: Message[], instructions: string): ModelMessage[] {
  const out: ModelMessage[] = [];
  if (instructions.trim()) {
    out.push({ role: 'system', content: instructions });
  }
  for (const message of history) {
    if (message.role === 'error') continue;
    out.push({
      role: message.role,
      content: mapContent(message.content),
    } as ModelMessage);
  }
  return out;
}
