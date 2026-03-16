/**
 * attachmentFormatters — convert Message.attachments into provider-specific content parts.
 *
 * Each formatter takes a Message and returns the body-level representation
 * that the respective API expects.  If the message has no attachments the
 * formatter returns the plain string content so the adapter can fall through
 * to its original behaviour.
 */

import type { Attachment, Message } from '@/types/chat';

// ────────────────────────────────────────────────────────────
// OpenAI / Azure / DeepSeek / Qwen  (OpenAI-compatible format)
// ────────────────────────────────────────────────────────────

export interface OpenAIContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: string };
}

/**
 * Converts a Message into the OpenAI multimodal `content` array.
 * Returns a plain string when no attachments are present.
 */
export function toOpenAIContent(msg: Message): string | OpenAIContentPart[] {
  if (!msg.attachments?.length) return msg.content;

  const parts: OpenAIContentPart[] = [];
  if (msg.content) {
    parts.push({ type: 'text', text: msg.content });
  }
  for (const att of msg.attachments) {
    parts.push({
      type: 'image_url',
      image_url: { url: `data:${att.mimeType};base64,${att.data}`, detail: 'auto' },
    });
  }
  return parts;
}

/**
 * Build an OpenAI-compatible messages array, converting attachments
 * for each user message while leaving other roles unchanged.
 */
export function toOpenAIMessages(
  messages: Message[]
): Array<{ role: string; content: string | OpenAIContentPart[] }> {
  return messages.map((m) => ({
    role: m.role,
    content: m.role === 'user' ? toOpenAIContent(m) : m.content,
  }));
}

// ────────────────────────────────────────────────────────────
// Anthropic
// ────────────────────────────────────────────────────────────

export interface AnthropicContentBlock {
  type: 'text' | 'image';
  text?: string;
  source?: { type: 'base64'; media_type: string; data: string };
}

export function toAnthropicContent(msg: Message): string | AnthropicContentBlock[] {
  if (!msg.attachments?.length) return msg.content;

  const blocks: AnthropicContentBlock[] = [];
  for (const att of msg.attachments) {
    blocks.push({
      type: 'image',
      source: { type: 'base64', media_type: att.mimeType, data: att.data },
    });
  }
  if (msg.content) {
    blocks.push({ type: 'text', text: msg.content });
  }
  return blocks;
}

// ────────────────────────────────────────────────────────────
// Google Gemini
// ────────────────────────────────────────────────────────────

export interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

export function toGeminiParts(msg: Message): GeminiPart[] {
  const parts: GeminiPart[] = [];
  if (msg.attachments?.length) {
    for (const att of msg.attachments) {
      parts.push({ inline_data: { mime_type: att.mimeType, data: att.data } });
    }
  }
  if (msg.content) {
    parts.push({ text: msg.content });
  }
  return parts;
}

// ────────────────────────────────────────────────────────────
// Ollama
// ────────────────────────────────────────────────────────────

/**
 * Returns the `images` array for Ollama (raw base64 strings, no prefix).
 * Returns undefined when there are no attachments so the caller can omit
 * the field entirely.
 */
export function toOllamaImages(attachments?: Attachment[]): string[] | undefined {
  if (!attachments?.length) return undefined;
  return attachments.map((att) => att.data);
}
