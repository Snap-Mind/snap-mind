import { Message } from './chat';
import { ModelSetting } from './setting';

export interface ProviderOptions {
  model: string;
  max_tokens?: number;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
}

export interface BaseProviderConfig {
  id: ProviderType;
  name: string;
  apiKey: string;
  host: string;
  models?: ModelSetting[];
}

export interface OpenAIConfig extends BaseProviderConfig {}

export interface AzureOpenAIConfig extends BaseProviderConfig {
  apiVersion: string;
}

export interface AnthropicConfig extends BaseProviderConfig {}

export interface GoogleConfig extends BaseProviderConfig {
  config?: {
    topK?: number;
  };
}

// Provider interface
export interface Provider {
  config: BaseProviderConfig;
  initialize(config: BaseProviderConfig): Promise<void>;
  sendMessage(
    messages: Message[],
    options?: ProviderOptions,
    onToken?: (token: string) => void
  ): Promise<string>;
  listModels(): Promise<ModelSetting[]>;
}

export type ProviderType = 'openai' | 'azure-openai' | 'anthropic' | 'google';
