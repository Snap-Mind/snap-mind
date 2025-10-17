// Provider Factory for creating provider instances
import AzureOpenAIProvider from './AzureOpenAIProvider';
import OpenAIProvider from './OpenAIProvider';
import AnthropicProvider from './AnthropicProvider';
import GoogleProvider from './GoogleProvider';
import DeepSeekProvider from './DeepSeekProvider';
import QwenProvider from './QwenProvider';
import OllamaProvider from './OllamaProvider';
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
  OllamaConfig,
} from '@/types/providers';
import loggerService from '../LoggerService';

class ProviderFactory {
  static createProvider(config: BaseProviderConfig): Provider {
    switch (config.id) {
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
      case 'ollama':
        return new OllamaProvider(config as OllamaConfig);
      default:
        loggerService.error('[ProviderFactory]', `Unknown provider: ${config.id}`);
        throw new Error(`Unknown provider: ${config.id}`);
    }
  }

  static getAvailableProviders(): ProviderType[] {
    return ['openai', 'azure-openai', 'anthropic', 'google', 'deepseek', 'qwen', 'ollama'];
  }
}

export default ProviderFactory;
