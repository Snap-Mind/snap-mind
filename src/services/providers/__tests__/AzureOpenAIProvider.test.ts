import { describe, it, expect, beforeEach, vi } from 'vitest';
import AzureOpenAIProvider from '../AzureOpenAIProvider';
import { AzureOpenAIConfig } from '@/types/providers';
import { Message } from '@/types/chat';
import {
  mockFetchResponse,
  mockStreamingFetchResponse,
  setupFetchMock,
} from '../../../../test/utils/mockFetch';

describe('AzureOpenAIProvider', () => {
  let provider: AzureOpenAIProvider;
  let config: AzureOpenAIConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
    config = {
      id: 'azure-openai' as any,
      name: 'Azure OpenAI',
      apiKey: 'test-api-key',
      host: 'https://my-resource.openai.azure.com',
      apiVersion: '2023-05-15',
      models: [],
    };
    provider = new AzureOpenAIProvider(config);
  });

  describe('URL building with various host formats', () => {
    it('should build URL with model deployment when not already in host', async () => {
      setupFetchMock(
        mockFetchResponse({
          choices: [{ message: { content: 'Response' } }],
        })
      );

      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      await provider.sendMessage(messages, {
        model: 'gpt-4',
        stream: false,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toBe(
        'https://my-resource.openai.azure.com/openai/deployments/gpt-4/chat/completions?api-version=2023-05-15'
      );
    });

    it('should use host as-is if it already contains /deployments/', async () => {
      provider.config.host =
        'https://my-resource.openai.azure.com/openai/deployments/gpt-4/chat/completions?api-version=2023-05-15';

      setupFetchMock(
        mockFetchResponse({
          choices: [{ message: { content: 'Response' } }],
        })
      );

      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      await provider.sendMessage(messages, {
        model: 'gpt-4',
        stream: false,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toBe(provider.config.host);
    });

    it('should handle different Azure resource names', async () => {
      provider.config.host = 'https://company-ai.openai.azure.com';

      setupFetchMock(
        mockFetchResponse({
          choices: [{ message: { content: 'Response' } }],
        })
      );

      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      await provider.sendMessage(messages, {
        model: 'gpt-35-turbo',
        stream: false,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain('company-ai.openai.azure.com');
      expect(fetchCall[0]).toContain('/deployments/gpt-35-turbo/');
    });

    it('should handle different API versions', async () => {
      provider.config.apiVersion = '2024-02-01';

      setupFetchMock(
        mockFetchResponse({
          choices: [{ message: { content: 'Response' } }],
        })
      );

      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      await provider.sendMessage(messages, {
        model: 'gpt-4',
        stream: false,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain('api-version=2024-02-01');
    });

    it('should handle Azure Gov Cloud endpoints', async () => {
      provider.config.host = 'https://my-resource.openai.azure.us';

      setupFetchMock(
        mockFetchResponse({
          choices: [{ message: { content: 'Response' } }],
        })
      );

      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      await provider.sendMessage(messages, {
        model: 'gpt-4',
        stream: false,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain('.azure.us');
    });

    it('should handle custom domain endpoints', async () => {
      provider.config.host = 'https://custom-domain.company.com';

      setupFetchMock(
        mockFetchResponse({
          choices: [{ message: { content: 'Response' } }],
        })
      );

      const messages: Message[] = [{ role: 'user', content: 'Hello' }];
      await provider.sendMessage(messages, {
        model: 'gpt-4',
        stream: false,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain('custom-domain.company.com');
      expect(fetchCall[0]).toContain('/openai/deployments/');
    });
  });

  describe('sendMessage', () => {
    const messages: Message[] = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello' },
    ];

    it('should return error when endpoint is not configured', async () => {
      provider.config.host = '';
      const result = await provider.sendMessage(messages, { model: 'gpt-4' });
      expect(result).toBe('Error: Azure OpenAI endpoint or API key not configured');
    });

    it('should return error when API key is not configured', async () => {
      provider.config.apiKey = '';
      const result = await provider.sendMessage(messages, { model: 'gpt-4' });
      expect(result).toBe('Error: Azure OpenAI endpoint or API key not configured');
    });

    it('should return error when model is not specified', async () => {
      const result = await provider.sendMessage(messages, { model: '' });
      expect(result).toBe('Error: Model not specified for Azure OpenAI');
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
        expect.stringContaining('/deployments/gpt-4/chat/completions'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'api-key': 'test-api-key',
          }),
        })
      );
    });

    it('should handle streaming response', async () => {
      const tokens: string[] = [];
      const onToken = vi.fn((token: string) => tokens.push(token));

      setupFetchMock(
        mockStreamingFetchResponse([
          'data: {"choices":[{"delta":{"content":"Azure"}}]}\n',
          'data: {"choices":[{"delta":{"content":" OpenAI"}}]}\n',
          'data: [DONE]\n',
        ])
      );

      const result = await provider.sendMessage(
        messages,
        { model: 'gpt-4', stream: true },
        onToken
      );

      expect(result).toBe('Azure OpenAI');
      expect(onToken).toHaveBeenCalledTimes(2);
      expect(tokens).toEqual(['Azure', ' OpenAI']);
    });

    it('should handle reasoning content in streaming response', async () => {
      const tokens: string[] = [];
      const reasonings: string[] = [];
      const onToken = vi.fn((token: string, reasoning?: string) => {
        if (token) tokens.push(token);
        if (reasoning) reasonings.push(reasoning);
      });

      setupFetchMock(
        mockStreamingFetchResponse([
          'data: {"choices":[{"delta":{"reasoning_content":"Thinking"}}]}\n',
          'data: {"choices":[{"delta":{"content":"Answer"}}]}\n',
          'data: [DONE]\n',
        ])
      );

      const result = await provider.sendMessage(
        messages,
        { model: 'o1-preview', stream: true },
        onToken
      );

      expect(result).toBe('Answer');
      expect(tokens).toEqual(['Answer']);
      expect(reasonings).toEqual(['Thinking']);
    });

    it('should not include model in request body (Azure-specific)', async () => {
      setupFetchMock(
        mockFetchResponse({
          choices: [{ message: { content: 'Response' } }],
        })
      );

      await provider.sendMessage(messages, {
        model: 'gpt-4',
        stream: false,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      // Azure OpenAI doesn't include model in body, it's in the URL
      expect(body.model).toBeUndefined();
      expect(body.messages).toEqual(messages);
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
      setupFetchMock(
        mockFetchResponse({ error: 'Rate limit exceeded' }, { ok: false, status: 429 })
      );

      await expect(provider.sendMessage(messages, { model: 'gpt-4' })).rejects.toThrow(
        'API error: 429'
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

    it('should handle deployment names with special characters', async () => {
      setupFetchMock(
        mockFetchResponse({
          choices: [{ message: { content: 'Response' } }],
        })
      );

      await provider.sendMessage(messages, {
        model: 'gpt-4-turbo-2024-04-09',
        stream: false,
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain('/deployments/gpt-4-turbo-2024-04-09/');
    });
  });

  describe('listModels', () => {
    it('should return configured models', async () => {
      provider.config.models = [
        { id: 'gpt-4', name: 'GPT-4', type: 'chat', capabilities: ['chat'], description: 'GPT-4' },
        {
          id: 'gpt-35-turbo',
          name: 'GPT-3.5 Turbo',
          type: 'chat',
          capabilities: ['chat'],
          description: 'GPT-3.5 Turbo',
        },
      ];

      const models = await provider.listModels();

      expect(models).toEqual(provider.config.models);
      // Azure OpenAI doesn't support programmatic model listing
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return empty array when no models configured', async () => {
      const models = await provider.listModels();
      expect(models).toEqual([]);
    });
  });

  describe('initialize', () => {
    it('should update config', async () => {
      const newConfig: AzureOpenAIConfig = {
        id: 'azure-openai' as any,
        name: 'Azure OpenAI',
        apiKey: 'new-key',
        host: 'https://new-resource.openai.azure.com',
        apiVersion: '2024-02-01',
        models: [],
      };

      await provider.initialize(newConfig);
      expect(provider.config).toEqual(newConfig);
    });
  });
});
