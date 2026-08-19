// Provider Factory — the single wiring point for all providers.
//
// Composes RequestBuilder + ResponseParser into ProviderAdapter,
// then wraps in UnifiedProvider. Adding a new provider only requires:
// 1. Creating a request builder and/or response parser
// 2. Adding one entry to the adapterMap below

import { UnifiedProvider } from './UnifiedProvider';
import { ProviderType, Provider, BaseProviderConfig } from '@/types/providers';
import { ProviderAdapter, RequestBuilder, ResponseParser } from '@/types/providers';
import { createOpenAIRequestBuilder } from './adapters/openaiRequestBuilder';
import { anthropicRequestBuilder } from './adapters/anthropicRequestBuilder';
import { googleRequestBuilder } from './adapters/googleRequestBuilder';
import { ollamaRequestBuilder } from './adapters/ollamaRequestBuilder';
import { azureRequestBuilder } from './adapters/azureRequestBuilder';
import { createOpenAIResponseParser } from './parsers/openaiResponseParser';
import { anthropicResponseParser } from './parsers/anthropicResponseParser';
import { googleResponseParser } from './parsers/googleResponseParser';
import { ollamaResponseParser } from './parsers/ollamaResponseParser';
import { deriveV1ApiBase, deriveQwenApiBase } from './core/urlResolvers';
import loggerService from '../LoggerService';

/** Merge a RequestBuilder and ResponseParser into a single ProviderAdapter. */
function composeAdapter(builder: RequestBuilder, parser: ResponseParser): ProviderAdapter {
  return { ...builder, ...parser };
}

export const adapterMap: Record<ProviderType, ProviderAdapter> = {
  openai: composeAdapter(
    createOpenAIRequestBuilder({
      providerName: 'OpenAI',
      defaultOrigin: 'https://api.openai.com',
      deriveApiBase: (host) => deriveV1ApiBase(host, 'OpenAI'),
    }),
    createOpenAIResponseParser({
      providerName: 'OpenAI',
      modelFilter: (model: any) => model.id.includes('gpt'),
      modelDescription: (model: any) => `OpenAI ${model.id} model`,
    })
  ),

  'azure-openai': composeAdapter(
    azureRequestBuilder,
    createOpenAIResponseParser({
      providerName: 'Azure OpenAI',
    })
  ),

  anthropic: composeAdapter(anthropicRequestBuilder, anthropicResponseParser),

  google: composeAdapter(googleRequestBuilder, googleResponseParser),

  deepseek: composeAdapter(
    createOpenAIRequestBuilder({
      providerName: 'DeepSeek',
      defaultOrigin: 'https://api.deepseek.com',
      deriveApiBase: (host) => deriveV1ApiBase(host, 'DeepSeek'),
    }),
    createOpenAIResponseParser({
      providerName: 'DeepSeek',
      modelDescription: (model: any) => `DeepSeek ${model.id} model`,
    })
  ),

  qwen: composeAdapter(
    createOpenAIRequestBuilder({
      providerName: 'Qwen',
      defaultOrigin: 'https://dashscope.aliyuncs.com',
      deriveApiBase: (host) => deriveQwenApiBase(host),
    }),
    createOpenAIResponseParser({
      providerName: 'Qwen',
      modelDescription: (model: any) => `Qwen ${model.id} model`,
    })
  ),

  ollama: composeAdapter(ollamaRequestBuilder, ollamaResponseParser),
};

class ProviderFactory {
  static createProvider(config: BaseProviderConfig): Provider {
    const adapter = adapterMap[config.id];
    if (!adapter) {
      loggerService.error('[ProviderFactory]', `Unknown provider: ${config.id}`);
      throw new Error(`Unknown provider: ${config.id}`);
    }
    return new UnifiedProvider(config, adapter);
  }

  static getAvailableProviders(): ProviderType[] {
    return Object.keys(adapterMap) as ProviderType[];
  }
}

export default ProviderFactory;
