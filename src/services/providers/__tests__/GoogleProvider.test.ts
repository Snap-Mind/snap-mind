import { describe, it, expect, beforeEach, vi } from 'vitest';
import GoogleProvider from '../GoogleProvider';
import { GoogleConfig } from '@/types/providers';
import { Message } from '@/types/chat';
import {
  mockFetchResponse,
  mockSSEResponse,
  setupFetchMock,
} from '../../../../test/utils/mockFetch';

describe('GoogleProvider', () => {
  let provider: GoogleProvider;
  let config: GoogleConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
    config = {
      id: 'google' as any,
      name: 'Google',
      apiKey: 'test-api-key',
      host: 'https://generativelanguage.googleapis.com',
      models: [],
      config: { topK: 40 },
    };
    provider = new GoogleProvider(config);
  });

  describe('URL building with various host formats', () => {
    it('should handle default Google host', () => {
      const url = (provider as any)._buildGenerateContentUrl(
        'https://generativelanguage.googleapis.com',
        'gemini-pro',
        'test-key',
        false
      );
      expect(url).toContain('/v1beta/models/gemini-pro:generateContent');
      expect(url).toContain('key=test-key');
    });

    it('should handle host with v1beta already', () => {
      const url = (provider as any)._buildGenerateContentUrl(
        'https://generativelanguage.googleapis.com/v1beta',
        'gemini-pro',
        'test-key',
        false
      );
      expect(url).toContain('/v1beta/models/gemini-pro:generateContent');
    });

    it('should handle host with v1', () => {
      const url = (provider as any)._buildGenerateContentUrl(
        'https://generativelanguage.googleapis.com/v1',
        'gemini-pro',
        'test-key',
        false
      );
      expect(url).toContain('/v1/models/gemini-pro:generateContent');
    });

    it('should add streaming parameter when streaming', () => {
      const url = (provider as any)._buildGenerateContentUrl(
        'https://generativelanguage.googleapis.com',
        'gemini-pro',
        'test-key',
        true
      );
      expect(url).toContain('alt=sse');
    });

    it('should handle custom proxy URL', () => {
      const url = (provider as any)._buildGenerateContentUrl(
        'https://my-proxy.com/google',
        'gemini-pro',
        'test-key',
        false
      );
      expect(url).toContain('my-proxy.com/google/v1beta/models/gemini-pro:generateContent');
    });

    it('should handle host with port', () => {
      const url = (provider as any)._buildGenerateContentUrl(
        'https://localhost:8080',
        'gemini-pro',
        'test-key',
        false
      );
      expect(url).toContain('localhost:8080/v1beta/models/gemini-pro:generateContent');
    });

    it('should throw error for invalid URL', () => {
      expect(() => {
        (provider as any)._deriveApiBase('invalid-url');
      }).toThrow('Invalid Google host URL');
    });

    it('should build models URL correctly', () => {
      const url = (provider as any)._buildModelsUrl(
        'https://generativelanguage.googleapis.com',
        'test-key'
      );
      expect(url).toContain('/v1beta/models');
      expect(url).toContain('key=test-key');
    });
  });

  describe('sendMessage', () => {
    const messages: Message[] = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello' },
    ];

    it('should return error when API key is missing', async () => {
      provider.config.apiKey = '';
      const result = await provider.sendMessage(messages, { model: 'gemini-pro' });
      expect(result).toBe('Error: Google AI API key not configured');
    });

    it('should return error when model is not specified', async () => {
      const result = await provider.sendMessage(messages, { model: '' });
      expect(result).toBe('Error: Model not specified for Google AI');
    });

    it('should convert messages to Google format', async () => {
      setupFetchMock(
        mockFetchResponse({
          candidates: [{ content: { parts: [{ text: 'Hello!' }] } }],
        })
      );

      await provider.sendMessage(messages, { model: 'gemini-pro', stream: false });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.contents).toHaveLength(1);
      expect(body.contents[0].role).toBe('user');
      expect(body.contents[0].parts[0].text).toContain('You are helpful');
      expect(body.contents[0].parts[0].text).toContain('Hello');
    });

    it('should handle system prompt correctly', async () => {
      setupFetchMock(
        mockFetchResponse({
          candidates: [{ content: { parts: [{ text: 'Response' }] } }],
        })
      );

      const msgs: Message[] = [
        { role: 'system', content: 'System prompt' },
        { role: 'user', content: 'User message' },
        { role: 'assistant', content: 'Assistant message' },
        { role: 'user', content: 'Another user message' },
      ];

      await provider.sendMessage(msgs, { model: 'gemini-pro', stream: false });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      // System prompt should be prepended to first user message
      expect(body.contents[0].parts[0].text).toContain('System prompt');
      expect(body.contents[0].parts[0].text).toContain('User message');
    });

    it('should map assistant role to model', async () => {
      setupFetchMock(
        mockFetchResponse({
          candidates: [{ content: { parts: [{ text: 'Response' }] } }],
        })
      );

      const msgs: Message[] = [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello' },
      ];

      await provider.sendMessage(msgs, { model: 'gemini-pro', stream: false });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.contents[1].role).toBe('model');
    });

    it('should send non-streaming request successfully', async () => {
      setupFetchMock(
        mockFetchResponse({
          candidates: [{ content: { parts: [{ text: 'Generated content' }] } }],
        })
      );

      const result = await provider.sendMessage(messages, {
        model: 'gemini-pro',
        stream: false,
      });

      expect(result).toBe('Generated content');
    });

    it('should handle streaming response', async () => {
      const tokens: string[] = [];
      const onToken = vi.fn((token: string) => tokens.push(token));

      setupFetchMock(
        mockSSEResponse([
          {
            data: { candidates: [{ content: { parts: [{ text: 'Hello' }] } }] },
          },
          {
            data: { candidates: [{ content: { parts: [{ text: ' world' }] } }] },
          },
        ])
      );

      const result = await provider.sendMessage(
        messages,
        { model: 'gemini-pro', stream: true },
        onToken
      );

      expect(result).toBe('Hello world');
      expect(onToken).toHaveBeenCalledTimes(2);
    });

    it('should pass generation config correctly', async () => {
      setupFetchMock(
        mockFetchResponse({
          candidates: [{ content: { parts: [{ text: 'Response' }] } }],
        })
      );

      await provider.sendMessage(messages, {
        model: 'gemini-pro',
        stream: false,
        temperature: 0.8,
        top_p: 0.95,
        max_tokens: 2048,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body.generationConfig.temperature).toBe(0.8);
      expect(body.generationConfig.topP).toBe(0.95);
      expect(body.generationConfig.maxOutputTokens).toBe(2048);
      expect(body.generationConfig.topK).toBe(40); // from config
    });

    it('should handle API errors', async () => {
      setupFetchMock(mockFetchResponse({ error: 'Invalid API key' }, { ok: false, status: 401 }));

      await expect(provider.sendMessage(messages, { model: 'gemini-pro' })).rejects.toThrow(
        'API error: 401'
      );
    });
  });

  describe('listModels', () => {
    it('should return configured models when no API key', async () => {
      provider.config.apiKey = '';
      provider.config.models = [
        {
          id: 'gemini-pro',
          name: 'Gemini Pro',
          type: 'chat',
          capabilities: ['chat'],
          description: 'Gemini Pro',
        },
      ];

      const models = await provider.listModels();
      expect(models).toEqual(provider.config.models);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch models from API', async () => {
      setupFetchMock(
        mockFetchResponse({
          models: [
            {
              name: 'models/gemini-pro',
              displayName: 'Gemini Pro',
              description: 'Best model',
            },
            {
              name: 'models/gemini-pro-vision',
              displayName: 'Gemini Pro Vision',
              description: 'Multimodal',
            },
          ],
        })
      );

      const models = await provider.listModels();

      expect(models).toHaveLength(2);
      expect(models[0].id).toBe('gemini-pro');
      expect(models[0].name).toBe('Gemini Pro');
      expect(models[1].id).toBe('gemini-pro-vision');
    });

    it('should handle empty models list', async () => {
      setupFetchMock(mockFetchResponse({ models: [] }));
      const models = await provider.listModels();
      expect(models).toEqual([]);
    });

    it('should return configured models on error', async () => {
      provider.config.models = [
        {
          id: 'gemini-pro',
          name: 'Gemini Pro',
          type: 'chat',
          capabilities: ['chat'],
          description: 'Gemini Pro',
        },
      ];
      setupFetchMock(mockFetchResponse({ error: 'Failed' }, { ok: false, status: 500 }));

      const models = await provider.listModels();
      expect(models).toEqual(provider.config.models);
    });
  });

  describe('initialize', () => {
    it('should update config', async () => {
      const newConfig: GoogleConfig = {
        id: 'google' as any,
        name: 'Google',
        apiKey: 'new-key',
        host: 'https://new-host.com',
        models: [],
        config: { topK: 50 },
      };

      await provider.initialize(newConfig);
      expect(provider.config).toEqual(newConfig);
    });
  });
});
