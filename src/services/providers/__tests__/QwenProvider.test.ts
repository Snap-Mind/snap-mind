import { describe, it, expect, beforeEach, vi } from 'vitest';
import QwenProvider from '../QwenProvider';
import { QwenConfig } from '@/types/providers';
import { Message } from '@/types/chat';
import {
  mockFetchResponse,
  mockStreamingFetchResponse,
  setupFetchMock,
} from '../../../../test/utils/mockFetch';

describe('QwenProvider', () => {
  let provider: QwenProvider;
  let config: QwenConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
    config = {
      id: 'qwen' as any,
      name: 'Qwen',
      apiKey: 'test-api-key',
      host: 'https://dashscope.aliyuncs.com',
      models: [],
    };
    provider = new QwenProvider(config);
  });

  describe('URL building with various host formats', () => {
    it('should handle default Qwen/DashScope host', () => {
      const url = (provider as any)._buildChatUrl('https://dashscope.aliyuncs.com');
      expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
    });

    it('should handle host with compatible-mode already', () => {
      const url = (provider as any)._buildChatUrl('https://dashscope.aliyuncs.com/compatible-mode');
      expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
    });

    it('should handle host with compatible-mode/v1 already', () => {
      const url = (provider as any)._buildChatUrl(
        'https://dashscope.aliyuncs.com/compatible-mode/v1'
      );
      expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
    });

    it('should handle custom proxy without compatible-mode', () => {
      const url = (provider as any)._buildChatUrl('https://my-proxy.com');
      expect(url).toBe('https://my-proxy.com/compatible-mode/v1/chat/completions');
    });

    it('should handle host with nested path and compatible-mode', () => {
      const url = (provider as any)._buildChatUrl(
        'https://api.example.com/qwen/compatible-mode/v1'
      );
      expect(url).toBe('https://api.example.com/qwen/compatible-mode/v1/chat/completions');
    });

    it('should handle host with port', () => {
      const url = (provider as any)._buildChatUrl('https://localhost:8080/compatible-mode/v1');
      expect(url).toBe('https://localhost:8080/compatible-mode/v1/chat/completions');
    });

    it('should add compatible-mode when only base URL is provided', () => {
      const url = (provider as any)._buildChatUrl('https://custom-qwen.com');
      expect(url).toContain('/compatible-mode/v1');
    });

    it('should throw error for invalid URL', () => {
      expect(() => {
        (provider as any)._deriveApiBase('not-a-valid-url');
      }).toThrow('Invalid Qwen host URL');
    });

    it('should build models URL correctly', () => {
      const url = (provider as any)._buildModelsUrl('https://dashscope.aliyuncs.com');
      expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/models');
    });
  });

  describe('sendMessage', () => {
    const messages: Message[] = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello' },
    ];

    it('should return error when API key is missing', async () => {
      provider.config.apiKey = '';
      const result = await provider.sendMessage(messages, { model: 'qwen-turbo' });
      expect(result).toBe('Error: Qwen API key not configured');
    });

    it('should return error when model is not specified', async () => {
      const result = await provider.sendMessage(messages, { model: '' });
      expect(result).toBe('Error: Model not specified for Qwen');
    });

    it('should send non-streaming request successfully', async () => {
      setupFetchMock(
        mockFetchResponse({
          choices: [{ message: { content: '你好！我能帮你什么?' } }],
        })
      );

      const result = await provider.sendMessage(messages, {
        model: 'qwen-turbo',
        stream: false,
      });

      expect(result).toBe('你好！我能帮你什么?');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
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
          'data: {"choices":[{"delta":{"content":"你"}}]}\n',
          'data: {"choices":[{"delta":{"content":"好"}}]}\n',
          'data: [DONE]\n',
        ])
      );

      const result = await provider.sendMessage(
        messages,
        { model: 'qwen-turbo', stream: true },
        onToken
      );

      expect(result).toBe('你好');
      expect(onToken).toHaveBeenCalledTimes(2);
    });

    it('should pass options correctly', async () => {
      setupFetchMock(
        mockFetchResponse({
          choices: [{ message: { content: 'Response' } }],
        })
      );

      await provider.sendMessage(messages, {
        model: 'qwen-max',
        stream: false,
        temperature: 0.8,
        top_p: 0.95,
        max_tokens: 1500,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.temperature).toBe(0.8);
      expect(body.top_p).toBe(0.95);
      expect(body.max_tokens).toBe(1500);
      expect(body.messages).toEqual(messages);
    });

    it('should handle API errors', async () => {
      setupFetchMock(mockFetchResponse({ error: 'Invalid API key' }, { ok: false, status: 401 }));

      await expect(provider.sendMessage(messages, { model: 'qwen-turbo' })).rejects.toThrow(
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
        model: 'qwen-turbo',
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
        {
          id: 'qwen-turbo',
          name: 'Qwen Turbo',
          type: 'chat',
          capabilities: ['chat'],
          description: 'Qwen Turbo',
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
            { id: 'qwen-turbo', object: 'model', owned_by: 'alibaba' },
            { id: 'qwen-max', object: 'model', owned_by: 'alibaba' },
            { id: 'qwen-plus', object: 'model', owned_by: 'alibaba' },
          ],
        })
      );

      const models = await provider.listModels();

      expect(models).toHaveLength(3);
      expect(models[0].id).toBe('qwen-turbo');
      expect(models[1].id).toBe('qwen-max');
      expect(models[2].id).toBe('qwen-plus');
      expect(models[0].description).toContain('Qwen');
    });

    it('should return configured models on API error', async () => {
      provider.config.models = [
        {
          id: 'qwen-turbo',
          name: 'Qwen Turbo',
          type: 'chat',
          capabilities: ['chat'],
          description: 'Qwen Turbo',
        },
      ];
      setupFetchMock(mockFetchResponse({ error: 'Failed' }, { ok: false, status: 500 }));

      const models = await provider.listModels();
      expect(models).toEqual(provider.config.models);
    });

    it('should handle empty data array', async () => {
      setupFetchMock(mockFetchResponse({ data: [] }));
      const models = await provider.listModels();
      expect(models).toEqual([]);
    });
  });

  describe('initialize', () => {
    it('should update config', async () => {
      const newConfig: QwenConfig = {
        id: 'qwen' as any,
        name: 'Qwen',
        apiKey: 'new-key',
        host: 'https://new-dashscope.aliyuncs.com',
        models: [],
      };

      await provider.initialize(newConfig);
      expect(provider.config).toEqual(newConfig);
    });
  });
});
