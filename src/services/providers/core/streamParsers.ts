// Shared stream parsers for SSE and NDJSON formats.
// These are reusable building blocks — parameterized by a token extractor function.

import loggerService from '../../LoggerService';

/** Extract a token string from a parsed JSON chunk. Return null to skip. */
export type TokenExtractor = (data: any) => string | null;

/**
 * Parse an SSE (Server-Sent Events) stream.
 *
 * Works with both styles:
 * - OpenAI-style: single `data: {...}\n` lines per chunk
 * - Anthropic/Google-style: `data: {...}\n\n` event boundaries
 *
 * The parser buffers on newline boundaries so partial lines are correctly
 * reassembled across read() calls.
 *
 * Used by: OpenAI, Azure OpenAI, Anthropic, Google, DeepSeek, Qwen.
 */
export async function parseSSEStream(
  res: Response,
  extractToken: TokenExtractor,
  onToken?: (token: string) => void,
  logTag = 'SSE'
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

      // Split on newlines; keep the last (possibly incomplete) segment in buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const jsonStr = trimmed.replace(/^data: /, '').trim();
        if (jsonStr === '[DONE]') continue;

        try {
          const data = JSON.parse(jsonStr);
          const token = extractToken(data);
          if (token) {
            if (typeof onToken === 'function') onToken(token);
            fullText += token;
          }
        } catch (err) {
          loggerService.error(`[${logTag}]`, 'JSON parse error:', err, jsonStr);
        }
      }
    }
  }

  return fullText;
}

/**
 * Parse an NDJSON (newline-delimited JSON) stream.
 *
 * Each line is a standalone JSON object. Supports:
 * - Error detection via `extractError`
 * - Early termination via `isDone`
 * - Graceful handling of malformed lines
 *
 * Used by: Ollama.
 */
export async function parseNDJSONStream(
  res: Response,
  extractToken: TokenExtractor,
  onToken?: (token: string) => void,
  options?: {
    logTag?: string;
    extractError?: (data: any) => string | null;
    isDone?: (data: any) => boolean;
  }
): Promise<string> {
  const logTag = options?.logTag || 'NDJSON';
  const extractError = options?.extractError || (() => null);
  const isDone = options?.isDone || (() => false);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullText = '';
  let buffer = '';

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
        const errorMsg = extractError(obj);
        if (errorMsg) {
          hasError = true;
          throw new Error(errorMsg);
        }

        // Process content first before checking done flag
        const token = extractToken(obj);
        if (token) {
          if (typeof onToken === 'function') onToken(token);
          fullText += token;
        }

        // If the API signals completion, exit early
        if (isDone(obj)) {
          return fullText;
        }
      } catch (e) {
        if (hasError) throw e;
        loggerService.debug?.(`[${logTag}]`, 'Skipping malformed NDJSON line:', trimmed);
      }
    }
  }

  // Attempt to parse any remaining buffered JSON
  const tail = buffer.trim();
  if (tail) {
    try {
      const obj = JSON.parse(tail);
      const token = extractToken(obj);
      if (token) {
        if (typeof onToken === 'function') onToken(token);
        fullText += token;
      }
    } catch {
      // ignore
    }
  }

  return fullText;
}
