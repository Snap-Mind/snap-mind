// Azure OpenAI Provider
import { Provider, ProviderOptions, AzureOpenAIConfig } from '../../types/providers';
import { Message } from '@/types/chat';
import loggerService from '../LoggerService';
import { ModelSetting } from '@/types/setting';

class AzureOpenAIProvider implements Provider {
  config: AzureOpenAIConfig;

  constructor(config: AzureOpenAIConfig) {
    this.config = config;
  }

  async sendMessage(
    messages: Message[],
    options?: ProviderOptions,
    onToken?: (token: string) => void
  ): Promise<string> {
    const baseEndpoint = this.config.host;
    const apiKey = this.config.apiKey;
    const apiVersion = this.config.apiVersion;
    const model = options.model;

    if (!baseEndpoint || !apiKey) {
      const error = 'Azure OpenAI endpoint or API key not configured';
      loggerService.error('[AzureOpenAI]', error);
      return `Error: ${error}`;
    }

    if (!model) {
      const error = 'Model not specified for Azure OpenAI';
      loggerService.error('[AzureOpenAI]', error);
      return `Error: ${error}`;
    }

    // In Azure OpenAI, the model is part of the URL rather than the request body
    // The URL format is: baseEndpoint/deployments/{model}/chat/completions?api-version=2023-05-15
    const endpoint = baseEndpoint.includes('/deployments/')
      ? baseEndpoint
      : `${baseEndpoint}/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`;

    const body = {
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
          'api-key': apiKey,
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
      loggerService.error('[AzureOpenAI]', 'Error:', err);
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
        // Azure/OpenAI streams data as lines starting with "data: "
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
            loggerService.error('[AzureOpenAI]', 'JSON parse error:', err, jsonStr);
          }
        }
      }
    }
    return fullText;
  }

  async listModels(): Promise<ModelSetting[]> {
    // For Azure OpenAI, we can't list models programmatically easily
    // Return models from config
    return this.config.models || [];
  }

  async initialize(config: AzureOpenAIConfig): Promise<void> {
    this.config = config;
  }
}

export default AzureOpenAIProvider;
