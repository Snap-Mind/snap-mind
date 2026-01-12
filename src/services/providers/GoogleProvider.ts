// Google AI (Gemini) Provider
import { Provider, ProviderOptions, GoogleConfig } from '../../types/providers';
import { Message } from '@/types/chat';
import loggerService from '../LoggerService';
import { ModelSetting } from '@/types/setting';

interface GoogleMessage {
  role: string;
  parts: Array<{ text: string }>;
}

// Google Generative Language API constants (mirroring OpenAI provider pattern)
const GOOGLE_DEFAULT_ORIGIN = 'https://generativelanguage.googleapis.com';
const GOOGLE_PATH_MODELS = '/models';
const GOOGLE_GENERATE_CONTENT_SUFFIX = ':generateContent';

class GoogleProvider implements Provider {
  config: GoogleConfig;

  constructor(config: GoogleConfig) {
    this.config = config;
  }

  async sendMessage(
    messages: Message[],
    options?: ProviderOptions,
    onToken?: (token: string, reasoning?: string) => void
  ): Promise<string> {
    const apiKey = this.config.apiKey;
    const model = options?.model;
    const topK = this.config.config?.topK;

    // Build content generation endpoint via helpers (OpenAI-style pattern)
    const endpoint = this._buildGenerateContentUrl(
      this.config.host || GOOGLE_DEFAULT_ORIGIN,
      model,
      apiKey,
      options?.stream !== false
    );

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
    const requestUrl = endpoint;

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
        onToken(content, undefined);
      }
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
    let buffer = '';

    // State for parsing <think> tags (similar to OllamaProvider)
    let isThinking = false;
    let textBuffer = '';

    const processTextBuffer = () => {
      while (textBuffer.length > 0) {
        if (!isThinking) {
          const startTagIndex = textBuffer.indexOf('<think>');
          if (startTagIndex !== -1) {
            const normalText = textBuffer.substring(0, startTagIndex);
            if (normalText) {
              if (typeof onToken === 'function') onToken(normalText, undefined);
              fullText += normalText;
            }
            textBuffer = textBuffer.substring(startTagIndex + 7);
            isThinking = true;
          } else {
            const partialMatch = textBuffer.match(/<(?:t(?:h(?:i(?:n(?:k)?)?)?)?)?$/);
            if (partialMatch) {
              if (partialMatch.index! > 0) {
                const safeText = textBuffer.substring(0, partialMatch.index);
                if (typeof onToken === 'function') onToken(safeText, undefined);
                fullText += safeText;
                textBuffer = textBuffer.substring(partialMatch.index!);
              }
              break;
            } else {
              if (typeof onToken === 'function') onToken(textBuffer, undefined);
              fullText += textBuffer;
              textBuffer = '';
            }
          }
        } else {
          const endTagIndex = textBuffer.indexOf('</think>');
          if (endTagIndex !== -1) {
            const thoughtText = textBuffer.substring(0, endTagIndex);
            if (thoughtText && typeof onToken === 'function') onToken('', thoughtText);
            textBuffer = textBuffer.substring(endTagIndex + 8);
            isThinking = false;
          } else {
            const partialMatch = textBuffer.match(/<\/(?:t(?:h(?:i(?:n(?:k)?)?)?)?)?$/);
            if (partialMatch) {
              if (partialMatch.index! > 0) {
                const safeThought = textBuffer.substring(0, partialMatch.index);
                if (typeof onToken === 'function') onToken('', safeThought);
                textBuffer = textBuffer.substring(partialMatch.index!);
              }
              break;
            } else {
              if (typeof onToken === 'function') onToken('', textBuffer);
              textBuffer = '';
            }
          }
        }
      }
    };

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
            const candidate = data.candidates?.[0];
            if (candidate?.content?.parts?.[0]?.text) {
              const token = candidate.content.parts[0].text;
              textBuffer += token;
              processTextBuffer();
            }
          } catch (err) {
            loggerService.error('[Google]', 'JSON parse error:', err);
          }
        }
      }
    }

    // Final flush
    processTextBuffer();
    return fullText;
  }

  /**
   * List available models for Google AI
   * @returns {Promise<Model[]>} - Array of available models
   */
  async listModels(): Promise<ModelSetting[]> {
    // Align with Anthropic/OpenAI pattern: no hardcoded fallback defaults.
    if (!this.config.apiKey) {
      return this.config.models || [];
    }
    try {
      const modelsUrl = this._buildModelsUrl(
        this.config.host || GOOGLE_DEFAULT_ORIGIN,
        this.config.apiKey
      );
      const res = await fetch(modelsUrl, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch models: ${res.status}`);
      }
      const data = await res.json();
      return Array.isArray(data.models)
        ? data.models.map(
            (model: { name: string; displayName?: string; description?: string }) =>
              <ModelSetting>{
                id: model.name.split('/').pop(),
                name: model.displayName || model.name,
                type: 'chat',
                capabilities: ['chat'],
                description: model.description || `Google ${model.name} model`,
              }
          )
        : [];
    } catch (err) {
      loggerService.error('[Google]', 'Failed to list models:', err);
      return this.config.models || [];
    }
  }

  async initialize(config: GoogleConfig): Promise<void> {
    this.config = config;
  }

  // Helpers mimicking OpenAI pattern
  private _deriveApiBase(host: string): string {
    try {
      const url = new URL(host);
      const parts = url.pathname.split('/').filter(Boolean);
      // Find version segment starting with v digit (e.g. v1, v1beta)
      const versionIndex = parts.findIndex((p) => /^v\d/.test(p));
      let baseParts: string[];
      if (versionIndex >= 0) {
        baseParts = parts.slice(0, versionIndex + 1);
      } else {
        baseParts = parts.concat('v1beta');
      }
      url.pathname = '/' + baseParts.join('/');
      return url.origin + url.pathname.replace(/\/$/, '');
    } catch (e) {
      throw new Error(`Invalid Google host URL: ${host}`);
    }
  }

  private _buildGenerateContentUrl(
    host: string,
    model: string,
    apiKey: string,
    streaming: boolean
  ): string {
    const base = this._deriveApiBase(host);
    const path = `${GOOGLE_PATH_MODELS}/${model}${GOOGLE_GENERATE_CONTENT_SUFFIX}`;
    const url = `${base}${path}?key=${apiKey}${streaming ? '&alt=sse' : ''}`;
    return url;
  }

  private _buildModelsUrl(host: string, apiKey: string): string {
    const base = this._deriveApiBase(host);
    return `${base}${GOOGLE_PATH_MODELS}?key=${apiKey}`;
  }
}

export default GoogleProvider;
