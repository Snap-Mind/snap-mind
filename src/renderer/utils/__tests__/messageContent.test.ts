import { describe, it, expect } from 'vitest';
import { getTextContent } from '../messageContent';
import type { ContentPart } from '@/types/chat';

const mixedParts: ContentPart[] = [
  { type: 'text', text: 'hello' },
  { type: 'image', data: 'abc123', mimeType: 'image/png' },
];

describe('getTextContent', () => {
  it('returns the string as-is when given a string', () => {
    expect(getTextContent('plain text')).toBe('plain text');
  });

  it('extracts text from ContentPart array', () => {
    expect(getTextContent(mixedParts)).toBe('hello');
  });
});
