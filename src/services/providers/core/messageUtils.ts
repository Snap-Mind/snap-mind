import { ContentPart } from '@/types/chat';

export function getTextContent(content: string | ContentPart[]): string {
  if (typeof content === 'string') return content;
  return content
    .filter((p): p is Extract<ContentPart, { type: 'text' }> => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export function hasImages(content: string | ContentPart[]): boolean {
  if (typeof content === 'string') return false;
  return content.some((p) => p.type === 'image');
}

export function toOpenAIContent(content: string | ContentPart[]): string | any[] {
  if (typeof content === 'string') return content;
  if (!hasImages(content)) return getTextContent(content);
  return content.map((part) => {
    if (part.type === 'text') {
      return { type: 'text', text: part.text };
    }
    return {
      type: 'image_url',
      image_url: { url: `data:${part.mimeType};base64,${part.data}` },
    };
  });
}

export function toAnthropicContent(content: string | ContentPart[]): string | any[] {
  if (typeof content === 'string') return content;
  if (!hasImages(content)) return getTextContent(content);
  return content.map((part) => {
    if (part.type === 'text') {
      return { type: 'text', text: part.text };
    }
    return {
      type: 'image',
      source: { type: 'base64', media_type: part.mimeType, data: part.data },
    };
  });
}

export function toGoogleParts(content: string | ContentPart[]): any[] {
  if (typeof content === 'string') return [{ text: content }];
  return content.map((part) => {
    if (part.type === 'text') {
      return { text: part.text };
    }
    return { inlineData: { mimeType: part.mimeType, data: part.data } };
  });
}

export function toOllamaMessage(content: string | ContentPart[]): {
  content: string;
  images?: string[];
} {
  if (typeof content === 'string') return { content };
  const text = getTextContent(content);
  const images = content
    .filter((p): p is Extract<ContentPart, { type: 'image' }> => p.type === 'image')
    .map((p) => p.data);
  if (images.length === 0) return { content: text };
  return { content: text, images };
}
