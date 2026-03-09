// Provider Factory — maps provider IDs to composed adapter + UnifiedProvider.
//
// Adding a new provider only requires:
// 1. Creating an adapter (or reusing createOpenAICompatibleAdapter)
// 2. Adding one entry to the adapterMap below

import { UnifiedProvider } from './UnifiedProvider';
import { ProviderType, Provider, BaseProviderConfig } from '@/types/providers';
import { ProviderAdapter } from './core/types';
import { openaiAdapter } from './adapters/openaiAdapter';
import { azureOpenaiAdapter } from './adapters/azureAdapter';
import { anthropicAdapter } from './adapters/anthropicAdapter';
import { googleAdapter } from './adapters/googleAdapter';
import { deepseekAdapter } from './adapters/deepseekAdapter';
import { qwenAdapter } from './adapters/qwenAdapter';
import { ollamaAdapter } from './adapters/ollamaAdapter';
import loggerService from '../LoggerService';

const adapterMap: Record<string, ProviderAdapter> = {
  openai: openaiAdapter,
  'azure-openai': azureOpenaiAdapter,
  anthropic: anthropicAdapter,
  google: googleAdapter,
  deepseek: deepseekAdapter,
  qwen: qwenAdapter,
  ollama: ollamaAdapter,
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
