// DeepSeek Provider (OpenAI-compatible)
import { Provider, ProviderOptions, DeepSeekConfig } from '../../types/providers';
import { Message } from '@/types/chat';
import loggerService from '../LoggerService';
import { ModelSetting } from '@/types/setting';

class DeepSeekProvider implements Provider {
  config: DeepSeekConfig;

  constructor(config: DeepSeekConfig) {
    this.config = config;
  }

  async sendMessage(
    messages: Message[],
    options?: ProviderOptions,
    onToken?: (token: string) => void
  ): Promise<string> {
    const apiKey = this.config.apiKey;
    const endpoint = this.config.host; // Typically https://api.deepseek.com/chat/completions or compatible
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
            loggerService.error('[DeepSeek] JSON parse error:', err, jsonStr);
          }
        }
      }
    }
    return fullText;
  }

  async listModels(): Promise<ModelSetting[]> {
    // DeepSeek often uses fixed model ids like deepseek-chat, deepseek-reasoner
    return (
      this.config.models || [
        {
          id: 'deepseek-chat',
          name: 'DeepSeek Chat',
          type: 'chat',
          capabilities: ['chat'],
          description: 'DeepSeek general chat model',
        },
        {
          id: 'deepseek-reasoner',
          name: 'DeepSeek Reasoner',
          type: 'chat',
          capabilities: ['chat', 'reasoning'],
          description: 'Reasoning-optimized model',
        },
      ]
    );
  }

  async initialize(config: DeepSeekConfig): Promise<void> {
    this.config = config;
  }
}

export default DeepSeekProvider;
