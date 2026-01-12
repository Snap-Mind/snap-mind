// DeepSeek Provider (OpenAI-compatible)
import { Provider, ProviderOptions, DeepSeekConfig } from '../../types/providers';
import { Message } from '@/types/chat';
import loggerService from '../LoggerService';
import { ModelSetting } from '@/types/setting';

const DEEPSEEK_DEFAULT_ORIGIN = 'https://api.deepseek.com';
const DEEPSEEK_PATH_CHAT_COMPLETIONS = '/chat/completions';
const DEEPSEEK_PATH_MODELS = '/models';
const DEEPSEEK_API_VERSION = 'v1';

class DeepSeekProvider implements Provider {
  config: DeepSeekConfig;

  constructor(config: DeepSeekConfig) {
    this.config = config;
  }

  async sendMessage(
    messages: Message[],
    options?: ProviderOptions,
    onToken?: (token: string, reasoning?: string) => void
  ): Promise<string> {
    const apiKey = this.config.apiKey;
    const endpoint = this._buildChatUrl(this.config.host);
    const model = options?.model;

    if (!apiKey) {
      const error = 'DeepSeek API key not configured';
      loggerService.error('[DeepSeek]', error);
      return `Error: ${error}`;
    }

    if (!model) {
      const error = 'Model not specified for DeepSeek';
      loggerService.error('[DeepSeek]', error);
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
    onToken?: (token: string, reasoning?: string) => void
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
            const delta = data.choices?.[0]?.delta;
            const token = delta?.content;
            const reasoning = delta?.reasoning_content;

            if (token || reasoning) {
              if (typeof onToken === 'function') onToken(token || '', reasoning);
              if (token) fullText += token;
            }
          } catch (err) {
            loggerService.error('[DeepSeek] JSON parse error:', err, jsonStr);
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
      const modelsUrl = this._buildModelsUrl(this.config.host);
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
                description: `DeepSeek ${m.id} model`,
              }
          )
        : [];
    } catch (err) {
      loggerService.error('[DeepSeek]', 'Failed to list models:', err);
      // On error, don't inject defaults; return configured models or empty.
      return this.config.models || [];
    }
  }

  // Build the models endpoint from the host
  private _buildModelsUrl(host: string): string {
    try {
      const base = this._deriveApiBase(host || DEEPSEEK_DEFAULT_ORIGIN);
      return `${base}${DEEPSEEK_PATH_MODELS}`;
    } catch (e) {
      throw new Error(`Invalid DeepSeek host URL: ${host}`);
    }
  }

  // Build chat completions endpoint from host (host can be bare origin)
  private _buildChatUrl(host: string): string {
    const base = this._deriveApiBase(host || DEEPSEEK_DEFAULT_ORIGIN);
    return `${base}${DEEPSEEK_PATH_CHAT_COMPLETIONS}`;
  }

  private _deriveApiBase(raw: string): string {
    try {
      const url = new URL(raw);
      const parts = url.pathname.split('/').filter(Boolean);
      const vIndex = parts.indexOf(DEEPSEEK_API_VERSION);
      let basePath: string;
      if (vIndex >= 0) {
        basePath = '/' + parts.slice(0, vIndex + 1).join('/');
      } else {
        basePath = '/v1';
      }
      url.pathname = basePath.replace(/\/$/, '');
      return url.origin + url.pathname;
    } catch (e) {
      throw new Error(`Invalid DeepSeek host URL: ${raw}`);
    }
  }

  async initialize(config: DeepSeekConfig): Promise<void> {
    this.config = config;
  }
}

export default DeepSeekProvider;
