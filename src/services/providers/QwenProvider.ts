// Qwen Provider (OpenAI-compatible via DashScope or official endpoint)
import { Provider, ProviderOptions, QwenConfig } from '../../types/providers';
import { Message } from '@/types/chat';
import loggerService from '../LoggerService';
import { ModelSetting } from '@/types/setting';

const QWEN_DEFAULT_ORIGIN = 'https://dashscope.aliyuncs.com';
const QWEN_PATH_CHAT_COMPLETIONS = '/chat/completions';
const QWEN_PATH_MODELS = '/models';

class QwenProvider implements Provider {
  config: QwenConfig;

  constructor(config: QwenConfig) {
    this.config = config;
  }

  async sendMessage(
    messages: Message[],
    options?: ProviderOptions,
    onToken?: (token: string) => void
  ): Promise<string> {
    const apiKey = this.config.apiKey;
    const endpoint = this._buildChatUrl(this.config.host || QWEN_DEFAULT_ORIGIN);
    const model = options?.model;

    if (!apiKey) {
      const error = 'Qwen API key not configured';
      loggerService.error('[Qwen]', error);
      return `Error: ${error}`;
    }

    if (!model) {
      const error = 'Model not specified for Qwen';
      loggerService.error('[Qwen]', error);
      return `Error: ${error}`;
    }

    const body = {
      model,
      messages,
      max_tokens: options?.max_tokens,
      stream: options?.stream !== undefined ? options.stream : true,
      temperature: options?.temperature,
      top_p: options?.top_p,
    };

    const fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
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

    if (options?.stream !== false) {
      return this._handleStreamingResponse(res, onToken);
    } else {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      if (typeof onToken === 'function') onToken(content);
      return content;
    }
  }

  private async _handleStreamingResponse(
    res: Response,
    onToken?: (token: string) => void
  ): Promise<string> {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;
    let fullText = '';

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((line) => line.trim().startsWith('data: '));
        for (const line of lines) {
          const jsonStr = line.replace(/^data: /, '').trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const data = JSON.parse(jsonStr);
            const token = data.choices?.[0]?.delta?.content;
            if (token) {
              if (typeof onToken === 'function') onToken(token);
              fullText += token;
            }
          } catch (err) {
            loggerService.error('[Qwen] JSON parse error:', err, jsonStr);
          }
        }
      }
    }
    return fullText;
  }

  async listModels(): Promise<ModelSetting[]> {
    // Mirror OpenAI pattern: if no API key, return configured models (or empty) without hardcoded defaults.
    if (!this.config.apiKey) {
      return this.config.models || [];
    }
    try {
      const modelsUrl = this._buildModelsUrl(this.config.host || QWEN_DEFAULT_ORIGIN);
      const res = await fetch(modelsUrl, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch models: ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data.data)
        ? data.data.map(
            (m: { id: string; object?: string; owned_by?: string }) =>
              <ModelSetting>{
                id: m.id,
                name: m.id,
                type: 'chat',
                capabilities: ['chat'],
                description: `Qwen ${m.id} model`,
              }
          )
        : [];
    } catch (err) {
      loggerService.error('[Qwen]', 'Failed to list models:', err);
      // On error, don't inject defaults; return configured models or empty.
      return this.config.models || [];
    }
  }

  // Build the models endpoint from the host
  private _buildModelsUrl(host: string): string {
    try {
      const base = this._deriveApiBase(host);
      return `${base}${QWEN_PATH_MODELS}`;
    } catch (e) {
      throw new Error(`Invalid Qwen host URL: ${host}`);
    }
  }

  // Build chat completions endpoint from host (host can be bare origin)
  private _buildChatUrl(host: string): string {
    const base = this._deriveApiBase(host);
    return `${base}${QWEN_PATH_CHAT_COMPLETIONS}`;
  }

  private _deriveApiBase(raw: string): string {
    try {
      const url = new URL(raw);
      const parts = url.pathname.split('/').filter(Boolean);

      // Look for 'compatible-mode' and 'v1' segments
      const compatIndex = parts.indexOf('compatible-mode');
      const vIndex = parts.findIndex((p) => /^v\d/.test(p));

      let baseParts: string[];

      if (compatIndex >= 0) {
        // If we found 'compatible-mode', keep everything up to and including 'v1'
        if (vIndex > compatIndex) {
          baseParts = parts.slice(0, vIndex + 1);
        } else {
          // compatible-mode exists but no version after it, add v1
          baseParts = parts.slice(0, compatIndex + 1).concat(['v1']);
        }
      } else {
        // No compatible-mode found, prepend it
        baseParts = ['compatible-mode', 'v1'];
      }

      url.pathname = '/' + baseParts.join('/');
      return url.origin + url.pathname.replace(/\/$/, '');
    } catch (e) {
      throw new Error(`Invalid Qwen host URL: ${raw}`);
    }
  }

  async initialize(config: QwenConfig): Promise<void> {
    this.config = config;
  }
}

export default QwenProvider;
