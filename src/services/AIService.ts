import loggerService from './LoggerService';
import ProviderFactory from './providers/ProviderFactory';
import type { Message, ChatSource } from '../types/chat';
import type { ChatSetting } from '@/types/setting';
import type { ProviderDTO, ModelDTO } from '@/types/provider-dto';
import type { BaseProviderConfig } from '@/types/providers';
import { providerDtoToBaseConfig } from '@/utils/providerMapper';

// Default values for chat parameters
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TOP_P = 0.95;
const DEFAULT_STREAMING_ENABLED = true;

interface Settings {
  chat: ChatSetting;
  providers: ProviderDTO[];
}

export class AIService {
  private settings: Settings;
  private modelSetting: ModelDTO | null;
  private providerSetting: ProviderDTO | null;
  private activeProvider: ReturnType<typeof ProviderFactory.createProvider>;
  private streamingEnabled: boolean;

  constructor(settings: Settings) {
    this.settings = settings;
    this.modelSetting = null;
    this.providerSetting = null;
    this.activeProvider = null as unknown as ReturnType<typeof ProviderFactory.createProvider>;
    this.streamingEnabled = DEFAULT_STREAMING_ENABLED;

    const defaultModelId = this.settings.chat.defaultModelId;
    const defaultProviderId = this.settings.chat.defaultProviderId;

    if (defaultProviderId != null && defaultModelId != null) {
      const provider = this.settings.providers.find((p) => p.id === defaultProviderId);
      const model = provider?.models.find((m) => m.id === defaultModelId);
      if (provider && model) {
        this.providerSetting = provider;
        this.modelSetting = model;
      }
    }

    if (!this.providerSetting) {
      const provider = this.settings.providers.find((p) => p.models.length > 0);
      if (provider) {
        this.providerSetting = provider;
        this.modelSetting = provider.models[0] ?? null;
      }
    }

    if (!this.providerSetting || !this.modelSetting) {
      throw new Error(
        `No provider/model found for default selection ${defaultProviderId}:${defaultModelId}`
      );
    }

    this.activeProvider = ProviderFactory.createProvider(this.toConfig(this.providerSetting));
    this.streamingEnabled = this.settings.chat.streamingEnabled;
  }

  private toConfig(p: ProviderDTO): BaseProviderConfig {
    return providerDtoToBaseConfig(p);
  }

  public async sendMessageToAI(
    messages: Message[],
    onToken: (token: string) => void,
    options?: {
      temperature?: number;
      maxTokens?: number;
      top_p?: number;
      stream?: boolean;
      modelSetting?: ModelDTO;
      providerSetting?: ProviderDTO;
      streamingEnabled?: boolean;
      reasoning?: boolean;
      webSearch?: boolean;
      signal?: AbortSignal;
      onWebSources?: (sources: ChatSource[]) => void;
    }
  ): Promise<Message> {
    const modelSetting = options?.modelSetting || this.modelSetting;
    const providerSetting = options?.providerSetting || this.providerSetting;
    if (!modelSetting || !providerSetting) {
      throw new Error('No provider/model available');
    }
    const activeProvider = ProviderFactory.createProvider(this.toConfig(providerSetting));
    const streamingEnabled = options?.streamingEnabled || this.streamingEnabled;

    if (!this.activeProvider) {
      const error = new Error('No active provider available');
      loggerService.error(error.message, error);
      throw error;
    }

    try {
      const reasoning = options?.reasoning ?? this.settings.chat.reasoningEnabled ?? false;
      const webSearch = options?.webSearch ?? this.settings.chat.webSearchEnabled ?? false;
      const providerOptions = {
        model: modelSetting.modelId,
        temperature: options?.temperature ?? this.settings.chat.temperature ?? DEFAULT_TEMPERATURE,
        max_tokens: options?.maxTokens ?? this.settings.chat.max_tokens ?? DEFAULT_MAX_TOKENS,
        top_p: options?.top_p ?? this.settings.chat.top_p ?? DEFAULT_TOP_P,
        stream: streamingEnabled,
        reasoning,
        webSearch,
        ...(options?.signal ? { signal: options.signal } : {}),
        ...(options?.onWebSources ? { onWebSources: options.onWebSources } : {}),
      };

      const cleanMessages = messages.filter((m) => m.role !== 'error');

      return {
        role: 'assistant',
        content: await activeProvider.sendMessage(cleanMessages, providerOptions, onToken),
      };
    } catch (err) {
      loggerService.error(`[renderer] ${this.providerSetting?.kind} error:`, err);
      throw err;
    }
  }
}
