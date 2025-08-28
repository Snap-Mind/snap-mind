import { AnthropicConfig, AzureOpenAIConfig, GoogleConfig, OpenAIConfig } from './providers';

export interface Setting {
  general: GeneralSetting;
  chat: ChatSetting;
  providers: ProviderSetting[];
}

export interface GeneralSetting {
  clipboardEnabled: boolean;
}

export interface ChatSetting {
  temperature: number;
  max_tokens: number;
  top_p: number;
  streamingEnabled: boolean;
  defaultModel: string;
}

export interface Hotkey {
  id: number;
  key: string;
  prompt: string;
  enabled: boolean;
}

export interface ModelSetting {
  id: string;
  name: string;
  type: string;
  description: string;
}

export type ProviderSetting = OpenAIConfig | AzureOpenAIConfig | AnthropicConfig | GoogleConfig;
