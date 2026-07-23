import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AIService } from '../AIService';
import type { Message } from '@/types/chat';

const sendMessageSpy = vi.fn();

vi.mock('../providers/ProviderFactory', () => ({
  default: {
    createProvider: vi.fn(() => ({
      sendMessage: sendMessageSpy,
      getModels: vi.fn(),
    })),
  },
}));

function makeSettings() {
  return {
    chat: {
      defaultProvider: 'openai',
      defaultModel: 'gpt-4',
      temperature: 0.7,
      max_tokens: 2048,
      top_p: 0.95,
      streamingEnabled: true,
      reasoningEnabled: false,
      webSearchEnabled: false,
    },
    providers: [
      {
        id: 'openai',
        name: 'OpenAI',
        apiKey: 'test-key',
        host: 'https://api.openai.com/v1',
        models: [{ id: 'gpt-4' }],
      },
    ],
  } as any;
}

describe('AIService.sendMessageToAI', () => {
  beforeEach(() => {
    sendMessageSpy.mockReset();
    sendMessageSpy.mockResolvedValue('ok');
  });

  it('filters out role:"error" messages before sending to provider', async () => {
    const service = new AIService(makeSettings());
    const messages: Message[] = [
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'error', content: 'Failed to get response.', detail: 'API error: 401' },
      { role: 'user', content: 'try again' },
    ];

    await service.sendMessageToAI(messages, () => {});

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    const sent = sendMessageSpy.mock.calls[0][0] as Message[];
    expect(sent).toHaveLength(3);
    expect(sent.every((m) => m.role !== 'error')).toBe(true);
    expect(sent.map((m) => m.content)).toEqual(['hi', 'hello', 'try again']);
  });

  it('preserves role:"system" messages when sending', async () => {
    const service = new AIService(makeSettings());
    const messages: Message[] = [
      { role: 'user', content: 'do it' },
      { role: 'system', content: 'Response is aborted.' },
      { role: 'user', content: 'retry' },
    ];

    await service.sendMessageToAI(messages, () => {});

    const sent = sendMessageSpy.mock.calls[0][0] as Message[];
    expect(sent).toEqual(messages);
  });

  it('preserves user and assistant messages in order', async () => {
    const service = new AIService(makeSettings());
    const messages: Message[] = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ];

    await service.sendMessageToAI(messages, () => {});

    const sent = sendMessageSpy.mock.calls[0][0] as Message[];
    expect(sent).toEqual(messages);
  });
});
