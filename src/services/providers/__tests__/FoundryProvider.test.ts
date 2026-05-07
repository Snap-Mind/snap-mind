import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnifiedProvider } from '../UnifiedProvider';
import { adapterMap } from '../ProviderFactory';
import { FoundryConfig } from '@/types/providers';
import { Message } from '@/types/chat';
import {
  mockFetchResponse,
  mockSSEResponse,
  mockStreamingFetchResponse,
  setupFetchMock,
} from '../../../../test/utils/mockFetch';

describe('FoundryProvider', () => {
  let provider: UnifiedProvider;
  let config: FoundryConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockReset();

    (window as any).electronAPI = {
      getFoundryCliToken: vi.fn().mockResolvedValue({
        success: true,
        token: 'foundry-access-token',
      }),
    };

    config = {
      id: 'foundry' as any,
      name: 'Azure AI Foundry',
      apiKey: '',
      host: 'https://my-foundry.services.ai.azure.com',
      projectName: 'my-project',
      entraScope: 'https://ai.azure.com/.default',
      models: [],
    };

    provider = new UnifiedProvider(config, adapterMap.foundry);
  });

  it('returns error when host is not configured', async () => {
    provider.config.host = '';
    const result = await provider.sendMessage([{ role: 'user', content: 'hi' }], { model: 'gpt-4.1' });
    expect(result).toBe('Error: Foundry endpoint is not configured');
  });

  it('returns error when model is missing', async () => {
    const result = await provider.sendMessage([{ role: 'user', content: 'hi' }], { model: '' });
    expect(result).toBe('Error: Model not specified for Azure AI Foundry');
  });

  it('builds project URL and uses bearer token header', async () => {
    setupFetchMock(
      mockFetchResponse({
        choices: [{ message: { content: 'foundry response' } }],
      })
    );

    const messages: Message[] = [{ role: 'user', content: 'Hello' }];
    const result = await provider.sendMessage(messages, { model: 'gpt-4.1', stream: false });

    expect(result).toBe('foundry response');
    expect(window.electronAPI.getFoundryCliToken).toHaveBeenCalledWith(
      'https://ai.azure.com/.default'
    );

    const fetchCall = (global.fetch as any).mock.calls[0];
    expect(fetchCall[0]).toBe(
      'https://my-foundry.services.ai.azure.com/api/projects/my-project/openai/v1/chat/completions'
    );
    expect(fetchCall[1].headers).toMatchObject({
      Authorization: 'Bearer foundry-access-token',
      'Content-Type': 'application/json',
    });
  });

  it('keeps host path if already points to project endpoint', async () => {
    provider.config.host = 'https://my-foundry.services.ai.azure.com/api/projects/embedded-project';
    (provider.config as FoundryConfig).projectName = '';

    setupFetchMock(
      mockFetchResponse({
        choices: [{ message: { content: 'ok' } }],
      })
    );

    await provider.sendMessage([{ role: 'user', content: 'test' }], { model: 'gpt-4.1', stream: false });

    const fetchCall = (global.fetch as any).mock.calls[0];
    expect(fetchCall[0]).toBe(
      'https://my-foundry.services.ai.azure.com/api/projects/embedded-project/openai/v1/chat/completions'
    );
  });

  it('handles token retrieval failures with explicit error', async () => {
    (window.electronAPI.getFoundryCliToken as any).mockResolvedValue({
      success: false,
      error: 'Azure CLI is not logged in. Run `az login` and try again.',
    });

    setupFetchMock(
      mockFetchResponse({
        choices: [{ message: { content: 'ignored' } }],
      })
    );

    await expect(
      provider.sendMessage([{ role: 'user', content: 'hello' }], { model: 'gpt-4.1', stream: false })
    ).rejects.toThrow('Azure CLI is not logged in. Run `az login` and try again.');
  });

  it('parses streaming content', async () => {
    const tokens: string[] = [];
    const onToken = vi.fn((token: string) => tokens.push(token));

    (global.fetch as any).mockResolvedValueOnce(
      mockStreamingFetchResponse([
        'data: {"choices":[{"delta":{"content":"Foundry"}}]}\n',
        'data: {"choices":[{"delta":{"content":" stream"}}]}\n',
        'data: [DONE]\n',
      ])
    );

    const result = await provider.sendMessage(
      [{ role: 'user', content: 'stream please' }],
      { model: 'gpt-4.1', stream: true },
      onToken
    );

    expect(result).toBe('Foundry stream');
    expect(tokens).toEqual(['Foundry', ' stream']);
  });

  it('uses max_completion_tokens for gpt-5 models', async () => {
    setupFetchMock(
      mockFetchResponse({
        choices: [{ message: { content: 'ok' } }],
      })
    );

    await provider.sendMessage([{ role: 'user', content: 'hello' }], {
      model: 'gpt-5.5',
      stream: false,
      max_tokens: 1234,
      temperature: 0.7,
      top_p: 0.9,
    });

    const fetchCall = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.max_completion_tokens).toBe(1234);
    expect(body.max_tokens).toBeUndefined();
    expect(body.temperature).toBeUndefined();
    expect(body.top_p).toBeUndefined();
  });

  it('adds reasoning_effort for reasoning-capable gpt models when reasoning enabled', async () => {
    setupFetchMock(
      mockFetchResponse({
        choices: [{ message: { content: 'ok' } }],
      })
    );

    await provider.sendMessage([{ role: 'user', content: 'hello' }], {
      model: 'gpt-5.5',
      stream: false,
      max_tokens: 1500,
      reasoning: true,
    });

    const fetchCall = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.max_completion_tokens).toBe(1500);
    expect(body.reasoning_effort).toBe('medium');
  });

  it('routes claude models to anthropic endpoint with anthropic body', async () => {
    setupFetchMock(
      mockFetchResponse({
        content: [{ type: 'text', text: 'Claude response' }],
      })
    );

    const messages: Message[] = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello Claude' },
    ];

    const result = await provider.sendMessage(messages, {
      model: 'claude-haiku-4-5',
      stream: false,
      max_tokens: 800,
      temperature: 0.3,
      top_p: 0.8,
    });

    expect(result).toBe('Claude response');
    const fetchCall = (global.fetch as any).mock.calls[0];
    expect(fetchCall[0]).toBe('https://my-foundry.services.ai.azure.com/anthropic/v1/messages');
    expect(fetchCall[1].headers).toMatchObject({
      Authorization: 'Bearer foundry-access-token',
      'Anthropic-Version': '2023-06-01',
    });

    const body = JSON.parse(fetchCall[1].body);
    expect(body.messages).toEqual([{ role: 'user', content: 'Hello Claude' }]);
    expect(body.system).toBe('You are helpful');
    expect(body.max_tokens).toBe(800);
    expect(body.temperature).toBe(0.3);
    expect(body.top_p).toBeUndefined();
  });

  it('uses top_p for claude only when temperature is not provided', async () => {
    setupFetchMock(
      mockFetchResponse({
        content: [{ type: 'text', text: 'Claude response' }],
      })
    );

    await provider.sendMessage([{ role: 'user', content: 'Hello Claude' }], {
      model: 'claude-haiku-4-5',
      stream: false,
      max_tokens: 800,
      top_p: 0.85,
    });

    const fetchCall = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.temperature).toBeUndefined();
    expect(body.top_p).toBe(0.85);
  });

  it('parses claude streaming format', async () => {
    setupFetchMock(
      mockSSEResponse([
        { type: 'content_block_start', data: { content_block: { type: 'thinking' } } },
        {
          type: 'content_block_delta',
          data: { delta: { type: 'thinking_delta', thinking: 'let me think' } },
        },
        { type: 'content_block_stop', data: {} },
        { type: 'content_block_delta', data: { delta: { type: 'text_delta', text: 'done' } } },
      ])
    );

    const result = await provider.sendMessage(
      [{ role: 'user', content: 'Think' }],
      { model: 'claude-haiku-4-5', stream: true },
      vi.fn()
    );

    expect(result).toBe('<think>\nlet me think\n</think>\n\ndone');
  });

  it('closes think block when openai-style reasoning stream ends without content', async () => {
    const tokens: string[] = [];
    const onToken = vi.fn((token: string) => tokens.push(token));

    (global.fetch as any).mockResolvedValueOnce(
      mockStreamingFetchResponse([
        'data: {"choices":[{"delta":{"reasoning_content":"step1"}}]}\n',
        'data: {"choices":[{"delta":{"reasoning_content":" step2"}}]}\n',
        'data: [DONE]\n',
      ])
    );

    const result = await provider.sendMessage(
      [{ role: 'user', content: 'reason only' }],
      { model: 'gpt-4.1', stream: true },
      onToken
    );

    expect(result).toBe('<think>\nstep1 step2\n</think>\n\n');
    expect(tokens).toEqual(['<think>\nstep1', ' step2', '\n</think>\n\n']);
  });

  it('closes think block when claude thinking stream ends without stop event', async () => {
    const tokens: string[] = [];
    const onToken = vi.fn((token: string) => tokens.push(token));

    setupFetchMock(
      mockStreamingFetchResponse([
        'data: {"type":"content_block_start","content_block":{"type":"thinking"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"let me think"}}\n\n',
        'data: [DONE]\n\n',
      ])
    );

    const result = await provider.sendMessage(
      [{ role: 'user', content: 'Think' }],
      { model: 'claude-haiku-4-5', stream: true },
      onToken
    );

    expect(result).toBe('<think>\nlet me think\n</think>\n\n');
    expect(tokens).toEqual(['<think>\n', 'let me think', '\n</think>\n\n']);
  });
});
