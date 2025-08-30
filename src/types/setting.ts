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
  type: ModelType;
  description: string;
  capabilities: Capability[];
}

export type ModelType =
  | 'chat'
  | 'image'
  | 'embedding'
  | 'tool'
  | 'code'
  | 'vision';

export type Capability =
  | 'chat'
  | 'image-generation'
  | 'image-editing'
  | 'vision'
  | 'websearch'
  | 'reasoning'
  | 'code-generation'
  | 'translation'
  | 'embedding'
  | 'summarization'
  | 'classification'
  | 'ocr'
  | 'speech'
  | 'tool-use'
  | 'multi-modal';

export type ProviderSetting = OpenAIConfig | AzureOpenAIConfig | AnthropicConfig | GoogleConfig;
