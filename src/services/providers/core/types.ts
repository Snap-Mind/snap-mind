// Split interfaces for the composition-based provider architecture.
// RequestBuilder handles request construction, ResponseParser handles response parsing.
// ProviderAdapter is the composite used by UnifiedProvider.

import { Message } from '@/types/chat';
import { BaseProviderConfig, ProviderOptions } from '@/types/providers';
import { ModelSetting } from '@/types/setting';

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
  buildChatHeaders(config: BaseProviderConfig): Record<string, string>;

  /** Build the request body for chat completions. */
  buildChatBody(
    messages: Message[],
    options: ProviderOptions,
    config: BaseProviderConfig
  ): any;

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
