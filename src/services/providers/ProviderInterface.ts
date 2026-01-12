// Base Provider Interface for LLM Providers
import { ModelSetting } from '@/types/setting';
import { Provider, ProviderOptions, BaseProviderConfig } from '../../types/providers';
import { Message } from '@/types/chat';

// This class is now deprecated, use the Provider interface from types/providers.ts instead
class ProviderInterface implements Provider {
  config: BaseProviderConfig;

  constructor(config: BaseProviderConfig) {
    this.config = config;
  }

  async initialize(config: BaseProviderConfig): Promise<void> {
    this.config = config;
  }

  async sendMessage(
    _messages: Message[],
    _options?: ProviderOptions,
    _onToken?: (token: string, reasoning?: string) => void
  ): Promise<string> {
    throw new Error('Method sendMessage must be implemented by subclasses');
  }

  async listModels(): Promise<ModelSetting[]> {
    throw new Error('Method listModels must be implemented by subclasses');
  }
}

export default ProviderInterface;
