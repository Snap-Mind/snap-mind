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

function makeContext() {
  return {
    provider: {
      id: 1,
      kind: 'openai',
      name: 'OpenAI',
      apiKey: 'test-key',
      host: 'https://api.openai.com/v1',
      description: null,
      models: [],
    },
    model: {
      id: 10,
      modelId: 'gpt-4',
      name: 'GPT-4',
      type: 'chat',
      capabilities: ['chat'],
      description: null,
    },
    params: { temperature: 0.7, maxTokens: 2048, topP: 0.95 },
  };
}

describe('AIService.sendMessageToAI', () => {
  beforeEach(() => {
    sendMessageSpy.mockReset();
    sendMessageSpy.mockResolvedValue('ok');
  });

  it('filters out role:"error" messages before sending to provider', async () => {
    const service = new AIService(makeContext());
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
    const service = new AIService(makeContext());
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
    const service = new AIService(makeContext());
    const messages: Message[] = [
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ];

    await service.sendMessageToAI(messages, () => {});

    const sent = sendMessageSpy.mock.calls[0][0] as Message[];
    expect(sent).toEqual(messages);
  });

  it('always requests streaming', async () => {
    const service = new AIService(makeContext());
    await service.sendMessageToAI([{ role: 'user', content: 'hi' }], () => {});
    expect(sendMessageSpy.mock.calls[0][1].stream).toBe(true);
  });

  it('falls back to the built-in defaults when params are absent', async () => {
    const { params: _ignored, ...ctx } = makeContext();
    const service = new AIService(ctx);
    await service.sendMessageToAI([{ role: 'user', content: 'hi' }], () => {});
    const opts = sendMessageSpy.mock.calls[0][1];
    expect(opts.temperature).toBe(0.7);
    expect(opts.max_tokens).toBe(2048);
    expect(opts.top_p).toBe(0.95);
  });
});
