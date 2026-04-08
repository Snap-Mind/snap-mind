import { Message } from './chat';
import { ModelSetting } from './setting';

export interface ProviderOptions {
  model: string;
  max_tokens?: number;
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  signal?: AbortSignal;
  reasoning?: boolean;
  webSearch?: boolean;
}

export interface BaseProviderConfig {
  id: ProviderType;
  name: string;
  apiKey: string;
  host: string;
  models?: ModelSetting[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentional placeholder for future OpenAI-specific fields
export interface OpenAIConfig extends BaseProviderConfig {}

export interface AzureOpenAIConfig extends BaseProviderConfig {
  apiVersion: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentional placeholder for future Anthropic-specific fields
export interface AnthropicConfig extends BaseProviderConfig {}

export interface GoogleConfig extends BaseProviderConfig {
  config?: {
    topK?: number;
  };
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentional placeholder for future DeepSeek-specific fields
export interface DeepSeekConfig extends BaseProviderConfig {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentional placeholder for future Qwen-specific fields
export interface QwenConfig extends BaseProviderConfig {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- placeholder for Ollama-specific fields
export interface OllamaConfig extends BaseProviderConfig {}

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

export type ProviderType =
  | 'openai'
  | 'azure-openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'qwen'
  | 'ollama';

// --- Composition-based adapter interfaces (used by UnifiedProvider) ---

/**
 * Handles all request construction for a provider:
 * building URLs, headers, and request bodies for both chat and model listing.
 */
export interface RequestBuilder {
  /** Human-readable provider name (used in error messages and logs). */
  readonly providerName: string;

  /** Whether this provider requires an API key for chat requests. */
  readonly requiresApiKey: boolean;

  /**
   * Optional custom request validation.
   * Return an error message string or null if valid.
   */
  validateRequest?(config: BaseProviderConfig, options?: ProviderOptions): string | null;

  /** Build the full chat endpoint URL. */
  buildChatUrl(config: BaseProviderConfig, options?: ProviderOptions): string;

  /** Build HTTP headers for chat requests. */
  buildChatHeaders(config: BaseProviderConfig, options?: ProviderOptions): Record<string, string>;

  /** Build the request body for chat completions. */
  buildChatBody(messages: Message[], options: ProviderOptions, config: BaseProviderConfig): any;

  /**
   * Build the request for listing available models.
   * Return null to skip the API call (falls back to config.models).
   */
  buildListModelsRequest(
    config: BaseProviderConfig
  ): { url: string; headers: Record<string, string> } | null;
}

/**
 * Handles all response parsing for a provider:
 * streaming, non-streaming content extraction, and model list parsing.
 */
export interface ResponseParser {
  /** Parse a streaming response, calling onToken for each incremental token. */
  parseStreamResponse(res: Response, onToken?: (token: string) => void): Promise<string>;

  /** Extract content from a non-streaming response JSON. */
  extractContentFromResponse(data: any): string;

  /** Parse the models list API response into ModelSetting[]. */
  parseModelsResponse(data: any, config: BaseProviderConfig): ModelSetting[];
}

/**
 * Composite adapter used by UnifiedProvider.
 * Combines request building and response parsing into a single interface.
 */
export interface ProviderAdapter extends RequestBuilder, ResponseParser {}
