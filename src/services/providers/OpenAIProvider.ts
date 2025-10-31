// OpenAI Provider
import { Provider, ProviderOptions, OpenAIConfig } from '../../types/providers';
import { Message } from '@/types/chat';
import loggerService from '../LoggerService';
import { ModelSetting } from '@/types/setting';

const OPENAI_DEFAULT_ORIGIN = 'https://api.openai.com';
const OPENAI_PATH_CHAT_COMPLETIONS = '/chat/completions';
const OPENAI_PATH_MODELS = '/models';

interface OpenAIListModelsResponse {
  object: string;
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }>;
}

class OpenAIProvider implements Provider {
  config: OpenAIConfig;

  constructor(config: OpenAIConfig) {
    this.config = config;
  }

  async sendMessage(
    messages: Message[],
    options?: ProviderOptions,
    onToken?: (token: string) => void
  ): Promise<string> {
    const apiKey = this.config.apiKey;
    const endpoint = this._buildChatCompletionsUrl(this.config.host || OPENAI_DEFAULT_ORIGIN);
    const model = options?.model;

    if (!apiKey) {
      const error = 'OpenAI API key not configured';
      loggerService.error('[OpenAI]', error);
      return `Error: ${error}`;
    }

    if (!model) {
      const error = 'Model not specified for OpenAI';
      loggerService.error('[OpenAI]', error);
      return `Error: ${error}`;
    }

    const body = {
      model,
      messages,
      max_tokens: options.max_tokens,
      stream: options.stream !== undefined ? options.stream : true,
      temperature: options.temperature,
      top_p: options.top_p,
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

    // Handle streaming response
    if (options.stream !== false) {
      return this._handleStreamingResponse(res, onToken);
    } else {
      // Handle non-streaming response
      const data = await res.json();
      const content = data.choices[0]?.message?.content || '';
      if (typeof onToken === 'function') {
        onToken(content);
      }
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
        // OpenAI streams data as lines starting with "data: "
        const lines = chunk.split('\n').filter((line) => line.trim().startsWith('data: '));
        for (const line of lines) {
          const jsonStr = line.replace(/^data: /, '').trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const data = JSON.parse(jsonStr);
            const token = data.choices?.[0]?.delta?.content;
            if (token) {
              if (typeof onToken === 'function') {
                onToken(token);
              }
              fullText += token;
            }
          } catch (err) {
            loggerService.error('JSON parse error:', err, jsonStr);
          }
        }
      }
    }
    return fullText;
  }

  async listModels(): Promise<ModelSetting[]> {
    try {
      if (!this.config.apiKey) {
        return this.config.models || [];
      }

      const modelsUrl = this._buildModelsUrl(this.config.host || OPENAI_DEFAULT_ORIGIN);
      const res = await fetch(modelsUrl, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch models: ${res.status}`);
      }

      const data: OpenAIListModelsResponse = await res.json();
      return data.data
        .filter((model) => model.id.includes('gpt'))
        .map(
          (model) =>
            <ModelSetting>{
              id: model.id,
              name: model.id,
              type: 'chat',
              capabilities: ['chat'],
              description: `OpenAI ${model.id} model`,
            }
        );
    } catch (err) {
      loggerService.error('Failed to list OpenAI models:', err);
    }
  }

  async initialize(config: OpenAIConfig): Promise<void> {
    this.config = config;
  }

  // Extract the base API URL ending with "/v1" from either of these inputs:
  // - https://api.openai.com/v1
  // - https://api.openai.com/v1/chat/completions
  // If no "/v1" segment is present, append it.
  private _deriveApiBase(host: string): string {
    try {
      const url = new URL(host);
      const parts = url.pathname.split('/').filter(Boolean);
      const v1Index = parts.indexOf('v1');
      let basePath: string;
      if (v1Index >= 0) {
        basePath = '/' + parts.slice(0, v1Index + 1).join('/');
      } else {
        // ensure we end with /v1
        const path = parts.join('/');
        basePath = path ? `/${path}/v1` : '/v1';
      }
      url.pathname = basePath.replace(/\/$/, '');
      return url.origin + url.pathname;
    } catch (e) {
      // Surface invalid URLs instead of silently falling back
      throw new Error(`Invalid OpenAI host URL: ${host}`);
    }
  }

  private _buildChatCompletionsUrl(host: string): string {
    const base = this._deriveApiBase(host);
    return `${base}${OPENAI_PATH_CHAT_COMPLETIONS}`;
  }

  private _buildModelsUrl(host: string): string {
    const base = this._deriveApiBase(host);
    return `${base}${OPENAI_PATH_MODELS}`;
  }
}

export default OpenAIProvider;
