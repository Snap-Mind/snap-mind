import loggerService from './LoggerService';
import ProviderFactory from './providers/ProviderFactory';
import type { Message, ChatSource } from '../types/chat';
import type { ProviderDTO, ModelDTO } from '@/types/provider-dto';
import type { BaseProviderConfig } from '@/types/providers';
import { providerDtoToBaseConfig } from '@/utils/providerMapper';

const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TOP_P = 0.95;

export interface AgentRunParams {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  reasoning?: boolean;
  webSearch?: boolean;
}

export interface AIServiceContext {
  provider: ProviderDTO;
  model: ModelDTO;
  params?: AgentRunParams;
}

export class AIService {
  private provider: ProviderDTO;
  private model: ModelDTO;
  private params: AgentRunParams;

  constructor(context: AIServiceContext) {
    this.provider = context.provider;
    this.model = context.model;
    this.params = context.params ?? {};
  }

  private toConfig(p: ProviderDTO): BaseProviderConfig {
    return providerDtoToBaseConfig(p);
  }

  public async sendMessageToAI(
    messages: Message[],
    onToken: (token: string) => void,
    options?: {
      signal?: AbortSignal;
      onWebSources?: (sources: ChatSource[]) => void;
    }
  ): Promise<Message> {
    const activeProvider = ProviderFactory.createProvider(this.toConfig(this.provider));

    try {
      const providerOptions = {
        model: this.model.modelId,
        temperature: this.params.temperature ?? DEFAULT_TEMPERATURE,
        max_tokens: this.params.maxTokens ?? DEFAULT_MAX_TOKENS,
        top_p: this.params.topP ?? DEFAULT_TOP_P,
        stream: true,
        reasoning: this.params.reasoning ?? false,
        webSearch: this.params.webSearch ?? false,
        ...(options?.signal ? { signal: options.signal } : {}),
        ...(options?.onWebSources ? { onWebSources: options.onWebSources } : {}),
      };

      const cleanMessages = messages.filter((m) => m.role !== 'error');

      return {
        role: 'assistant',
        content: await activeProvider.sendMessage(cleanMessages, providerOptions, onToken),
      };
    } catch (err) {
      loggerService.error(`[renderer] ${this.provider.kind} error:`, err);
      throw err;
    }
  }
}
