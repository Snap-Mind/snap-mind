import { describe, it, expect, beforeEach, vi } from 'vitest';
import OllamaProvider from '../OllamaProvider';
import { BaseProviderConfig } from '@/types/providers';
import { Message } from '@/types/chat';
import {
  mockFetchResponse,
  mockStreamingFetchResponse,
  setupFetchMock,
} from '../../../../test/utils/mockFetch';

describe('OllamaProvider', () => {
  let provider: OllamaProvider;
  let config: BaseProviderConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
    config = {
      id: 'ollama' as any,
      name: 'Ollama',
      apiKey: '',
      host: 'http://localhost:11434',
      models: [],
    };
    provider = new OllamaProvider(config);
  });

  describe('URL building with various host formats', () => {
    it('should handle default localhost host', () => {
      const url = (provider as any)._buildChatUrl('http://localhost:11434');
      expect(url).toBe('http://localhost:11434/api/chat');
    });

    it('should handle host with /api already', () => {
      const url = (provider as any)._buildChatUrl('http://localhost:11434/api');
      expect(url).toBe('http://localhost:11434/api/chat');
    });

    it('should handle host with /api/chat already', () => {
      const url = (provider as any)._buildChatUrl('http://localhost:11434/api/chat');
      expect(url).toBe('http://localhost:11434/api/chat');
    });

    it('should handle custom host without /api', () => {
      const url = (provider as any)._buildChatUrl('http://my-ollama-server.com');
      expect(url).toBe('http://my-ollama-server.com/api/chat');
    });

    it('should handle custom host with custom path', () => {
      const url = (provider as any)._buildChatUrl('http://my-server.com/ollama/api');
      expect(url).toBe('http://my-server.com/ollama/api/chat');
    });

    it('should handle host with port and path', () => {
      const url = (provider as any)._buildChatUrl('http://192.168.1.100:8080/api');
      expect(url).toBe('http://192.168.1.100:8080/api/chat');
    });

    it('should handle HTTPS protocol', () => {
      const url = (provider as any)._buildChatUrl('https://ollama.example.com');
      expect(url).toBe('https://ollama.example.com/api/chat');
    });

    it('should fallback to default on invalid URL', () => {
      const base = (provider as any)._deriveApiBase('not-a-valid-url');
      expect(base).toBe('http://localhost:11434/api');
    });

    it('should handle IPv4 addresses', () => {
      const url = (provider as any)._buildChatUrl('http://127.0.0.1:11434');
      expect(url).toBe('http://127.0.0.1:11434/api/chat');
    });

    it('should handle IPv6 addresses', () => {
      const url = (provider as any)._buildChatUrl('http://[::1]:11434');
      expect(url).toBe('http://[::1]:11434/api/chat');
    });
  });

  describe('sendMessage', () => {
    const messages: Message[] = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello' },
    ];

    it('should return error when model is not specified', async () => {
      const result = await provider.sendMessage(messages, { model: '' });
      expect(result).toBe('Error: Model not specified for Ollama');
    });

    it('should send non-streaming request successfully', async () => {
      setupFetchMock(
        mockFetchResponse({
          message: { content: 'Hello! How can I help you?' },
          done: true,
        })
      );

      const result = await provider.sendMessage(messages, {
        model: 'llama2',
        stream: false,
      });

      expect(result).toBe('Hello! How can I help you?');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should handle NDJSON streaming response', async () => {
      const tokens: string[] = [];
      const onToken = vi.fn((token: string) => tokens.push(token));

      setupFetchMock(
        mockStreamingFetchResponse([
          '{"message":{"content":"Hello"}}\n',
          '{"message":{"content":" world"}}\n',
          '{"message":{"content":"!"},"done":true}\n',
        ])
      );

      const result = await provider.sendMessage(
        messages,
        { model: 'llama2', stream: true },
        onToken
      );

      expect(result).toBe('Hello world!');
      expect(onToken).toHaveBeenCalledTimes(3);
      expect(tokens).toEqual(['Hello', ' world', '!']);
    });

    it('should exit early when done flag is received', async () => {
      const tokens: string[] = [];
      const onToken = vi.fn((token: string) => tokens.push(token));

      setupFetchMock(
        mockStreamingFetchResponse([
          '{"message":{"content":"First"}}\n',
          '{"message":{"content":" second"},"done":true}\n',
          '{"message":{"content":" should not appear"}}\n',
        ])
      );

      const result = await provider.sendMessage(
        messages,
        { model: 'llama2', stream: true },
        onToken
      );

      expect(result).toBe('First second');
      expect(tokens).not.toContain(' should not appear');
    });

    it('should handle streaming errors', async () => {
      setupFetchMock(mockStreamingFetchResponse(['{"error":"Model not found"}\n']));

      await expect(
        provider.sendMessage(messages, { model: 'non-existent', stream: true })
      ).rejects.toThrow('Model not found');
    });

    it('should map options to Ollama format', async () => {
      setupFetchMock(
        mockFetchResponse({
          message: { content: 'Response' },
          done: true,
        })
      );

      await provider.sendMessage(messages, {
        model: 'llama2',
        stream: false,
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 500,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.options.temperature).toBe(0.7);
      expect(body.options.top_p).toBe(0.9);
      expect(body.options.num_predict).toBe(500);
    });

    it('should pass messages in Ollama format', async () => {
      setupFetchMock(
        mockFetchResponse({
          message: { content: 'Response' },
          done: true,
        })
      );

      await provider.sendMessage(messages, { model: 'llama2', stream: false });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.messages).toHaveLength(2);
      expect(body.messages[0]).toEqual({ role: 'system', content: 'You are helpful' });
      expect(body.messages[1]).toEqual({ role: 'user', content: 'Hello' });
    });

    it('should handle API errors', async () => {
      setupFetchMock(
        mockFetchResponse({ error: 'Internal server error' }, { ok: false, status: 500 })
      );

      await expect(provider.sendMessage(messages, { model: 'llama2' })).rejects.toThrow(
        'API error: 500'
      );
    });

    it('should support abort signal', async () => {
      const controller = new AbortController();
      setupFetchMock(
        mockFetchResponse({
          message: { content: 'Response' },
          done: true,
        })
      );

      await provider.sendMessage(messages, {
        model: 'llama2',
        stream: false,
        signal: controller.signal,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[1].signal).toBe(controller.signal);
    });

    it('should handle malformed JSON in stream', async () => {
      const onToken = vi.fn();

      setupFetchMock(
        mockStreamingFetchResponse([
          '{"message":{"content":"Valid"}}\n',
          'invalid json\n',
          '{"message":{"content":" more"},"done":true}\n',
        ])
      );

      const result = await provider.sendMessage(
        messages,
        { model: 'llama2', stream: true },
        onToken
      );

      // Should skip invalid JSON and continue
      expect(result).toBe('Valid more');
    });
  });

  describe('listModels', () => {
    it('should fetch models from API', async () => {
      setupFetchMock(
        mockFetchResponse({
          models: [
            { name: 'llama2', details: { family: 'llama', parameter_size: '7B' } },
            { name: 'mistral', details: { family: 'mistral', parameter_size: '7B' } },
          ],
        })
      );

      const models = await provider.listModels();

      expect(models).toHaveLength(2);
      expect(models[0].id).toBe('llama2');
      expect(models[0].description).toContain('llama');
      expect(models[0].description).toContain('7B');
    });

    it('should handle models without details', async () => {
      setupFetchMock(
        mockFetchResponse({
          models: [{ name: 'custom-model' }],
        })
      );

      const models = await provider.listModels();
      expect(models).toHaveLength(1);
      expect(models[0].description).toBe('Ollama local model');
    });

    it('should return configured models on error', async () => {
      provider.config.models = [
        {
          id: 'llama2',
          name: 'Llama 2',
          type: 'chat',
          capabilities: ['chat'],
          description: 'Llama 2',
        },
      ];
      setupFetchMock(mockFetchResponse({ error: 'Failed' }, { ok: false, status: 500 }));

      const models = await provider.listModels();
      expect(models).toEqual(provider.config.models);
    });

    it('should handle non-array response', async () => {
      setupFetchMock(mockFetchResponse({ models: null }));
      const models = await provider.listModels();
      expect(models).toEqual([]);
    });
  });

  describe('initialize', () => {
    it('should update config', async () => {
      const newConfig: BaseProviderConfig = {
        id: 'ollama' as any,
        name: 'Ollama',
        apiKey: '',
        host: 'http://new-host:8080',
        models: [],
      };

      await provider.initialize(newConfig);
      expect(provider.config).toEqual(newConfig);
    });
  });
});
