// Anthropic Provider
import { Provider, ProviderOptions, AnthropicConfig } from '../../types/providers';
import { Message } from '@/types/chat';
import loggerService from '../LoggerService';
import { ModelSetting } from '@/types/setting';

// API version constant
const ANTHROPIC_API_VERSION = '2023-06-01';

class AnthropicProvider implements Provider {
  config: AnthropicConfig;

  constructor(config: AnthropicConfig) {
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
      const error = 'Anthropic API key not configured';
      loggerService.error('[Anthropic]', error);
      return `Error: ${error}`;
    }

    if (!model) {
      const error = 'Model not specified for Anthropic';
      loggerService.error('[Anthropic]', error);
      return `Error: ${error}`;
    }

    // Convert OpenAI format messages to Anthropic format
    // For Anthropic, we need to handle system prompt separately
    let systemPrompt = '';
    const anthropicMessages: { role: string; content: string }[] = [];

    for (const message of messages) {
      if (message.role === 'system') {
        systemPrompt = message.content;
      } else {
        // Map 'user' and 'assistant' roles directly
        anthropicMessages.push({
          role: message.role,
          content: message.content,
        });
      }
    }

    const body = {
      model,
      messages: anthropicMessages,
      system: systemPrompt,
      max_tokens: options?.max_tokens,
      stream: options?.stream !== undefined ? options.stream : true,
      temperature: options?.temperature,
      top_p: options?.top_p,
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          'Anthropic-Version': ANTHROPIC_API_VERSION,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`API error: ${res.status} ${errText}`);
      }

      // Handle streaming response
      if (options?.stream !== false) {
        return this._handleStreamingResponse(res, onToken);
      } else {
        // Handle non-streaming response
        const data = await res.json();
        const content = data.content?.[0]?.text || '';
        if (typeof onToken === 'function') {
          onToken(content);
        }
        return content;
      }
    } catch (err) {
      loggerService.error('[Anthropic]', 'Error:', err);
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
    let buffer = '';

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        buffer += decoder.decode(value, { stream: true });

        // Process complete events from the buffer
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Keep the last incomplete event in buffer

        for (const event of events) {
          if (!event.trim() || event.trim() === 'data: [DONE]') continue;

          const dataMatch = event.match(/^data: (.+)$/m);
          if (!dataMatch) continue;

          try {
            const data = JSON.parse(dataMatch[1]);
            // Anthropic sends different event types
            if (data.type === 'content_block_delta' && data.delta?.text) {
              const token = data.delta.text;
              if (typeof onToken === 'function') {
                onToken(token);
              }
              fullText += token;
            }
          } catch (err) {
            loggerService.error('[Anthropic]', 'JSON parse error:', err, event);
          }
        }
      }
    }
    return fullText;
  }

  async listModels(): Promise<ModelSetting[]> {
    // Anthropic doesn't have a list models endpoint currently
    // Return a default list of models
    return (
      this.config.models || [
        {
          id: 'claude-3-opus-20240229',
          name: 'Claude 3 Opus',
          type: 'chat',
          description: 'Most powerful Claude model for highly complex tasks',
        },
        {
          id: 'claude-3-sonnet-20240229',
          name: 'Claude 3 Sonnet',
          type: 'chat',
          description: 'Balanced Claude model for most tasks',
        },
        {
          id: 'claude-3-haiku-20240307',
          name: 'Claude 3 Haiku',
          type: 'chat',
          description: 'Fastest, most compact Claude model',
        },
      ]
    );
  }

  async initialize(config: AnthropicConfig): Promise<void> {
    this.config = config;
  }
}

export default AnthropicProvider;
