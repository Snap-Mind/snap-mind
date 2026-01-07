import { describe, it, expect, beforeEach, vi } from 'vitest';
import DeepSeekProvider from '../DeepSeekProvider';
import { DeepSeekConfig } from '@/types/providers';
import { Message } from '@/types/chat';
import {
  mockFetchResponse,
  mockStreamingFetchResponse,
  setupFetchMock,
} from '../../../../test/utils/mockFetch';

describe('DeepSeekProvider', () => {
  let provider: DeepSeekProvider;
  let config: DeepSeekConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
    config = {
      id: 'deepseek' as any,
      name: 'DeepSeek',
      apiKey: 'test-api-key',
      host: 'https://api.deepseek.com',
      models: [],
    };
    provider = new DeepSeekProvider(config);
  });

  describe('URL building with various host formats', () => {
    it('should handle default DeepSeek host', () => {
      const url = (provider as any)._buildChatUrl('https://api.deepseek.com');
      expect(url).toBe('https://api.deepseek.com/v1/chat/completions');
    });

    it('should handle host with /v1 already', () => {
      const url = (provider as any)._buildChatUrl('https://api.deepseek.com/v1');
      expect(url).toBe('https://api.deepseek.com/v1/chat/completions');
    });

    it('should handle host without version', () => {
      const url = (provider as any)._buildChatUrl('https://custom-deepseek.com');
      expect(url).toBe('https://custom-deepseek.com/v1/chat/completions');
    });

    it('should handle custom proxy with nested paths', () => {
      const url = (provider as any)._buildChatUrl('https://proxy.com/deepseek/v1');
      expect(url).toBe('https://proxy.com/deepseek/v1/chat/completions');
    });

    it('should handle host with port', () => {
      const url = (provider as any)._buildChatUrl('https://localhost:8080/v1');
      expect(url).toBe('https://localhost:8080/v1/chat/completions');
    });

    it('should throw error for invalid URL', () => {
      expect(() => {
        (provider as any)._deriveApiBase('not-a-valid-url');
      }).toThrow('Invalid DeepSeek host URL');
    });

    it('should build models URL correctly', () => {
      const url = (provider as any)._buildModelsUrl('https://api.deepseek.com/v1');
      expect(url).toBe('https://api.deepseek.com/v1/models');
    });
  });

  describe('sendMessage', () => {
    const messages: Message[] = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello' },
    ];

    it('should return error when API key is missing', async () => {
      provider.config.apiKey = '';
      const result = await provider.sendMessage(messages, { model: 'deepseek-chat' });
      expect(result).toBe('Error: DeepSeek API key not configured');
    });

    it('should return error when model is not specified', async () => {
      const result = await provider.sendMessage(messages, { model: '' });
      expect(result).toBe('Error: Model not specified for DeepSeek');
    });

    it('should send non-streaming request successfully', async () => {
      setupFetchMock(
        mockFetchResponse({
          choices: [{ message: { content: 'Hello! How can I help?' } }],
        })
      );

      const result = await provider.sendMessage(messages, {
        model: 'deepseek-chat',
        stream: false,
      });

      expect(result).toBe('Hello! How can I help?');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.deepseek.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('should handle streaming response (OpenAI-compatible format)', async () => {
      const tokens: string[] = [];
      const onToken = vi.fn((token: string) => tokens.push(token));

      setupFetchMock(
        mockStreamingFetchResponse([
          'data: {"choices":[{"delta":{"content":"Deep"}}]}\n',
          'data: {"choices":[{"delta":{"content":"Seek"}}]}\n',
          'data: [DONE]\n',
        ])
      );

      const result = await provider.sendMessage(
        messages,
        { model: 'deepseek-chat', stream: true },
        onToken
      );

      expect(result).toBe('DeepSeek');
      expect(onToken).toHaveBeenCalledTimes(2);
    });

    it('should pass options correctly', async () => {
      setupFetchMock(
        mockFetchResponse({
          choices: [{ message: { content: 'Response' } }],
        })
      );

      await provider.sendMessage(messages, {
        model: 'deepseek-chat',
        stream: false,
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 2000,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.temperature).toBe(0.7);
      expect(body.top_p).toBe(0.9);
      expect(body.max_tokens).toBe(2000);
      expect(body.messages).toEqual(messages);
    });

    it('should handle API errors', async () => {
      setupFetchMock(
        mockFetchResponse({ error: 'Rate limit exceeded' }, { ok: false, status: 429 })
      );

      await expect(provider.sendMessage(messages, { model: 'deepseek-chat' })).rejects.toThrow(
        'API error: 429'
      );
    });
  });

  describe('listModels', () => {
    it('should return configured models when no API key', async () => {
      provider.config.apiKey = '';
      provider.config.models = [
        {
          id: 'deepseek-chat',
          name: 'DeepSeek Chat',
          type: 'chat',
          capabilities: ['chat'],
          description: 'DeepSeek Chat',
        },
      ];

      const models = await provider.listModels();
      expect(models).toEqual(provider.config.models);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch models from API', async () => {
      setupFetchMock(
        mockFetchResponse({
          data: [
            { id: 'deepseek-chat', object: 'model', owned_by: 'deepseek' },
            { id: 'deepseek-coder', object: 'model', owned_by: 'deepseek' },
          ],
        })
      );

      const models = await provider.listModels();

      expect(models).toHaveLength(2);
      expect(models[0].id).toBe('deepseek-chat');
      expect(models[1].id).toBe('deepseek-coder');
      expect(models[0].description).toContain('DeepSeek');
    });

    it('should return configured models on API error', async () => {
      provider.config.models = [
        {
          id: 'deepseek-chat',
          name: 'DeepSeek Chat',
          type: 'chat',
          capabilities: ['chat'],
          description: 'DeepSeek Chat',
        },
      ];
      setupFetchMock(mockFetchResponse({ error: 'Failed' }, { ok: false, status: 500 }));

      const models = await provider.listModels();
      expect(models).toEqual(provider.config.models);
    });
  });

  describe('initialize', () => {
    it('should update config', async () => {
      const newConfig: DeepSeekConfig = {
        id: 'deepseek' as any,
        name: 'DeepSeek',
        apiKey: 'new-key',
        host: 'https://new-api.deepseek.com',
        models: [],
      };

      await provider.initialize(newConfig);
      expect(provider.config).toEqual(newConfig);
    });
  });
});
