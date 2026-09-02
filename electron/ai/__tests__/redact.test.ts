import { describe, expect, it } from 'vitest';
import { redactValue, truncateDebugText } from '../redact.js';

describe('redactValue', () => {
  it('strips apiKey and Authorization', () => {
    const out = redactValue({
      apiKey: 'sk-secret',
      headers: { Authorization: 'Bearer sk-secret' },
      kind: 'openai',
    }) as Record<string, unknown>;
    expect(out.apiKey).toBe('[redacted]');
    expect((out.headers as Record<string, unknown>).Authorization).toBe('[redacted]');
    expect(out.kind).toBe('openai');
  });
});

describe('truncateDebugText', () => {
  it('truncates long token text', () => {
    expect(truncateDebugText('a'.repeat(100), 80).length).toBe(80);
  });
});
