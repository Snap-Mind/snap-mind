// Core interfaces for the composition-based provider architecture.
// Each ProviderAdapter encapsulates all provider-specific behavior.
// The UnifiedProvider delegates to an adapter for all API-specific logic.

import { Message } from '@/types/chat';
import { BaseProviderConfig, ProviderOptions } from '@/types/providers';
import { ModelSetting } from '@/types/setting';

/**
 * A ProviderAdapter is a plain object that encapsulates ALL differences
 * between LLM provider APIs. The UnifiedProvider class delegates every
 * provider-specific decision to the adapter, keeping its own code generic.
 *
 * To add a new provider, create a new adapter object — no subclassing needed.
 */
export interface ProviderAdapter {
  /** Human-readable provider name (used in error messages and logs). */
  readonly providerName: string;

  /** Whether this provider requires an API key for chat requests. */
  readonly requiresApiKey: boolean;

  /**
   * Optional custom request validation.
   * Return an error message string or null if valid.
   * When provided, this replaces the default validation logic entirely.
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

  /** Parse a streaming response, calling onToken for each incremental token. */
  parseStreamResponse(res: Response, onToken?: (token: string) => void): Promise<string>;

  /** Extract content from a non-streaming response JSON. */
  extractContentFromResponse(data: any): string;

  /**
   * Build the request for listing available models.
   * Return null to skip the API call (falls back to config.models).
   */
  buildListModelsRequest(
    config: BaseProviderConfig
  ): { url: string; headers: Record<string, string> } | null;

  /** Parse the models list API response into ModelSetting[]. */
  parseModelsResponse(data: any, config: BaseProviderConfig): ModelSetting[];
}
