import { describe, it, expect } from 'vitest';
import {
  getTextContent,
  hasImages,
  toOpenAIContent,
  toAnthropicContent,
  toGoogleParts,
  toOllamaMessage,
} from '../core/messageUtils';
import { ContentPart } from '@/types/chat';

const textPart: ContentPart = { type: 'text', text: 'hello' };
const imgPart: ContentPart = { type: 'image', data: 'abc123', mimeType: 'image/png' };
const mixedParts: ContentPart[] = [textPart, imgPart];
const textOnlyParts: ContentPart[] = [
  { type: 'text', text: 'one' },
  { type: 'text', text: 'two' },
];
const imageOnlyParts: ContentPart[] = [imgPart];

describe('getTextContent', () => {
  it('returns the string as-is when given a string', () => {
    expect(getTextContent('plain text')).toBe('plain text');
  });

  it('extracts text from ContentPart array', () => {
    expect(getTextContent(mixedParts)).toBe('hello');
  });

  it('concatenates multiple text parts', () => {
    expect(getTextContent(textOnlyParts)).toBe('onetwo');
  });

  it('returns empty string when only images', () => {
    expect(getTextContent(imageOnlyParts)).toBe('');
  });

  it('returns empty string for empty array', () => {
    expect(getTextContent([])).toBe('');
  });
});

describe('hasImages', () => {
  it('returns false for a plain string', () => {
    expect(hasImages('text')).toBe(false);
  });

  it('returns true when array contains an image part', () => {
    expect(hasImages(mixedParts)).toBe(true);
  });

  it('returns false when array has only text parts', () => {
    expect(hasImages(textOnlyParts)).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(hasImages([])).toBe(false);
  });
});

describe('toOpenAIContent', () => {
  it('returns string as-is', () => {
    expect(toOpenAIContent('hello')).toBe('hello');
  });

  it('returns plain text when array has no images', () => {
    expect(toOpenAIContent(textOnlyParts)).toBe('onetwo');
  });

  it('converts mixed parts to OpenAI format', () => {
    const result = toOpenAIContent(mixedParts);
    expect(result).toEqual([
      { type: 'text', text: 'hello' },
      {
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,abc123' },
      },
    ]);
  });

  it('converts image-only parts to OpenAI format', () => {
    const result = toOpenAIContent(imageOnlyParts);
    expect(result).toEqual([
      {
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,abc123' },
      },
    ]);
  });
});

describe('toAnthropicContent', () => {
  it('returns string as-is', () => {
    expect(toAnthropicContent('hello')).toBe('hello');
  });

  it('returns plain text when array has no images', () => {
    expect(toAnthropicContent(textOnlyParts)).toBe('onetwo');
  });

  it('converts mixed parts to Anthropic format', () => {
    const result = toAnthropicContent(mixedParts);
    expect(result).toEqual([
      { type: 'text', text: 'hello' },
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: 'abc123' },
      },
    ]);
  });
});

describe('toGoogleParts', () => {
  it('wraps a string in a text part array', () => {
    expect(toGoogleParts('hello')).toEqual([{ text: 'hello' }]);
  });

  it('converts text ContentPart to Google format', () => {
    expect(toGoogleParts([textPart])).toEqual([{ text: 'hello' }]);
  });

  it('converts image ContentPart to inlineData format', () => {
    expect(toGoogleParts(imageOnlyParts)).toEqual([
      { inlineData: { mimeType: 'image/png', data: 'abc123' } },
    ]);
  });

  it('converts mixed parts to Google format', () => {
    expect(toGoogleParts(mixedParts)).toEqual([
      { text: 'hello' },
      { inlineData: { mimeType: 'image/png', data: 'abc123' } },
    ]);
  });
});

describe('toOllamaMessage', () => {
  it('returns content string when given a string', () => {
    expect(toOllamaMessage('hello')).toEqual({ content: 'hello' });
  });

  it('returns content without images key when no images', () => {
    const result = toOllamaMessage(textOnlyParts);
    expect(result).toEqual({ content: 'onetwo' });
    expect(result).not.toHaveProperty('images');
  });

  it('returns content and images for mixed parts', () => {
    expect(toOllamaMessage(mixedParts)).toEqual({
      content: 'hello',
      images: ['abc123'],
    });
  });

  it('returns empty content with images for image-only parts', () => {
    expect(toOllamaMessage(imageOnlyParts)).toEqual({
      content: '',
      images: ['abc123'],
    });
  });
});
