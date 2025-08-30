// Google AI (Gemini) Provider
import { Provider, ProviderOptions, GoogleConfig } from '../../types/providers';
import { Message } from '@/types/chat';
import loggerService from '../LoggerService';
import { ModelSetting } from '@/types/setting';

interface GoogleMessage {
  role: string;
  parts: Array<{ text: string }>;
}

class GoogleProvider implements Provider {
  config: GoogleConfig;

  constructor(config: GoogleConfig) {
    this.config = config;
  }

  async sendMessage(
    messages: Message[],
    options?: ProviderOptions,
    onToken?: (token: string) => void
  ): Promise<string> {
    const apiKey = this.config.apiKey;
    const model = options?.model;
    const topK = this.config.config?.topK;

    // Base endpoint for Gemini API
    const baseEndpoint = this.config.host;
    const endpoint = `${baseEndpoint}/models/${model}:generateContent?key=${apiKey}`;

    if (!apiKey) {
      const error = 'Google AI API key not configured';
      loggerService.error('[Google]', error);
      return `Error: ${error}`;
    }

    if (!model) {
      const error = 'Model not specified for Google AI';
      loggerService.error('[Google]', error);
      return `Error: ${error}`;
    }

    // Convert OpenAI format messages to Google format
    const googleMessages: GoogleMessage[] = [];
    let systemPrompt = '';

    for (const message of messages) {
      if (message.role === 'system') {
        systemPrompt = message.content;
      } else if (message.role === 'user') {
        googleMessages.push({
          role: 'user',
          parts: [{ text: message.content }],
        });
      } else if (message.role === 'assistant') {
        googleMessages.push({
          role: 'model',
          parts: [{ text: message.content }],
        });
      }
    }

    // If there's a system prompt, prepend it to the first user message
    if (systemPrompt && googleMessages.length > 0) {
      for (let i = 0; i < googleMessages.length; i++) {
        if (googleMessages[i].role === 'user') {
          const originalContent = googleMessages[i].parts[0].text;
          googleMessages[i].parts[0].text = `${systemPrompt}\n\n${originalContent}`;
          break;
        }
      }
    } else if (systemPrompt) {
      // If there's only a system prompt with no user messages
      googleMessages.push({
        role: 'user',
        parts: [{ text: systemPrompt }],
      });
    }

    const body = {
      contents: googleMessages,
      generationConfig: {
        temperature: options?.temperature,
        maxOutputTokens: options?.max_tokens,
        topP: options?.top_p,
        topK: topK,
      },
    };

    // Add stream flag if streaming is enabled
    const requestUrl =
      options?.stream !== false
        ? `${endpoint}&alt=sse` // Server-Sent Events for streaming
        : endpoint;

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
    const res = await fetch(requestUrl, fetchOptions);

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
      const content = data.candidates[0]?.content?.parts[0]?.text || '';
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
    let buffer = '';

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        buffer += decoder.decode(value, { stream: true });

        // Process SSE events from the buffer
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Keep the last incomplete event in buffer

        for (const event of events) {
          if (!event.trim() || event.includes('[DONE]')) continue;

          // Extract the data part of the SSE
          const dataMatch = event.match(/^data: (.+)$/m);
          if (!dataMatch) continue;

          try {
            const data = JSON.parse(dataMatch[1]);
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
              const token = data.candidates[0].content.parts[0].text;
              if (typeof onToken === 'function') {
                onToken(token);
              }
              fullText += token;
            }
          } catch (err) {
            loggerService.error('[Google]', 'JSON parse error:', err);
          }
        }
      }
    }
    return fullText;
  }

  /**
   * List available models for Google AI
   * @returns {Promise<Model[]>} - Array of available models
   */
  async listModels(): Promise<ModelSetting[]> {
    try {
      if (!this.config.apiKey) {
        return this.config.models || [];
      }

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.config.apiKey}`;
      const res = await fetch(endpoint);

      if (!res.ok) {
        throw new Error(`Failed to fetch models: ${res.status}`);
      }

      const data = await res.json();
      return data.models
        .filter((model: { name: string }) => model.name.includes('gemini'))
        .map((model: { name: string; displayName?: string; description?: string }) => ({
          id: model.name.split('/').pop(),
          name: model.displayName || model.name,
          type: 'chat',
          description: model.description || `Google ${model.name} model`,
        }));
    } catch (err) {
      loggerService.error('[Google]', 'Failed to list models:', err);
      // Return models from config if API call fails
      return (
        this.config.models || [
          {
            id: 'gemini-1.5-pro',
            name: 'Gemini 1.5 Pro',
            type: 'chat',
            capabilities: ['chat'],
            description: 'Highly capable multimodal model',
          },
          {
            id: 'gemini-1.5-flash',
            name: 'Gemini 1.5 Flash',
            type: 'chat',
            capabilities: ['chat'],
            description: 'Fast and efficient model for most tasks',
          },
        ]
      );
    }
  }

  async initialize(config: GoogleConfig): Promise<void> {
    this.config = config;
  }
}

export default GoogleProvider;
