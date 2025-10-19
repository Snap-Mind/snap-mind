// Ollama Provider (local models via Ollama REST API)
import { Provider, ProviderOptions, BaseProviderConfig } from '@/types/providers';
import { Message } from '@/types/chat';
import loggerService from '../LoggerService';
import { ModelSetting } from '@/types/setting';

class OllamaProvider implements Provider {
  config: BaseProviderConfig;

  constructor(config: BaseProviderConfig) {
    this.config = config;
  }

  async sendMessage(
    messages: Message[],
    options?: ProviderOptions,
    onToken?: (token: string) => void
  ): Promise<string> {
    const endpoint = this.config.host || 'http://localhost:11434/api/chat';
    const model = options?.model;

    if (!model) {
      const error = 'Model not specified for Ollama';
      loggerService.error('[Ollama]', error);
      return `Error: ${error}`;
    }

    // Map common options into Ollama's `options` bag
    const runtimeOptions: Record<string, any> = {};
    if (typeof options?.temperature === 'number') runtimeOptions.temperature = options.temperature;
    if (typeof options?.top_p === 'number') runtimeOptions.top_p = options.top_p;
    if (typeof options?.max_tokens === 'number') runtimeOptions.num_predict = options.max_tokens;

    const body: any = {
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: options?.stream !== false,
    };
    if (Object.keys(runtimeOptions).length > 0) body.options = runtimeOptions;

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    };
    if (options && options.signal) {
      fetchOptions.signal = options.signal;
    }

    const res = await fetch(endpoint, fetchOptions);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API error: ${res.status} ${errText}`);
    }

    // Handle streaming JSON objects (not SSE). Each chunk is a JSON object separated by newlines.
    if (body.stream) {
      return this._handleStreamingResponse(res, onToken);
    }

    // Non-streaming response
    const data = await res.json();
    const content = data?.message?.content || '';
    if (typeof onToken === 'function') {
      onToken(content);
    }
    return content;
  }

  private async _handleStreamingResponse(
    res: Response,
    onToken?: (token: string) => void
  ): Promise<string> {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines; preserve the last partial line in buffer
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const obj = JSON.parse(trimmed);
          // If Ollama signals completion, exit early
          if (obj?.done === true) {
            return fullText;
          }
          // Surface mid-stream errors if present
          if (obj?.error) {
            throw new Error(typeof obj.error === 'string' ? obj.error : JSON.stringify(obj.error));
          }
          if (obj?.message?.content) {
            const token: string = obj.message.content;
            if (typeof onToken === 'function') onToken(token);
            fullText += token;
          }
          // When done === true the stream will end soon; we don't need to do anything special here
        } catch (e) {
          loggerService.debug?.('[Ollama]', 'Skipping malformed NDJSON line:', trimmed);
        }
      }
    }

    // Attempt to parse any remaining buffered JSON (just in case)
    const tail = buffer.trim();
    if (tail) {
      try {
        const obj = JSON.parse(tail);
        if (obj?.message?.content) {
          const token: string = obj.message.content;
          if (typeof onToken === 'function') onToken(token);
          fullText += token;
        }
      } catch {
        // ignore
      }
    }

    return fullText;
  }

  async listModels(): Promise<ModelSetting[]> {
    try {
      // Derive base URL to call /api/tags
      const base = this._deriveApiBase(this.config.host || 'http://localhost:11434/api/chat');
      const tagsUrl = `${base}/tags`;
      const res = await fetch(tagsUrl);
      if (!res.ok) {
        throw new Error(`Failed to fetch models: ${res.status}`);
      }
      const data = await res.json();
      const models = (data?.models || []) as Array<{
        name: string;
        details?: { family?: string; parameter_size?: string };
      }>;
      if (!Array.isArray(models)) return this.config.models || [];

      return models.map((m) => ({
        id: m.name,
        name: m.name,
        type: 'chat',
        capabilities: ['chat'],
        description: m.details?.family
          ? `Ollama ${m.details.family}${m.details.parameter_size ? ' ' + m.details.parameter_size : ''}`
          : 'Ollama local model',
      }));
    } catch (err) {
      loggerService.error('[Ollama]', 'Failed to list models:', err);
      return this.config.models || [];
    }
  }

  async initialize(config: BaseProviderConfig): Promise<void> {
    this.config = config;
  }

  private _deriveApiBase(host: string): string {
    // Accept host strings like:
    // - http://localhost:11434
    // - http://localhost:11434/api
    // - http://localhost:11434/api/chat
    try {
      const url = new URL(host);
      const parts = url.pathname.split('/').filter(Boolean);
      const apiIndex = parts.indexOf('api');
      const basePath = apiIndex >= 0 ? '/' + parts.slice(0, apiIndex + 1).join('/') : '/api';
      url.pathname = basePath;
      return url.origin + url.pathname;
    } catch {
      // Fallback to default
      return 'http://localhost:11434/api';
    }
  }
}

export default OllamaProvider;
