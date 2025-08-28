// OpenAI Provider
import { Provider, ProviderOptions, OpenAIConfig } from '../../types/providers';
import { Message } from '@/types/chat';
import loggerService from '../LoggerService';
import { ModelSetting } from '@/types/setting';

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
    const endpoint = this.config.host;
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

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

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
    } catch (err) {
      loggerService.error('[renderer] OpenAI error:', err);
      if (typeof onToken === 'function') {
        onToken(`\n[Error: ${err.message}]`);
      }
      return `Error: ${err.message}`;
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

      const endpoint = 'https://api.openai.com/v1/models';
      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch models: ${res.status}`);
      }

      const data = await res.json();
      return data.data
        .filter((model: { id: string }) => model.id.includes('gpt'))
        .map((model: { id: string }) => ({
          id: model.id,
          name: model.id,
          type: 'chat',
          description: `OpenAI ${model.id} model`,
        }));
    } catch (err) {
      loggerService.error('Failed to list OpenAI models:', err);
      // Return models from config if API call fails
      return this.config.models || [];
    }
  }

  async initialize(config: OpenAIConfig): Promise<void> {
    this.config = config;
  }
}

export default OpenAIProvider;
