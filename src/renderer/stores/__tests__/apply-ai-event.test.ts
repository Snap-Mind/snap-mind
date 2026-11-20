import { describe, expect, it } from 'vitest';
import type { Message } from '@/types/chat';
import { applyAiEvent, settleRunningParts } from '../apply-ai-event';
import type { AiStreamEvent } from '../apply-ai-event';

const ROOT = 'run-root';

function makeAssistant(content = ''): Message {
  return { role: 'assistant', content };
}

describe('applyAiEvent', () => {
  it('root tool-call after open think closes the think block', () => {
    const msgs: Message[] = [makeAssistant('<think>plan')];
    const result = applyAiEvent(msgs, ROOT, {
      kind: 'tool-call',
      e: {
        runId: ROOT,
        parentRunId: null,
        parentToolCallId: null,
        toolCallId: 'tc-agent',
        toolName: 'invoke_agent',
        input: { agentId: 1 },
      },
    });
    expect(result[0].content).toBe('<think>plan</think>');
    expect(result[1].parts![0].toolName).toBe('invoke_agent');
  });

  it('root tool-call after text pushes a new list item', () => {
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
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('hello');
    expect(result[1].parts).toHaveLength(1);
    expect(result[1].parts![0]).toMatchObject({
      type: 'tool',
      toolCallId: 'tc1',
      toolName: 'web_search',
      state: 'input-available',
    });
    expect(result[1].parts![0].subRun).toBeUndefined();
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
      thinking: '',
      text: '',
      status: 'running',
    });
  });

  it('child reasoning appends to subRun.thinking, not to text', () => {
    const msgs: Message[] = [
      {
        role: 'assistant',
        content: '',
        parts: [
          {
            type: 'tool',
            toolCallId: 'tc-agent',
            toolName: 'invoke_agent',
            input: { agentId: 1 },
            state: 'input-available',
            subRun: { runId: '', agentId: 1, thinking: '', text: '', status: 'running' },
          },
        ],
      },
    ];
    const ev: AiStreamEvent = {
      kind: 'reasoning',
      e: {
        runId: 'child-run',
        parentRunId: ROOT,
        parentToolCallId: 'tc-agent',
        text: 'let me think',
      },
    };
    const result = applyAiEvent(msgs, ROOT, ev);
    expect(result[0].parts![0].subRun!.thinking).toBe('let me think');
    expect(result[0].parts![0].subRun!.text).toBe('');
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
            subRun: { runId: '', agentId: 1, thinking: '', text: '', status: 'running' },
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
    expect(result[0].content).toBe('root text');
    expect(result[0].parts![0].subRun!.text).toBe('hello from child');
    expect(result[0].parts![0].subRun!.runId).toBe('child-run');
  });

  it('root token after a process item starts a new assistant row', () => {
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
            state: 'output-available',
            output: 'ok',
          },
        ],
      },
    ];
    const result = applyAiEvent(msgs, ROOT, {
      kind: 'token',
      e: { runId: ROOT, parentRunId: null, parentToolCallId: null, text: 'final' },
    });
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ role: 'assistant', content: 'final', runId: ROOT });
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
            subRun: {
              runId: 'child-run',
              agentId: 1,
              thinking: '',
              text: 'some text',
              status: 'running',
            },
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
            subRun: { runId: 'child-run', agentId: 1, thinking: '', text: '', status: 'running' },
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
  function invokePartMsg(): Message[] {
    return [
      {
        role: 'assistant',
        content: '',
        parts: [
          {
            type: 'tool',
            toolCallId: 'tc-agent',
            toolName: 'invoke_agent',
            input: { agentId: 7, prompt: 'p' },
            state: 'input-available',
            subRun: { runId: '', agentId: 7, thinking: '', text: '', status: 'running' },
          },
        ],
      },
    ];
  }

  function rootToolResult(
    isError: boolean,
    output: unknown,
    toolCallId = 'tc-agent'
  ): AiStreamEvent {
    return {
      kind: 'tool-result',
      e: {
        runId: ROOT,
        parentRunId: null,
        parentToolCallId: null,
        toolCallId,
        toolName: 'invoke_agent',
        output,
        isError,
      },
    };
  }

  it('root tool-result error settles running subRun to error', () => {
    const result = applyAiEvent(invokePartMsg(), ROOT, rootToolResult(true, 'Unknown agent 7'));
    const part = result[0].parts![0];
    expect(part.state).toBe('output-error');
    expect(part.subRun).toMatchObject({ status: 'error', error: 'Unknown agent 7' });
  });

  it('root tool-result success settles running subRun to done', () => {
    const result = applyAiEvent(invokePartMsg(), ROOT, rootToolResult(false, 'worker answer'));
    const part = result[0].parts![0];
    expect(part.state).toBe('output-available');
    expect(part.subRun!.status).toBe('done');
  });

  it('root tool-result does not overwrite an already-settled subRun', () => {
    const msgs = invokePartMsg();
    msgs[0].parts![0].subRun!.status = 'aborted';
    const result = applyAiEvent(msgs, ROOT, rootToolResult(true, 'Aborted'));
    expect(result[0].parts![0].subRun!.status).toBe('aborted');
  });

  it('child done aborted marks subRun aborted', () => {
    const ev: AiStreamEvent = {
      kind: 'done',
      e: {
        runId: 'child-run',
        parentRunId: ROOT,
        parentToolCallId: 'tc-agent',
        reason: 'aborted',
      },
    };
    const result = applyAiEvent(invokePartMsg(), ROOT, ev);
    expect(result[0].parts![0].subRun!.status).toBe('aborted');
  });

  it('approval-request before tool-call creates approval part and later tool-call keeps it', () => {
    const msgs: Message[] = [makeAssistant('')];
    const approval: AiStreamEvent = {
      kind: 'approval-request',
      e: {
        runId: ROOT,
        parentRunId: null,
        parentToolCallId: null,
        toolCallId: 'tc-agent',
        toolName: 'invoke_agent',
        input: { agentId: 3, prompt: 'go' },
        requestId: 'req-9',
      },
    };
    const afterApproval = applyAiEvent(msgs, ROOT, approval);
    expect(afterApproval[0].parts).toHaveLength(1);
    expect(afterApproval[0].parts![0]).toMatchObject({
      type: 'tool',
      toolCallId: 'tc-agent',
      toolName: 'invoke_agent',
      input: { agentId: 3, prompt: 'go' },
      state: 'approval-requested',
      requestId: 'req-9',
      subRun: { runId: '', agentId: 3, thinking: '', text: '', status: 'running' },
    });

    const call: AiStreamEvent = {
      kind: 'tool-call',
      e: {
        runId: ROOT,
        parentRunId: null,
        parentToolCallId: null,
        toolCallId: 'tc-agent',
        toolName: 'invoke_agent',
        input: { agentId: 3, prompt: 'go' },
      },
    };
    const afterCall = applyAiEvent(afterApproval, ROOT, call);
    expect(afterCall[0].parts).toHaveLength(1);
    expect(afterCall[0].parts![0]).toMatchObject({
      state: 'approval-requested',
      requestId: 'req-9',
      subRun: { agentId: 3, status: 'running' },
    });
  });

  it('tool-result before tool-call creates part with result state', () => {
    const msgs: Message[] = [makeAssistant('')];
    const ev: AiStreamEvent = {
      kind: 'tool-result',
      e: {
        runId: ROOT,
        parentRunId: null,
        parentToolCallId: null,
        toolCallId: 'tc-x',
        toolName: 'web_search',
        output: 'Denied by permission policy or user.',
        isError: true,
      },
    };
    const afterResult = applyAiEvent(msgs, ROOT, ev);
    expect(afterResult[0].parts).toHaveLength(1);
    expect(afterResult[0].parts![0]).toMatchObject({
      type: 'tool',
      toolCallId: 'tc-x',
      toolName: 'web_search',
      state: 'output-error',
      output: 'Denied by permission policy or user.',
    });

    const call: AiStreamEvent = {
      kind: 'tool-call',
      e: {
        runId: ROOT,
        parentRunId: null,
        parentToolCallId: null,
        toolCallId: 'tc-x',
        toolName: 'web_search',
        input: { query: 'q' },
      },
    };
    const afterCall = applyAiEvent(afterResult, ROOT, call);
    expect(afterCall[0].parts).toHaveLength(1);
    expect(afterCall[0].parts![0]).toMatchObject({
      state: 'output-error',
      input: { query: 'q' },
      output: 'Denied by permission policy or user.',
    });
  });

  it('invoke_agent tool-result before tool-call does not leave a running subRun', () => {
    const afterResult = applyAiEvent(
      [makeAssistant('')],
      ROOT,
      rootToolResult(true, 'Unknown agent 7', 'tc-late')
    );
    const call: AiStreamEvent = {
      kind: 'tool-call',
      e: {
        runId: ROOT,
        parentRunId: null,
        parentToolCallId: null,
        toolCallId: 'tc-late',
        toolName: 'invoke_agent',
        input: { agentId: 7 },
      },
    };
    const afterCall = applyAiEvent(afterResult, ROOT, call);
    expect(afterCall[0].parts![0].subRun).toMatchObject({
      agentId: 7,
      status: 'error',
      error: 'Unknown agent 7',
    });
  });

  it('settleRunningParts marks running subRun aborted and pending approval as output-error', () => {
    const msgs: Message[] = [
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: '',
        parts: [
          {
            type: 'tool',
            toolCallId: 'tc-agent',
            toolName: 'invoke_agent',
            input: { agentId: 7 },
            state: 'input-available',
            subRun: { runId: 'c1', agentId: 7, thinking: '', text: 'partial', status: 'running' },
          },
          {
            type: 'tool',
            toolCallId: 'tc-2',
            toolName: 'invoke_agent',
            input: { agentId: 8 },
            state: 'approval-requested',
            requestId: 'req-2',
            subRun: { runId: '', agentId: 8, thinking: '', text: '', status: 'running' },
          },
          {
            type: 'tool',
            toolCallId: 'tc-3',
            toolName: 'web_search',
            input: {},
            state: 'output-available',
            output: 'ok',
          },
        ],
      },
    ];
    const result = settleRunningParts(msgs);
    const parts = result[1].parts!;
    expect(parts[0].subRun!.status).toBe('aborted');
    expect(parts[0].subRun!.text).toBe('partial');
    expect(parts[1].state).toBe('output-error');
    expect(parts[1].output).toBe('Run ended before approval.');
    expect(parts[1].subRun!.status).toBe('aborted');
    expect(parts[2]).toBe(msgs[1].parts![2]);
    expect(result[0]).toBe(msgs[0]);
  });

  it('settleRunningParts returns the same reference when nothing is pending', () => {
    const msgs: Message[] = [{ role: 'user', content: 'hi' }, makeAssistant('done')];
    expect(settleRunningParts(msgs)).toBe(msgs);
  });
});
