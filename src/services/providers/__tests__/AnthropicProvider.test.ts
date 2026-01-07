import { describe, it, expect, beforeEach, vi } from 'vitest';
import AnthropicProvider from '../AnthropicProvider';
import { AnthropicConfig } from '@/types/providers';
import { Message } from '@/types/chat';
import {
  mockFetchResponse,
  mockSSEResponse,
  setupFetchMock,
  setupFetchError,
} from '../../../../test/utils/mockFetch';

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
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
    provider = new AnthropicProvider(config);
  });

  describe('URL building with various host formats', () => {
    it('should handle default Anthropic host', () => {
      const url = (provider as any)._buildMessagesUrl('https://api.anthropic.com');
      expect(url).toBe('https://api.anthropic.com/v1/messages');
    });

    it('should handle host with /v1 already', () => {
      const url = (provider as any)._buildMessagesUrl('https://api.anthropic.com/v1');
      expect(url).toBe('https://api.anthropic.com/v1/messages');
    });

    it('should handle host without version', () => {
      const url = (provider as any)._buildMessagesUrl('https://custom-anthropic.com');
      expect(url).toBe('https://custom-anthropic.com/v1/messages');
    });

    it('should handle custom proxy with nested paths', () => {
      const url = (provider as any)._buildMessagesUrl('https://proxy.com/anthropic/v1');
      expect(url).toBe('https://proxy.com/anthropic/v1/messages');
    });

    it('should handle host with port', () => {
      const url = (provider as any)._buildMessagesUrl('https://localhost:8080/v1');
      expect(url).toBe('https://localhost:8080/v1/messages');
    });

    it('should handle host with trailing slash', () => {
      const url = (provider as any)._buildMessagesUrl('https://api.anthropic.com/');
      expect(url).toBe('https://api.anthropic.com/v1/messages');
    });

    it('should handle custom path without v1', () => {
      const url = (provider as any)._buildMessagesUrl('https://custom.com/api/anthropic');
      expect(url).toBe('https://custom.com/api/anthropic/v1/messages');
    });

    it('should throw error on invalid URL', () => {
      expect(() => {
        (provider as any)._buildMessagesUrl('not-a-valid-url');
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
      const messagesUrl = (provider as any)._buildMessagesUrl('https://api.anthropic.com');
      const modelsUrl = (provider as any)._buildModelsUrl('https://api.anthropic.com');

      expect(messagesUrl).toBe('https://api.anthropic.com/v1/messages');
      expect(modelsUrl).toBe('https://api.anthropic.com/v1/models');
    });

    it('should build correct URLs with custom host', () => {
      const messagesUrl = (provider as any)._buildMessagesUrl('https://custom.api.com/anthropic');
      const modelsUrl = (provider as any)._buildModelsUrl('https://custom.api.com/anthropic');

      expect(messagesUrl).toBe('https://custom.api.com/anthropic/v1/messages');
      expect(modelsUrl).toBe('https://custom.api.com/anthropic/v1/models');
    });

    it('should handle host with existing /v1 path', () => {
      const messagesUrl = (provider as any)._buildMessagesUrl('https://api.anthropic.com/v1');

      expect(messagesUrl).toBe('https://api.anthropic.com/v1/messages');
    });

    it('should throw error for invalid host URL', () => {
      expect(() => {
        (provider as any)._deriveApiBase('not-a-valid-url');
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
});
