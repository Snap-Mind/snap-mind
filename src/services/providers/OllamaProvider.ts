// Ollama Provider (local models via Ollama REST API)
import { Provider, ProviderOptions, BaseProviderConfig } from '@/types/providers';
import { Message } from '@/types/chat';
import loggerService from '../LoggerService';
import { ModelSetting } from '@/types/setting';

const OLLAMA_DEFAULT_ORIGIN = 'http://localhost:11434';
const OLLAMA_PATH_API = '/api';
const OLLAMA_PATH_CHAT = '/chat';
const OLLAMA_PATH_TAGS = '/tags';

class OllamaProvider implements Provider {
  config: BaseProviderConfig;

  constructor(config: BaseProviderConfig) {
    this.config = config;
  }

  async sendMessage(
    messages: Message[],
    options?: ProviderOptions,
    onToken?: (token: string, reasoning?: string) => void
  ): Promise<string> {
    const endpoint = this._buildChatUrl(this.config.host || OLLAMA_DEFAULT_ORIGIN);
    const model = options?.model;

    if (!model) {
      const error = 'Model not specified for Ollama';
      loggerService.error('[Ollama]', error);
      return `Error: ${error}`;
    }

    // Map common options into Ollama's `options` bag
    const runtimeOptions: Record<string, any> = {};
    if (typeof options?.temperature === 'number') runtimeOptions.temperature = options.temperature;
    if (typeof options?.top_p === 'number') runtimeOptions.top_p = options.top_p;
    if (typeof options?.max_tokens === 'number') runtimeOptions.num_predict = options.max_tokens;

    const body: any = {
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: options?.stream !== false,
    };
    if (Object.keys(runtimeOptions).length > 0) body.options = runtimeOptions;

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

    const res = await fetch(endpoint, fetchOptions);

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API error: ${res.status} ${errText}`);
    }

    // Handle streaming JSON objects (not SSE). Each chunk is a JSON object separated by newlines.
    if (body.stream) {
      return this._handleStreamingResponse(res, onToken);
    }

    // Non-streaming response
    const data = await res.json();
    const content = data?.message?.content || '';
    if (typeof onToken === 'function') {
      onToken(content);
    }
    return content;
  }

  private async _handleStreamingResponse(
    res: Response,
    onToken?: (token: string, reasoning?: string) => void
  ): Promise<string> {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let buffer = '';

    // State for parsing <think> tags
    let isThinking = false;
    let textBuffer = '';

    // Helper to process textBuffer statefully
    const processTextBuffer = () => {
      while (textBuffer.length > 0) {
        if (!isThinking) {
          const startTagIndex = textBuffer.indexOf('<think>');
          if (startTagIndex !== -1) {
            // Found <think>, emit text before it
            const normalText = textBuffer.substring(0, startTagIndex);
            if (normalText) {
              if (typeof onToken === 'function') onToken(normalText, undefined);
              fullText += normalText;
            }
            // Switch to thinking mode
            textBuffer = textBuffer.substring(startTagIndex + 7);
            isThinking = true;
          } else {
            // No full <think> tag. Check for partial tag at end.
            // Matches <, <t, <th, ... <think
            const partialMatch = textBuffer.match(/<(?:t(?:h(?:i(?:n(?:k)?)?)?)?)?$/);
            if (partialMatch) {
              // We have a possible partial tag at the end
              if (partialMatch.index! > 0) {
                // Emit safe part
                const safeText = textBuffer.substring(0, partialMatch.index);
                if (typeof onToken === 'function') onToken(safeText, undefined);
                fullText += safeText;
                textBuffer = textBuffer.substring(partialMatch.index!);
              }
              // Stop processing and wait for more data to resolve the tag
              break;
            } else {
              // No tag at all, emit everything
              if (typeof onToken === 'function') onToken(textBuffer, undefined);
              fullText += textBuffer;
              textBuffer = '';
            }
          }
        } else {
          // Inside <think>
          const endTagIndex = textBuffer.indexOf('</think>');
          if (endTagIndex !== -1) {
            // Found </think>, emit thought before it
            const thoughtText = textBuffer.substring(0, endTagIndex);
            if (thoughtText && typeof onToken === 'function') onToken('', thoughtText);

            // Switch back to normal mode
            textBuffer = textBuffer.substring(endTagIndex + 8);
            isThinking = false;
          } else {
            // Check for partial </think>
            const partialMatch = textBuffer.match(/<\/(?:t(?:h(?:i(?:n(?:k)?)?)?)?)?$/);
            if (partialMatch) {
              // Emit safe thought part
              if (partialMatch.index! > 0) {
                const safeThought = textBuffer.substring(0, partialMatch.index);
                if (typeof onToken === 'function') onToken('', safeThought);
                textBuffer = textBuffer.substring(partialMatch.index!);
              }
              break;
            } else {
              // Emit all as thought
              if (typeof onToken === 'function') onToken('', textBuffer);
              textBuffer = '';
            }
          }
        }
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;

      buffer += decoder.decode(value, { stream: true });

      // Process complete lines; preserve the last partial line in buffer
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let hasError = false;
        try {
          const obj = JSON.parse(trimmed);
          // Surface mid-stream errors if present
          if (obj?.error) {
            hasError = true;
            throw new Error(typeof obj.error === 'string' ? obj.error : JSON.stringify(obj.error));
          }
          // Process content first before checking done flag
          if (obj?.message?.content) {
            textBuffer += obj.message.content;
            processTextBuffer();
          }
          // If Ollama signals completion, exit early
          if (obj?.done === true) {
            return fullText;
          }
        } catch (e) {
          if (hasError) throw e;
          loggerService.debug?.('[Ollama]', 'Skipping malformed NDJSON line:', trimmed);
        }
      }
    }

    // Flush remaining buffer
    const tailLine = buffer.trim();
    if (tailLine) {
      try {
        const obj = JSON.parse(tailLine);
        if (obj?.message?.content) {
          textBuffer += obj.message.content;
        }
      } catch (e) {
        /* ignore */
      }
    }
    // Final flush of text buffer
    processTextBuffer();

    return fullText;
  }

  async listModels(): Promise<ModelSetting[]> {
    try {
      // Derive base URL to call /api/tags
      const base = this._deriveApiBase(this.config.host || OLLAMA_DEFAULT_ORIGIN);
      const tagsUrl = `${base}${OLLAMA_PATH_TAGS}`;
      const res = await fetch(tagsUrl);
      if (!res.ok) {
        throw new Error(`Failed to fetch models: ${res.status}`);
      }
      const data = await res.json();
      const models = (data?.models || []) as Array<{
        name: string;
        details?: { family?: string; parameter_size?: string };
      }>;
      if (!Array.isArray(models)) return this.config.models || [];

      return models.map((m) => ({
        id: m.name,
        name: m.name,
        type: 'chat',
        capabilities: ['chat'],
        description: m.details?.family
          ? `Ollama ${m.details.family}${m.details.parameter_size ? ' ' + m.details.parameter_size : ''}`
          : 'Ollama local model',
      }));
    } catch (err) {
      loggerService.error('[Ollama]', 'Failed to list models:', err);
      return this.config.models || [];
    }
  }

  async initialize(config: BaseProviderConfig): Promise<void> {
    this.config = config;
  }

  private _buildChatUrl(host: string): string {
    const base = this._deriveApiBase(host);
    return `${base}${OLLAMA_PATH_CHAT}`;
  }

  private _deriveApiBase(host: string): string {
    // Accept host strings like:
    // - http://localhost:11434
    // - http://localhost:11434/api
    // - http://localhost:11434/api/chat
    try {
      const url = new URL(host);
      const parts = url.pathname.split('/').filter(Boolean);
      const apiIndex = parts.indexOf('api');
      const basePath = apiIndex >= 0 ? '/' + parts.slice(0, apiIndex + 1).join('/') : '/api';
      url.pathname = basePath.replace(/\/$/, ''); // Remove trailing slash for consistency
      return url.origin + url.pathname;
    } catch {
      // Fallback to default
      return `${OLLAMA_DEFAULT_ORIGIN}${OLLAMA_PATH_API}`;
    }
  }
}

export default OllamaProvider;
