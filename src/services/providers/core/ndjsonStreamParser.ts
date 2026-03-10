// NDJSON (newline-delimited JSON) stream parser.
// Used by: Ollama.

import loggerService from '../../LoggerService';

/** Extract a token string from a parsed JSON chunk. Return null to skip. */
export type TokenExtractor = (data: any) => string | null;

/**
 * Parse an NDJSON (newline-delimited JSON) stream.
 *
 * Each line is a standalone JSON object. Supports:
 * - Error detection via `extractError`
 * - Early termination via `isDone`
 * - Graceful handling of malformed lines
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
