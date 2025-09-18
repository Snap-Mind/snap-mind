// Qwen Provider (OpenAI-compatible via DashScope or official endpoint)
import { Provider, ProviderOptions, QwenConfig } from '../../types/providers';
import { Message } from '@/types/chat';
import loggerService from '../LoggerService';
import { ModelSetting } from '@/types/setting';

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
    const endpoint = this.config.host; // e.g. https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
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
    return (
      this.config.models || [
        {
          id: 'qwen-plus',
          name: 'Qwen Plus',
          type: 'chat',
          capabilities: ['chat'],
          description: 'Balanced Qwen model',
        },
        {
          id: 'qwen-max',
          name: 'Qwen Max',
          type: 'chat',
          capabilities: ['chat'],
          description: 'Most capable Qwen model',
        },
        {
          id: 'qwen-turbo',
          name: 'Qwen Turbo',
          type: 'chat',
          capabilities: ['chat'],
          description: 'Fast and efficient Qwen model',
        },
      ]
    );
  }

  async initialize(config: QwenConfig): Promise<void> {
    this.config = config;
  }
}

export default QwenProvider;
