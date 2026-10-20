const SENSITIVE_KEY = /apiKey|api_key|authorization|password|secret/i;

export function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redactValue(val);
    }
    return out;
  }
  return value;
}

export function truncateDebugText(text: string, maxChars = 80): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars);
}
