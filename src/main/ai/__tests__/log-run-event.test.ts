import { describe, expect, it } from 'vitest';
import { summarizeRunEvent } from '../log-run-event.js';

const ref = { runId: 'r1', parentRunId: null, parentToolCallId: null };

describe('summarizeRunEvent', () => {
  it('records text-delta length and preview without dumping the full body', () => {
    const summary = summarizeRunEvent(ref, {
      type: 'text-delta',
      text: 'a'.repeat(120),
    }) as Record<string, unknown>;
    expect(summary.type).toBe('text-delta');
    expect(summary.chars).toBe(120);
    expect(String(summary.preview).length).toBeLessThan(120);
  });

  it('redacts apiKey fields on tool-call input', () => {
    const summary = summarizeRunEvent(ref, {
      type: 'tool-call',
      toolCallId: 'tc1',
      toolName: 'invoke_agent',
      input: { agentId: 2, apiKey: 'sk-secret' },
    }) as Record<string, unknown>;
    expect(summary.toolName).toBe('invoke_agent');
    expect((summary.input as Record<string, unknown>).apiKey).toBe('[redacted]');
  });
});
