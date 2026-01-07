import { describe, it, expect, beforeEach, vi } from 'vitest';
import OpenAIProvider from '../OpenAIProvider';
import { OpenAIConfig } from '@/types/providers';
import { Message } from '@/types/chat';
import {
  mockFetchResponse,
  mockStreamingFetchResponse,
  setupFetchMock,
} from '../../../../test/utils/mockFetch';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  let config: OpenAIConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
    config = {
      id: 'openai' as any,
      name: 'OpenAI',
      apiKey: 'test-api-key',
      host: 'https://api.openai.com/v1',
      models: [],
    };
    provider = new OpenAIProvider(config);
  });

  describe('URL building with various host formats', () => {
    it('should handle default OpenAI host', () => {
      const url = (provider as any)._buildChatCompletionsUrl('https://api.openai.com/v1');
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
    });

    it('should handle host without /v1 suffix', () => {
      const url = (provider as any)._buildChatCompletionsUrl('https://api.openai.com');
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
    });

    it('should handle host with /v1 in middle of path', () => {
      const url = (provider as any)._buildChatCompletionsUrl('https://custom.api.com/openai/v1');
      expect(url).toBe('https://custom.api.com/openai/v1/chat/completions');
    });

    it('should handle host with full path already', () => {
      const url = (provider as any)._buildChatCompletionsUrl(
        'https://api.openai.com/v1/chat/completions'
      );
      expect(url).toBe('https://api.openai.com/v1/chat/completions');
    });

    it('should handle custom proxy URL', () => {
      const url = (provider as any)._buildChatCompletionsUrl('https://my-proxy.com/api/v1');
      expect(url).toBe('https://my-proxy.com/api/v1/chat/completions');
    });

    it('should handle host with port', () => {
      const url = (provider as any)._buildChatCompletionsUrl('https://localhost:8080/v1');
      expect(url).toBe('https://localhost:8080/v1/chat/completions');
    });

    it('should handle complex nested paths', () => {
      const url = (provider as any)._buildChatCompletionsUrl(
        'https://api.company.com/services/openai/v1'
      );
      expect(url).toBe('https://api.company.com/services/openai/v1/chat/completions');
    });

    it('should throw error for invalid URL', () => {
      expect(() => {
        (provider as any)._deriveApiBase('not-a-valid-url');
      }).toThrow('Invalid OpenAI host URL');
    });

    it('should build models URL correctly', () => {
      const url = (provider as any)._buildModelsUrl('https://api.openai.com/v1');
      expect(url).toBe('https://api.openai.com/v1/models');
    });
  });

  describe('sendMessage', () => {
    const messages: Message[] = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello' },
    ];

    it('should return error when API key is missing', async () => {
      provider.config.apiKey = '';
      const result = await provider.sendMessage(messages, { model: 'gpt-4' });
      expect(result).toBe('Error: OpenAI API key not configured');
    });

    it('should return error when model is not specified', async () => {
      const result = await provider.sendMessage(messages, { model: '' });
      expect(result).toBe('Error: Model not specified for OpenAI');
    });

    it('should send non-streaming request successfully', async () => {
      setupFetchMock(
        mockFetchResponse({
          choices: [{ message: { content: 'Hello! How can I help?' } }],
        })
      );

      const result = await provider.sendMessage(messages, {
        model: 'gpt-4',
        stream: false,
      });

      expect(result).toBe('Hello! How can I help?');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should handle streaming response', async () => {
      const tokens: string[] = [];
      const onToken = vi.fn((token: string) => tokens.push(token));

      setupFetchMock(
        mockStreamingFetchResponse([
          'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
          'data: {"choices":[{"delta":{"content":" world"}}]}\n',
          'data: [DONE]\n',
        ])
      );

      const result = await provider.sendMessage(
        messages,
        { model: 'gpt-4', stream: true },
        onToken
      );

      expect(result).toBe('Hello world');
      expect(onToken).toHaveBeenCalledTimes(2);
      expect(tokens).toEqual(['Hello', ' world']);
    });

    it('should pass options correctly', async () => {
      setupFetchMock(
        mockFetchResponse({
          choices: [{ message: { content: 'Response' } }],
        })
      );

      await provider.sendMessage(messages, {
        model: 'gpt-4',
        stream: false,
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 1000,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.temperature).toBe(0.7);
      expect(body.top_p).toBe(0.9);
      expect(body.max_tokens).toBe(1000);
    });

    it('should handle API errors', async () => {
      setupFetchMock(mockFetchResponse({ error: 'Unauthorized' }, { ok: false, status: 401 }));

      await expect(provider.sendMessage(messages, { model: 'gpt-4' })).rejects.toThrow(
        'API error: 401'
      );
    });

    it('should support abort signal', async () => {
      const controller = new AbortController();
      setupFetchMock(
        mockFetchResponse({
          choices: [{ message: { content: 'Response' } }],
        })
      );

      await provider.sendMessage(messages, {
        model: 'gpt-4',
        stream: false,
        signal: controller.signal,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[1].signal).toBe(controller.signal);
    });
  });

  describe('listModels', () => {
    it('should return configured models when no API key', async () => {
      provider.config.apiKey = '';
      provider.config.models = [
        { id: 'gpt-4', name: 'GPT-4', type: 'chat', capabilities: ['chat'], description: 'GPT-4' },
      ];

      const models = await provider.listModels();
      expect(models).toEqual(provider.config.models);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch models from API', async () => {
      setupFetchMock(
        mockFetchResponse({
          object: 'list',
          data: [
            { id: 'gpt-4', object: 'model', created: 1234567890, owned_by: 'openai' },
            { id: 'gpt-3.5-turbo', object: 'model', created: 1234567890, owned_by: 'openai' },
          ],
        })
      );

      const models = await provider.listModels();

      expect(models).toHaveLength(2);
      expect(models[0].id).toBe('gpt-4');
      expect(models[0].description).toBeDefined();
      expect(models[1].id).toBe('gpt-3.5-turbo');
    });

    it('should filter only gpt models', async () => {
      setupFetchMock(
        mockFetchResponse({
          data: [
            { id: 'gpt-4', object: 'model', created: 1234567890, owned_by: 'openai' },
            { id: 'whisper-1', object: 'model', created: 1234567890, owned_by: 'openai' },
            { id: 'dall-e-3', object: 'model', created: 1234567890, owned_by: 'openai' },
          ],
        })
      );

      const models = await provider.listModels();
      expect(models).toHaveLength(1);
      expect(models[0].description).toBeDefined();
      expect(models[0].id).toBe('gpt-4');
    });

    it('should handle API errors gracefully', async () => {
      setupFetchMock(mockFetchResponse({ error: 'Failed' }, { ok: false, status: 500 }));
      const models = await provider.listModels();
      expect(models).toBeUndefined();
    });
  });

  describe('initialize', () => {
    it('should update config', async () => {
      const newConfig: OpenAIConfig = {
        id: 'openai' as any,
        name: 'OpenAI',
        apiKey: 'new-key',
        host: 'https://new-api.com/v1',
        models: [],
      };

      await provider.initialize(newConfig);
      expect(provider.config).toEqual(newConfig);
    });
  });
});
