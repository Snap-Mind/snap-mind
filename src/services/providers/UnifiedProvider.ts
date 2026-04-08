// UnifiedProvider — the single Provider implementation.
//
// All provider-specific logic lives in ProviderAdapter objects.
// This class handles only the generic orchestration:
//   validate → build request → fetch → parse response
//
// To support a new LLM provider, create a new adapter — no changes needed here.

import { Provider, ProviderOptions, BaseProviderConfig } from '@/types/providers';
import { Message } from '@/types/chat';
import { ModelSetting } from '@/types/setting';
import loggerService from '../LoggerService';
import { ProviderAdapter } from '@/types/providers';

export class UnifiedProvider implements Provider {
  config: BaseProviderConfig;
  private adapter: ProviderAdapter;

  constructor(config: BaseProviderConfig, adapter: ProviderAdapter) {
    this.config = config;
    this.adapter = adapter;
  }

  async sendMessage(
    messages: Message[],
    options?: ProviderOptions,
    onToken?: (token: string) => void
  ): Promise<string> {
    // --- Validation ---
    if (this.adapter.validateRequest) {
      // Adapter provides custom validation (e.g. Azure checks host+apiKey, Ollama skips apiKey)
      const error = this.adapter.validateRequest(this.config, options);
      if (error) {
        loggerService.error(`[${this.adapter.providerName}]`, error);
        return `Error: ${error}`;
      }
    } else {
      // Default validation: check apiKey (if required) and model
      if (this.adapter.requiresApiKey && !this.config.apiKey) {
        const error = `${this.adapter.providerName} API key not configured`;
        loggerService.error(`[${this.adapter.providerName}]`, error);
        return `Error: ${error}`;
      }
      if (!options?.model) {
        const error = `Model not specified for ${this.adapter.providerName}`;
        loggerService.error(`[${this.adapter.providerName}]`, error);
        return `Error: ${error}`;
      }
    }

    // --- Build & execute request ---
    const url = this.adapter.buildChatUrl(this.config, options);
    const headers = this.adapter.buildChatHeaders(this.config, options);
    const body = this.adapter.buildChatBody(messages, options!, this.config);

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    };
    if (options?.signal) {
      fetchOptions.signal = options.signal;
    }

    const res = await fetch(url, fetchOptions);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API error: ${res.status} ${errText}`);
    }

    // --- Parse response ---
    if (options?.stream !== false) {
      return this.adapter.parseStreamResponse(res, onToken, options?.onWebSources);
    } else {
      const data = await res.json();
      const content = this.adapter.extractContentFromResponse(data);
      if (typeof onToken === 'function') {
        onToken(content);
      }
      if (options?.onWebSources && this.adapter.extractWebSourcesFromResponse) {
        const sources = this.adapter.extractWebSourcesFromResponse(data);
        if (sources.length > 0) options.onWebSources(sources);
      }
      return content;
    }
  }

  async listModels(): Promise<ModelSetting[]> {
    try {
      const req = this.adapter.buildListModelsRequest(this.config);
      if (!req) {
        return this.config.models || [];
      }

      const res = await fetch(req.url, { headers: req.headers });
      if (!res.ok) {
        throw new Error(`Failed to fetch models: ${res.status}`);
      }
      const data = await res.json();
      return this.adapter.parseModelsResponse(data, this.config);
    } catch (err) {
      loggerService.error(`[${this.adapter.providerName}]`, 'Failed to list models:', err);
      return this.config.models || [];
    }
  }

  async initialize(config: BaseProviderConfig): Promise<void> {
    this.config = config;
  }
}
