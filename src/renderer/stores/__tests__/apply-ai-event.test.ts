import { describe, expect, it } from 'vitest';
import type { Message } from '@/types/chat';
import { applyAiEvent } from '../apply-ai-event';
import type { AiStreamEvent } from '../apply-ai-event';

const ROOT = 'run-root';

function makeAssistant(content = ''): Message {
  return { role: 'assistant', content };
}

describe('applyAiEvent', () => {
  it('root tool-call appends input-available part to last assistant', () => {
    const msgs: Message[] = [makeAssistant('hello')];
    const ev: AiStreamEvent = {
      kind: 'tool-call',
      e: {
        runId: ROOT,
        parentRunId: null,
        parentToolCallId: null,
        toolCallId: 'tc1',
        toolName: 'web_search',
        input: { query: 'foo' },
      },
    };
    const result = applyAiEvent(msgs, ROOT, ev);
    expect(result).not.toBe(msgs);
    expect(result[0].parts).toHaveLength(1);
    expect(result[0].parts![0]).toMatchObject({
      type: 'tool',
      toolCallId: 'tc1',
      toolName: 'web_search',
      state: 'input-available',
    });
    expect(result[0].parts![0].subRun).toBeUndefined();
  });

  it('approval-request sets state approval-requested and requestId', () => {
    const msgs: Message[] = [
      {
        role: 'assistant',
        content: '',
        parts: [
          {
            type: 'tool',
            toolCallId: 'tc1',
            toolName: 'web_search',
            input: {},
            state: 'input-available',
          },
        ],
      },
    ];
    const ev: AiStreamEvent = {
      kind: 'approval-request',
      e: {
        runId: ROOT,
        parentRunId: null,
        parentToolCallId: null,
        toolCallId: 'tc1',
        toolName: 'web_search',
        input: {},
        requestId: 'req1',
      },
    };
    const result = applyAiEvent(msgs, ROOT, ev);
    expect(result[0].parts![0].state).toBe('approval-requested');
    expect(result[0].parts![0].requestId).toBe('req1');
  });

  it('tool-result sets output-available or output-error', () => {
    const msgs: Message[] = [
      {
        role: 'assistant',
        content: '',
        parts: [
          {
            type: 'tool',
            toolCallId: 'tc1',
            toolName: 'web_search',
            input: {},
            state: 'approval-requested',
          },
        ],
      },
    ];

    const evOk: AiStreamEvent = {
      kind: 'tool-result',
      e: {
        runId: ROOT,
        parentRunId: null,
        parentToolCallId: null,
        toolCallId: 'tc1',
        toolName: 'web_search',
        output: { data: 'result' },
        isError: false,
      },
    };
    const result = applyAiEvent(msgs, ROOT, evOk);
    expect(result[0].parts![0].state).toBe('output-available');
    expect(result[0].parts![0].output).toEqual({ data: 'result' });

    const evErr: AiStreamEvent = {
      kind: 'tool-result',
      e: {
        runId: ROOT,
        parentRunId: null,
        parentToolCallId: null,
        toolCallId: 'tc1',
        toolName: 'web_search',
        output: 'error msg',
        isError: true,
      },
    };
    const result2 = applyAiEvent(msgs, ROOT, evErr);
    expect(result2[0].parts![0].state).toBe('output-error');
  });

  it('invoke_agent tool-call creates running subRun', () => {
    const msgs: Message[] = [makeAssistant('')];
    const ev: AiStreamEvent = {
      kind: 'tool-call',
      e: {
        runId: ROOT,
        parentRunId: null,
        parentToolCallId: null,
        toolCallId: 'tc-agent',
        toolName: 'invoke_agent',
        input: { agentId: 42 },
      },
    };
    const result = applyAiEvent(msgs, ROOT, ev);
    const part = result[0].parts![0];
    expect(part.subRun).toBeDefined();
    expect(part.subRun).toMatchObject({
      runId: '',
      agentId: 42,
      text: '',
      status: 'running',
    });
  });

  it('child token appends to subRun.text, not to content', () => {
    const msgs: Message[] = [
      {
        role: 'assistant',
        content: 'root text',
        parts: [
          {
            type: 'tool',
            toolCallId: 'tc-agent',
            toolName: 'invoke_agent',
            input: { agentId: 1 },
            state: 'input-available',
            subRun: { runId: '', agentId: 1, text: '', status: 'running' },
          },
        ],
      },
    ];
    const ev: AiStreamEvent = {
      kind: 'token',
      e: {
        runId: 'child-run',
        parentRunId: ROOT,
        parentToolCallId: 'tc-agent',
        text: 'hello from child',
      },
    };
    const result = applyAiEvent(msgs, ROOT, ev);
    expect(result[0].content).toBe('root text'); // unchanged
    expect(result[0].parts![0].subRun!.text).toBe('hello from child');
    expect(result[0].parts![0].subRun!.runId).toBe('child-run');
  });

  it('child done marks subRun done', () => {
    const msgs: Message[] = [
      {
        role: 'assistant',
        content: '',
        parts: [
          {
            type: 'tool',
            toolCallId: 'tc-agent',
            toolName: 'invoke_agent',
            input: {},
            state: 'input-available',
            subRun: { runId: 'child-run', agentId: 1, text: 'some text', status: 'running' },
          },
        ],
      },
    ];
    const ev: AiStreamEvent = {
      kind: 'done',
      e: {
        runId: 'child-run',
        parentRunId: ROOT,
        parentToolCallId: 'tc-agent',
        reason: 'stop',
      },
    };
    const result = applyAiEvent(msgs, ROOT, ev);
    expect(result[0].parts![0].subRun!.status).toBe('done');
  });

  it('child error marks subRun error with error message', () => {
    const msgs: Message[] = [
      {
        role: 'assistant',
        content: '',
        parts: [
          {
            type: 'tool',
            toolCallId: 'tc-agent',
            toolName: 'invoke_agent',
            input: {},
            state: 'input-available',
            subRun: { runId: 'child-run', agentId: 1, text: '', status: 'running' },
          },
        ],
      },
    ];
    const ev: AiStreamEvent = {
      kind: 'error',
      e: {
        runId: 'child-run',
        parentRunId: ROOT,
        parentToolCallId: 'tc-agent',
        message: 'rate limit exceeded',
      },
    };
    const result = applyAiEvent(msgs, ROOT, ev);
    expect(result[0].parts![0].subRun!.status).toBe('error');
    expect(result[0].parts![0].subRun!.error).toBe('rate limit exceeded');
  });

  it('ignores events from stale runs', () => {
    const msgs: Message[] = [makeAssistant('text')];
    const ev: AiStreamEvent = {
      kind: 'token',
      e: {
        runId: 'stale-run',
        parentRunId: 'also-stale',
        parentToolCallId: null,
        text: 'stale',
      },
    };
    const result = applyAiEvent(msgs, ROOT, ev);
    expect(result).toBe(msgs); // same reference
  });
});
