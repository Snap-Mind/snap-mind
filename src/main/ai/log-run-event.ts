import type { RunEvent, RunRef } from './runtime/types.js';
import { redactValue, truncateDebugText } from './redact.js';

export function summarizeRunEvent(ref: RunRef, event: RunEvent): unknown {
  const base = {
    runId: ref.runId,
    parentRunId: ref.parentRunId,
    parentToolCallId: ref.parentToolCallId,
    type: event.type,
  };

  switch (event.type) {
    case 'text-delta':
    case 'reasoning-delta':
      return redactValue({
        ...base,
        chars: event.text.length,
        preview: truncateDebugText(event.text),
      });
    case 'source':
      return redactValue({ ...base, url: event.url, title: event.title });
    case 'tool-call':
      return redactValue({
        ...base,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        input: event.input,
      });
    case 'approval-request':
      return redactValue({
        ...base,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        requestId: event.requestId,
      });
    case 'tool-result':
      return redactValue({
        ...base,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        isError: event.isError,
        output:
          typeof event.output === 'string' ? truncateDebugText(event.output, 200) : event.output,
      });
    case 'done':
      return redactValue({ ...base, reason: event.reason });
    case 'error':
      return redactValue({ ...base, message: event.message });
  }
}
