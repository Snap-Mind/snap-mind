import {
  AnthropicConfig,
  AzureOpenAIConfig,
  GoogleConfig,
  OpenAIConfig,
  DeepSeekConfig,
  QwenConfig,
} from './providers';

export type Setting = {
  general: GeneralSetting;
  appearance: AppearanceSetting;
};

export interface GeneralSetting {
  language: string;
  clipboardEnabled: boolean;
  app: AppMeta;
  autoUpdate?: AutoUpdateSetting;
}

export interface AppearanceSetting {
  theme: 'light' | 'dark' | 'auto';
}

export interface AutoUpdateSetting {
  enabled: boolean;
  checkOnLaunchDelaySec: number;
  betaChannel: boolean;
}

export interface ModelSetting {
  id: string;
  name: string;
  type: ModelType;
  description: string;
  capabilities: Capability[];
}

export type ModelType = 'chat' | 'image' | 'embedding' | 'tool' | 'code' | 'vision';

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

export type ProviderSetting =
  | OpenAIConfig
  | AzureOpenAIConfig
  | AnthropicConfig
  | GoogleConfig
  | DeepSeekConfig
  | QwenConfig;

export interface AppMeta {
  version: string;
}
