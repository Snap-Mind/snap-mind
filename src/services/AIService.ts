import loggerService from './LoggerService';
import ProviderFactory from './providers/ProviderFactory';
import type { Message } from '../types/chat';
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
    this.providerSetting = this.findProviderByModelId(defaultModelId);

    if (!this.providerSetting) {
      throw new Error(`No provider found for model ${defaultModelId}`);
    }

    this.modelSetting = this.providerSetting.models.find((m) => m.id === defaultModelId) || null;

    if (!this.modelSetting) {
      throw new Error(`Model ${defaultModelId} not found in provider ${this.providerSetting.id}`);
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
      signal?: AbortSignal;
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
      const providerOptions = {
        model: modelSetting.id,
        temperature: options?.temperature || DEFAULT_TEMPERATURE,
        max_tokens: options?.maxTokens || DEFAULT_MAX_TOKENS,
        top_p: options?.top_p || DEFAULT_TOP_P,
        stream: streamingEnabled,
        ...this.settings.chat,
        ...options,
      };
      if (options?.signal) {
        providerOptions.signal = options.signal;
      }

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
