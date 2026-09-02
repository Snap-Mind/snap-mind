import { describe, expect, it, vi } from 'vitest';
import { AIService } from '../AIService.js';
import type { AgentDTO } from '../../../src/types/agent-dto.js';
import type { ProviderDTO } from '../../../src/types/provider-dto.js';

function boundAgent(): AgentDTO {
  return {
    id: 1,
    name: 'Test',
    description: null,
    instructions: 'be helpful',
    providerId: 10,
    modelId: 100,
    temperature: 0.7,
    maxTokens: 2048,
    topP: 0.95,
    reasoning: false,
    webSearch: false,
    isBuiltin: false,
  };
}

function openaiProvider(): ProviderDTO {
  return {
    id: 10,
    kind: 'openai',
    name: 'OpenAI',
    host: 'https://api.openai.com',
    apiKey: 'sk-test',
    description: null,
    models: [
      {
        id: 100,
        modelId: 'gpt-4o',
        name: 'GPT-4o',
        type: null,
        capabilities: [],
        description: null,
      },
    ],
  };
}

function makeService(streamText: ReturnType<typeof vi.fn>) {
  const agents = { list: vi.fn(() => [boundAgent()]) };
  const providers = { list: vi.fn(() => [openaiProvider()]) };
  const createLanguageModel = vi.fn(() => ({ model: 'mock' }));
  const svc = new AIService(agents as never, providers as never, {
    streamText: streamText as never,
    createLanguageModel: createLanguageModel as never,
  });
  return { svc, agents, providers, createLanguageModel, streamText };
}

describe('AIService', () => {
  it('returns error for unbound agent without calling streamText', async () => {
    const streamText = vi.fn();
    const agents = {
      list: vi.fn(() => [{ ...boundAgent(), providerId: null, modelId: null }]),
    };
    const providers = { list: vi.fn(() => [openaiProvider()]) };
    const svc = new AIService(agents as never, providers as never, {
      streamText,
      createLanguageModel: vi.fn(),
    });

    const result = await svc.send(1, [{ role: 'user', content: 'hi' }], {
      onToken: vi.fn(),
      onReasoning: vi.fn(),
      onSource: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    });

    expect(result).toEqual({
      error: {
        code: 'unbound',
        message: 'Agent "Test" has no model. Choose one in Settings > Agents.',
      },
    });
    expect(streamText).not.toHaveBeenCalled();
  });

  it('streams tokens then completes with stop', async () => {
    async function* fullStream() {
      yield { type: 'text-delta', text: 'hello' };
    }
    const streamText = vi.fn(() => ({ fullStream: fullStream() }));
    const { svc } = makeService(streamText);
    const onToken = vi.fn();
    const onDone = vi.fn();

    const result = await svc.send(1, [{ role: 'user', content: 'hi' }], {
      onToken,
      onReasoning: vi.fn(),
      onSource: vi.fn(),
      onDone,
      onError: vi.fn(),
    });

    expect(result).toHaveProperty('streamId');
    await vi.waitFor(() => expect(onToken).toHaveBeenCalledWith('hello'));
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith('stop'));
    expect(streamText).toHaveBeenCalledWith(expect.objectContaining({ reasoning: 'none' }));
  });

  it('passes reasoning medium when agent has reasoning enabled', async () => {
    async function* fullStream() {
      yield { type: 'reasoning-delta', text: 'thinking' };
    }
    const agents = {
      list: vi.fn(() => [{ ...boundAgent(), reasoning: true }]),
    };
    const providers = { list: vi.fn(() => [openaiProvider()]) };
    const streamText = vi.fn(() => ({ fullStream: fullStream() }));
    const svc = new AIService(agents as never, providers as never, {
      streamText: streamText as never,
      createLanguageModel: vi.fn(() => ({ model: 'mock' })) as never,
    });
    const onReasoning = vi.fn();

    await svc.send(1, [{ role: 'user', content: 'hi' }], {
      onToken: vi.fn(),
      onReasoning,
      onSource: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    });

    await vi.waitFor(() => expect(onReasoning).toHaveBeenCalledWith('thinking'));
    expect(streamText).toHaveBeenCalledWith(expect.objectContaining({ reasoning: 'medium' }));
  });

  it('aborts an in-flight stream', async () => {
    let rejectStream: (_err: Error) => void = () => {};
    const streamPromise = new Promise<never>((_, reject) => {
      rejectStream = reject;
    });
    async function* fullStream() {
      yield { type: 'text-delta', text: 'partial' };
      await streamPromise;
      yield { type: 'text-delta', text: '' };
    }
    const streamText = vi.fn(() => ({ fullStream: fullStream() }));
    const { svc } = makeService(streamText);
    const onDone = vi.fn();

    const result = await svc.send(1, [{ role: 'user', content: 'hi' }], {
      onToken: vi.fn(),
      onReasoning: vi.fn(),
      onSource: vi.fn(),
      onDone,
      onError: vi.fn(),
    });

    expect(result).toHaveProperty('streamId');
    const streamId = (result as { streamId: string }).streamId;
    svc.abort(streamId);
    rejectStream(new DOMException('aborted', 'AbortError'));

    await vi.waitFor(() => expect(onDone).toHaveBeenCalledWith('aborted'));
  });

  it('reports stream errors via onError', async () => {
    async function* fullStream(): AsyncGenerator<{ type: string; text: string }> {
      throw new Error('boom');
      yield { type: 'text-delta', text: '' };
    }
    const streamText = vi.fn(() => ({ fullStream: fullStream() }));
    const { svc } = makeService(streamText);
    const onError = vi.fn();

    await svc.send(1, [{ role: 'user', content: 'hi' }], {
      onToken: vi.fn(),
      onReasoning: vi.fn(),
      onSource: vi.fn(),
      onDone: vi.fn(),
      onError,
    });

    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith('boom'));
  });
});
