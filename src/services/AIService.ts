import loggerService from './LoggerService';
import ProviderFactory from './providers/ProviderFactory';
import type { Message, ChatSource } from '../types/chat';
import type { ChatSetting, ModelSetting, ProviderSetting } from '@/types/setting';

// Default values for chat parameters
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TOP_P = 0.95;
const DEFAULT_STREAMING_ENABLED = true;

interface Settings {
  chat: ChatSetting;
  providers: ProviderSetting[];
}

export class AIService {
  private settings: Settings;
  private modelSetting: ModelSetting | null;
  private providerSetting: ProviderSetting | null;
  private activeProvider: any; // We'll type this properly when converting Provider classes
  private streamingEnabled: boolean;

  constructor(settings: Settings) {
    this.settings = settings;
    this.modelSetting = null;
    this.providerSetting = null;
    this.activeProvider = null;
    this.streamingEnabled = DEFAULT_STREAMING_ENABLED;

    const defaultModelId = this.settings.chat.defaultModel;
    const defaultProviderId = this.settings.chat.defaultProvider;

    if (defaultProviderId && defaultModelId) {
      const provider = this.settings.providers.find((p) => p.id === defaultProviderId);
      const model = provider?.models.find((m) => m.id === defaultModelId);
      if (provider && model) {
        this.providerSetting = provider;
        this.modelSetting = model;
      }
    }

    if (!this.providerSetting && defaultModelId) {
      const provider = this.findProviderByModelId(defaultModelId);
      const model = provider?.models.find((m) => m.id === defaultModelId);
      if (provider && model) {
        this.providerSetting = provider;
        this.modelSetting = model;
      }
    }

    if (!this.providerSetting) {
      const provider = this.settings.providers.find((p) => p.models?.length);
      if (provider) {
        this.providerSetting = provider;
        this.modelSetting = provider.models[0] || null;
      }
    }

    if (!this.providerSetting || !this.modelSetting) {
      throw new Error(
        `No provider/model found for default selection ${defaultProviderId}:${defaultModelId}`
      );
    }

    this.activeProvider = ProviderFactory.createProvider(this.providerSetting);
    this.streamingEnabled = this.settings.chat.streamingEnabled;
  }

  private findProviderByModelId(modelId: string): ProviderSetting | undefined {
    return this.settings.providers.find((p) => p.models.some((m) => m.id === modelId)) || undefined;
  }

  public async sendMessageToAI(
    messages: Message[],
    onToken: (token: string) => void,
    options?: {
      temperature?: number;
      maxTokens?: number;
      top_p?: number;
      stream?: boolean;
      modelSetting?: ModelSetting;
      providerSetting?: ProviderSetting;
      streamingEnabled?: boolean;
      reasoning?: boolean;
      webSearch?: boolean;
      signal?: AbortSignal;
      onWebSources?: (sources: ChatSource[]) => void;
    }
  ): Promise<Message> {
    const modelSetting = options?.modelSetting || this.modelSetting;
    const providerSetting = options?.providerSetting || this.providerSetting;
    const activeProvider = ProviderFactory.createProvider(providerSetting);
    const streamingEnabled = options?.streamingEnabled || this.streamingEnabled;

    if (!this.activeProvider) {
      const error = new Error('No active provider available');
      loggerService.error(error.message, error);
      throw error;
    }

    try {
      // Prepare options for the provider
      // Start from settings.chat defaults, then override with per-call values
      const reasoning = options?.reasoning ?? this.settings.chat.reasoningEnabled ?? false;
      const webSearch = options?.webSearch ?? this.settings.chat.webSearchEnabled ?? false;
      const providerOptions = {
        model: modelSetting.id,
        temperature: options?.temperature ?? this.settings.chat.temperature ?? DEFAULT_TEMPERATURE,
        max_tokens: options?.maxTokens ?? this.settings.chat.max_tokens ?? DEFAULT_MAX_TOKENS,
        top_p: options?.top_p ?? this.settings.chat.top_p ?? DEFAULT_TOP_P,
        stream: streamingEnabled,
        reasoning,
        webSearch,
        ...(options?.signal ? { signal: options.signal } : {}),
        ...(options?.onWebSources ? { onWebSources: options.onWebSources } : {}),
      };

      return {
        role: 'assistant',
        content: await activeProvider.sendMessage(messages, providerOptions, onToken),
      };
    } catch (err) {
      loggerService.error(`[renderer] ${this.providerSetting.id} error:`, err);
      throw err;
    }
  }
}
