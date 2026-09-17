import { describe, expect, it } from 'vitest';
import { mapMessages } from '../mapMessages.js';
import type { Message } from '../../../src/types/chat.js';

describe('mapMessages', () => {
  it('drops system roles because instructions are passed separately', () => {
    const history: Message[] = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'hi' },
    ];
    expect(mapMessages(history)).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('drops error roles', () => {
    const history: Message[] = [
      { role: 'error', content: 'fail' },
      { role: 'user', content: 'hi' },
    ];
    expect(mapMessages(history)).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('keeps user and assistant turns in order', () => {
    const history: Message[] = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'bye' },
    ];
    expect(mapMessages(history)).toEqual([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'bye' },
    ]);
  });

  it('maps image parts for multimodal user messages', () => {
    const history: Message[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'what is this' },
          { type: 'image', data: 'abc123', mimeType: 'image/png' },
        ],
      },
    ];
    expect(mapMessages(history)).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'what is this' },
          { type: 'image', image: 'abc123', mediaType: 'image/png' },
        ],
      },
    ]);
  });
});
