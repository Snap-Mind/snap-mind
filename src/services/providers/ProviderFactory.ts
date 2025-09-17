// Provider Factory for creating provider instances
import AzureOpenAIProvider from './AzureOpenAIProvider';
import OpenAIProvider from './OpenAIProvider';
import AnthropicProvider from './AnthropicProvider';
import GoogleProvider from './GoogleProvider';
import DeepSeekProvider from './DeepSeekProvider';
import QwenProvider from './QwenProvider';
import { ProviderType } from '@/types/providers';
import {
  Provider,
  BaseProviderConfig,
  OpenAIConfig,
  AzureOpenAIConfig,
  AnthropicConfig,
  GoogleConfig,
  DeepSeekConfig,
  QwenConfig,
} from '@/types/providers';
import loggerService from '../LoggerService';

class ProviderFactory {
  static createProvider(providerId: ProviderType, config: BaseProviderConfig): Provider {
    switch (providerId) {
      case 'openai':
        return new OpenAIProvider(config as OpenAIConfig);
      case 'azure-openai':
        return new AzureOpenAIProvider(config as AzureOpenAIConfig);
      case 'anthropic':
        return new AnthropicProvider(config as AnthropicConfig);
      case 'google':
        return new GoogleProvider(config as GoogleConfig);
      case 'deepseek':
        return new DeepSeekProvider(config as DeepSeekConfig);
      case 'qwen':
        return new QwenProvider(config as QwenConfig);
      default:
        loggerService.error('[ProviderFactory]', `Unknown provider: ${providerId}`);
        throw new Error(`Unknown provider: ${providerId}`);
    }
  }

  static getAvailableProviders(): ProviderType[] {
    return ['openai', 'azure-openai', 'anthropic', 'google', 'deepseek', 'qwen'];
  }
}

export default ProviderFactory;
