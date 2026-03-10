// Azure OpenAI request builder — similar to OpenAI but with key differences:
// - Model is in the URL path (not the request body)
// - Uses `api-key` header instead of `Authorization: Bearer`
// - Requires both host AND apiKey for validation
// - No model listing via API

import { Message } from '@/types/chat';
import { BaseProviderConfig, AzureOpenAIConfig, ProviderOptions } from '@/types/providers';
import { RequestBuilder } from '../core/types';

export const azureRequestBuilder: RequestBuilder = {
  providerName: 'Azure OpenAI',
  requiresApiKey: true,

  validateRequest(config: BaseProviderConfig, options?: ProviderOptions): string | null {
    if (!config.host || !config.apiKey) {
      return 'Azure OpenAI endpoint or API key not configured';
    }
    if (!options?.model) {
      return 'Model not specified for Azure OpenAI';
    }
    return null;
  },

  buildChatUrl(config: BaseProviderConfig, options?: ProviderOptions): string {
    const azureConfig = config as AzureOpenAIConfig;
    const baseEndpoint = azureConfig.host;
    const apiVersion = azureConfig.apiVersion;
    const model = options?.model;

    // If host already contains /deployments/, use as-is
    if (baseEndpoint.includes('/deployments/')) {
      return baseEndpoint;
    }
    return `${baseEndpoint}/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`;
  },

  buildChatHeaders(config: BaseProviderConfig): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'api-key': config.apiKey,
    };
  },

  buildChatBody(messages: Message[], options: ProviderOptions): any {
    // Azure OpenAI: model is NOT in the body (it's in the URL)
    return {
      messages,
      max_tokens: options.max_tokens,
      stream: options.stream !== undefined ? options.stream : true,
      temperature: options.temperature,
      top_p: options.top_p,
    };
  },

  buildListModelsRequest(): null {
    // Azure OpenAI doesn't support listing models via API easily
    return null;
  },
};
