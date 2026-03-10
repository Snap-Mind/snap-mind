// SSE (Server-Sent Events) stream parser.
// Used by: OpenAI, Azure OpenAI, Anthropic, Google, DeepSeek, Qwen.

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
