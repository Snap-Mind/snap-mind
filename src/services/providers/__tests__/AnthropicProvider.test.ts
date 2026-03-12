import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnifiedProvider } from '../UnifiedProvider';
import { adapterMap } from '../ProviderFactory';
import { anthropicRequestBuilder } from '../adapters/anthropicRequestBuilder';
import { deriveV1ApiBase } from '../core/urlResolvers';
import { AnthropicConfig, ProviderOptions } from '@/types/providers';
import { Message } from '@/types/chat';
import {
  mockFetchResponse,
  mockSSEResponse,
  setupFetchMock,
  setupFetchError,
} from '../../../../test/utils/mockFetch';

// URL helpers (previously private methods on the wrapper class)
const buildMessagesUrl = (host: string) => deriveV1ApiBase(host, 'Anthropic') + '/messages';
const buildModelsUrl = (host: string) => deriveV1ApiBase(host, 'Anthropic') + '/models';

describe('AnthropicProvider', () => {
  let provider: UnifiedProvider;
  let config: AnthropicConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
    config = {
      id: 'anthropic' as any,
      name: 'Anthropic',
      apiKey: 'test-api-key',
      host: 'https://api.anthropic.com',
      models: [],
    };
    provider = new UnifiedProvider(config, adapterMap.anthropic);
  });

  describe('URL building with various host formats', () => {
    it('should handle default Anthropic host', () => {
      const url = buildMessagesUrl('https://api.anthropic.com');
      expect(url).toBe('https://api.anthropic.com/v1/messages');
    });

    it('should handle host with /v1 already', () => {
      const url = buildMessagesUrl('https://api.anthropic.com/v1');
      expect(url).toBe('https://api.anthropic.com/v1/messages');
    });

    it('should handle host without version', () => {
      const url = buildMessagesUrl('https://custom-anthropic.com');
      expect(url).toBe('https://custom-anthropic.com/v1/messages');
    });

    it('should handle custom proxy with nested paths', () => {
      const url = buildMessagesUrl('https://proxy.com/anthropic/v1');
      expect(url).toBe('https://proxy.com/anthropic/v1/messages');
    });

    it('should handle host with port', () => {
      const url = buildMessagesUrl('https://localhost:8080/v1');
      expect(url).toBe('https://localhost:8080/v1/messages');
    });

    it('should handle host with trailing slash', () => {
      const url = buildMessagesUrl('https://api.anthropic.com/');
      expect(url).toBe('https://api.anthropic.com/v1/messages');
    });

    it('should handle custom path without v1', () => {
      const url = buildMessagesUrl('https://custom.com/api/anthropic');
      expect(url).toBe('https://custom.com/api/anthropic/v1/messages');
    });

    it('should throw error on invalid URL', () => {
      expect(() => {
        buildMessagesUrl('not-a-valid-url');
      }).toThrow('Invalid Anthropic host URL');
    });
  });

  describe('sendMessage', () => {
    it('should return error when API key is not configured', async () => {
      provider.config.apiKey = '';
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];

      const result = await provider.sendMessage(messages, { model: 'claude-3-opus-20240229' });

      expect(result).toBe('Error: Anthropic API key not configured');
    });

    it('should return error when model is not specified', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];

      const result = await provider.sendMessage(messages, { model: '' });

      expect(result).toBe('Error: Model not specified for Anthropic');
    });

    it('should send message successfully with non-streaming response', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      const mockResponse = {
        content: [{ text: 'Hello! How can I help you?' }],
      };

      setupFetchMock(mockFetchResponse(mockResponse));

      const result = await provider.sendMessage(messages, {
        model: 'claude-3-opus-20240229',
        stream: false,
      });

      expect(result).toBe('Hello! How can I help you?');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-API-Key': 'test-api-key',
            'Anthropic-Version': '2023-06-01',
          }),
        })
      );
    });

    it('should handle system prompt correctly', async () => {
      const messages: Message[] = [
        { role: 'system', content: 'You are a helpful assistant' },
        { role: 'user', content: 'Hello' },
      ];

      setupFetchMock(
        mockFetchResponse({
          content: [{ text: 'Hi there!' }],
        })
      );

      await provider.sendMessage(messages, {
        model: 'claude-3-opus-20240229',
        stream: false,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.system).toBe('You are a helpful assistant');
      expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    });

    it('should handle streaming response', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Count to 3' }];
      const tokens: string[] = [];
      const onToken = vi.fn((token: string) => tokens.push(token));

      setupFetchMock(
        mockSSEResponse([
          { data: { delta: { text: 'One' } } },
          { data: { delta: { text: ', ' } } },
          { data: { delta: { text: 'two' } } },
          { data: { delta: { text: ', ' } } },
          { data: { delta: { text: 'three' } } },
        ])
      );

      const result = await provider.sendMessage(
        messages,
        { model: 'claude-3-opus-20240229', stream: true },
        onToken
      );

      expect(result).toBe('One, two, three');
      expect(onToken).toHaveBeenCalledTimes(5);
      expect(tokens).toEqual(['One', ', ', 'two', ', ', 'three']);
    });

    it('should handle streaming response with thinking blocks', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Think about this' }];
      const tokens: string[] = [];
      const onToken = vi.fn((token: string) => tokens.push(token));

      setupFetchMock(
        mockSSEResponse([
          { type: 'content_block_start', data: { content_block: { type: 'thinking' } } },
          {
            type: 'content_block_delta',
            data: { delta: { type: 'thinking_delta', thinking: 'Let me think...' } },
          },
          {
            type: 'content_block_delta',
            data: { delta: { type: 'thinking_delta', thinking: ' deeply.' } },
          },
          { type: 'content_block_stop', data: {} },
          {
            type: 'content_block_delta',
            data: { delta: { type: 'text_delta', text: 'The answer is 42.' } },
          },
        ])
      );

      const result = await provider.sendMessage(
        messages,
        { model: 'claude-3-opus-20240229', stream: true },
        onToken
      );

      expect(result).toBe('<think>\nLet me think... deeply.\n</think>\n\nThe answer is 42.');
    });

    it('should handle non-streaming response with thinking blocks', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Think about this' }];

      setupFetchMock(
        mockFetchResponse({
          content: [
            { type: 'thinking', thinking: 'Let me reason carefully.' },
            { type: 'text', text: 'The answer is 42.' },
          ],
        })
      );

      const result = await provider.sendMessage(messages, {
        model: 'claude-3-opus-20240229',
        stream: false,
      });

      expect(result).toBe('<think>\nLet me reason carefully.\n</think>\n\nThe answer is 42.');
    });

    it('should handle streaming response without thinking blocks', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      const tokens: string[] = [];
      const onToken = vi.fn((token: string) => tokens.push(token));

      setupFetchMock(
        mockSSEResponse([
          { type: 'content_block_delta', data: { delta: { type: 'text_delta', text: 'Hello!' } } },
        ])
      );

      const result = await provider.sendMessage(
        messages,
        { model: 'claude-3-opus-20240229', stream: true },
        onToken
      );

      expect(result).toBe('Hello!');
      expect(result).not.toContain('<think>');
    });

    it('should handle API errors', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];

      setupFetchMock(mockFetchResponse({ error: 'Invalid API key' }, { ok: false, status: 401 }));

      await expect(
        provider.sendMessage(messages, { model: 'claude-3-opus-20240229' })
      ).rejects.toThrow('API error: 401');
    });

    it('should pass optional parameters correctly', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];

      setupFetchMock(
        mockFetchResponse({
          content: [{ text: 'Response' }],
        })
      );

      await provider.sendMessage(messages, {
        model: 'claude-3-opus-20240229',
        stream: false,
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 1024,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.temperature).toBe(0.7);
      expect(body.top_p).toBe(0.9);
      expect(body.max_tokens).toBe(1024);
    });

    it('should handle abort signal', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      const abortController = new AbortController();

      setupFetchMock(
        mockFetchResponse({
          content: [{ text: 'Response' }],
        })
      );

      await provider.sendMessage(messages, {
        model: 'claude-3-opus-20240229',
        stream: false,
        signal: abortController.signal,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[1].signal).toBe(abortController.signal);
    });

    it('should include Anthropic-Beta header when reasoning is enabled', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Think about this' }];

      setupFetchMock(
        mockFetchResponse({
          content: [{ type: 'text', text: 'Response' }],
        })
      );

      await provider.sendMessage(messages, {
        model: 'claude-sonnet-4-20250514',
        stream: false,
        reasoning: true,
        max_tokens: 4096,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[1].headers['Anthropic-Beta']).toBe('interleaved-thinking-2025-05-14');
    });

    it('should not include Anthropic-Beta header when reasoning is disabled', async () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];

      setupFetchMock(
        mockFetchResponse({
          content: [{ text: 'Response' }],
        })
      );

      await provider.sendMessage(messages, {
        model: 'claude-sonnet-4-20250514',
        stream: false,
        reasoning: false,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[1].headers['Anthropic-Beta']).toBeUndefined();
    });
  });

  describe('listModels', () => {
    it('should return configured models when no API key', async () => {
      provider.config.apiKey = '';
      provider.config.models = [
        {
          id: 'claude-3-opus',
          name: 'Claude 3 Opus',
          type: 'chat',
          capabilities: ['chat'],
          description: 'Opus model',
        },
      ];

      const models = await provider.listModels();

      expect(models).toEqual(provider.config.models);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch models from API when API key is provided', async () => {
      const mockModels = {
        data: [
          {
            id: 'claude-3-opus-20240229',
            display_name: 'Claude 3 Opus',
            description: 'Most powerful model',
          },
          {
            id: 'claude-3-sonnet-20240229',
            display_name: 'Claude 3 Sonnet',
            description: 'Balanced model',
          },
        ],
      };

      setupFetchMock(mockFetchResponse(mockModels));

      const models = await provider.listModels();

      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        type: 'chat',
        capabilities: ['chat'],
        description: 'Most powerful model',
      });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/models',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'test-api-key',
          }),
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      setupFetchMock(mockFetchResponse({ error: 'Unauthorized' }, { ok: false, status: 401 }));

      const models = await provider.listModels();

      expect(models).toEqual([]);
    });

    it('should return configured models on API error', async () => {
      provider.config.models = [
        {
          id: 'claude-3-opus',
          name: 'Claude 3 Opus',
          type: 'chat',
          capabilities: ['chat'],
          description: 'Opus model',
        },
      ];

      setupFetchError(new Error('Network error'));

      const models = await provider.listModels();

      expect(models).toEqual(provider.config.models);
    });
  });

  describe('URL building', () => {
    it('should build correct URLs with default host', () => {
      const messagesUrl = buildMessagesUrl('https://api.anthropic.com');
      const modelsUrl = buildModelsUrl('https://api.anthropic.com');

      expect(messagesUrl).toBe('https://api.anthropic.com/v1/messages');
      expect(modelsUrl).toBe('https://api.anthropic.com/v1/models');
    });

    it('should build correct URLs with custom host', () => {
      const messagesUrl = buildMessagesUrl('https://custom.api.com/anthropic');
      const modelsUrl = buildModelsUrl('https://custom.api.com/anthropic');

      expect(messagesUrl).toBe('https://custom.api.com/anthropic/v1/messages');
      expect(modelsUrl).toBe('https://custom.api.com/anthropic/v1/models');
    });

    it('should handle host with existing /v1 path', () => {
      const messagesUrl = buildMessagesUrl('https://api.anthropic.com/v1');

      expect(messagesUrl).toBe('https://api.anthropic.com/v1/messages');
    });

    it('should throw error for invalid host URL', () => {
      expect(() => {
        deriveV1ApiBase('not-a-valid-url', 'Anthropic');
      }).toThrow('Invalid Anthropic host URL');
    });
  });

  describe('initialize', () => {
    it('should update config', async () => {
      const newConfig: AnthropicConfig = {
        id: 'anthropic' as any,
        name: 'Anthropic',
        apiKey: 'new-api-key',
        host: 'https://new.api.com',
        models: [],
      };

      await provider.initialize(newConfig);

      expect(provider.config).toEqual(newConfig);
    });
  });

  describe('buildChatBody — thinking budget calculation', () => {
    const baseMessages: Message[] = [{ role: 'user', content: 'Hello' }];
    const baseConfig: AnthropicConfig = {
      id: 'anthropic' as any,
      name: 'Anthropic',
      apiKey: 'test-api-key',
      host: 'https://api.anthropic.com',
      models: [],
    };

    const buildBody = (options: ProviderOptions) =>
      anthropicRequestBuilder.buildChatBody(baseMessages, options, baseConfig);

    it('should allocate ~80% of max_tokens as budget_tokens when reasoning is enabled', () => {
      const body = buildBody({
        model: 'claude-3-opus',
        reasoning: true,
        max_tokens: 5000,
      });

      expect(body.thinking.type).toBe('enabled');
      expect(body.thinking.budget_tokens).toBe(4000); // floor(5000 * 0.8)
      expect(body.temperature).toBe(1);
    });

    it('should clamp budget_tokens to max_tokens when max_tokens < MIN_THINKING_BUDGET_TOKENS', () => {
      const body = buildBody({
        model: 'claude-3-opus',
        reasoning: true,
        max_tokens: 500,
      });

      // floor(500 * 0.8) = 400, max(1024, 400) = 1024, min(500, 1024) = 500
      expect(body.thinking.budget_tokens).toBe(500);
      expect(body.thinking.budget_tokens).toBeLessThanOrEqual(500);
    });

    it('should clamp budget_tokens to max_tokens when max_tokens is very small', () => {
      const body = buildBody({
        model: 'claude-3-opus',
        reasoning: true,
        max_tokens: 1,
      });

      // floor(1 * 0.8) = 0, max(1024, 0) = 1024, min(1, 1024) = 1
      expect(body.thinking.budget_tokens).toBe(1);
    });

    it('should use MIN_THINKING_BUDGET_TOKENS when 80% is below minimum', () => {
      const body = buildBody({
        model: 'claude-3-opus',
        reasoning: true,
        max_tokens: 1200,
      });

      // floor(1200 * 0.8) = 960, max(1024, 960) = 1024, min(1200, 1024) = 1024
      expect(body.thinking.budget_tokens).toBe(1024);
    });

    it('should use default fallback when max_tokens is undefined', () => {
      const body = buildBody({
        model: 'claude-3-opus',
        reasoning: true,
      });

      // DEFAULT_MAX_TOKENS_FALLBACK = 2048, floor(2048 * 0.8) = 1638, max(1024, 1638) = 1638
      expect(body.thinking.budget_tokens).toBe(1638);
    });

    it('should use default fallback when max_tokens is 0', () => {
      const body = buildBody({
        model: 'claude-3-opus',
        reasoning: true,
        max_tokens: 0,
      });

      expect(body.thinking.budget_tokens).toBe(1638);
    });

    it('should not include thinking config when reasoning is disabled', () => {
      const body = buildBody({
        model: 'claude-3-opus',
        reasoning: false,
        max_tokens: 5000,
        temperature: 0.7,
      });

      expect(body.thinking).toBeUndefined();
      expect(body.temperature).toBe(0.7);
    });
  });
});
