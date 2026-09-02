import { describe, expect, it } from 'vitest';
import { mapMessages } from '../mapMessages.js';
import type { Message } from '../../../src/types/chat.js';

describe('mapMessages', () => {
  it('prepends system instructions when non-empty', () => {
    const history: Message[] = [{ role: 'user', content: 'hi' }];
    const out = mapMessages(history, 'You are helpful.');
    expect(out[0]).toEqual({ role: 'system', content: 'You are helpful.' });
    expect(out[1]).toEqual({ role: 'user', content: 'hi' });
  });

  it('drops error roles', () => {
    const history: Message[] = [
      { role: 'error', content: 'fail' },
      { role: 'user', content: 'hi' },
    ];
    expect(mapMessages(history, '')).toEqual([{ role: 'user', content: 'hi' }]);
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
    expect(mapMessages(history, '')).toEqual([
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
