import { describe, expect, it, vi } from 'vitest';
import { AiSdkRuntime } from '../ai-sdk-runtime.js';
import type { StreamRequest, RuntimeTool } from '../types.js';

function makeAbortController() {
  return new AbortController();
}

function makeFakeStreamText(parts: unknown[]) {
  return vi.fn(() => ({
    stream: (async function* () {
      yield* parts;
    })(),
  }));
}

function makeCreateLanguageModel() {
  return vi.fn(() => ({ _tag: 'mock-model' }));
}

function makeRequest(overrides: Partial<StreamRequest> = {}): StreamRequest {
  const { signal } = makeAbortController();
  return {
    model: {
      provider: {
        kind: 'openai',
        apiKey: 'sk-test',
        host: 'https://api.openai.com',
        apiVersion: null,
      },
      modelId: 'gpt-4o',
    },
    params: { temperature: 0.7, maxOutputTokens: 2048, topP: 0.95, reasoning: false },
    messages: [{ role: 'user', content: 'hello' }],
    instructions: 'be helpful',
    tools: [],
    maxSteps: 5,
    abortSignal: signal,
    ...overrides,
  };
}

function makeTool(name: string): RuntimeTool {
  return {
    name,
    description: `Tool ${name}`,
    inputSchema: { type: 'object', properties: { a: { type: 'number' } } },
    execute: vi.fn().mockResolvedValue({ result: 42 }),
  };
}

function firstCallOpts(streamText: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const calls = streamText.mock.calls as unknown as unknown[][];
  return calls[0][0] as Record<string, unknown>;
}

async function collectEvents(runtime: AiSdkRuntime, req: StreamRequest) {
  const events = [];
  for await (const event of runtime.stream(req)) {
    events.push(event);
  }
  return events;
}

describe('AiSdkRuntime', () => {
  it('maps text, reasoning and source parts', async () => {
    const parts = [
      { type: 'text-delta', text: 'hi' },
      { type: 'reasoning-delta', text: 'r' },
      { type: 'source', url: 'https://example.com', title: 'Example' },
      { type: 'finish', finishReason: 'stop' },
    ];
    const streamText = makeFakeStreamText(parts);
    const runtime = new AiSdkRuntime({
      streamText,
      createLanguageModel: makeCreateLanguageModel() as never,
    });
    const events = await collectEvents(runtime, makeRequest());

    expect(events).toContainEqual({ type: 'text-delta', text: 'hi' });
    expect(events).toContainEqual({ type: 'reasoning-delta', text: 'r' });
    expect(events).toContainEqual({ type: 'source', url: 'https://example.com', title: 'Example' });
    expect(events[events.length - 1]).toEqual({ type: 'done', reason: 'stop' });
  });

  it('empty tools omits tools, stopWhen and toolApproval', async () => {
    const streamText = makeFakeStreamText([]);
    const runtime = new AiSdkRuntime({
      streamText,
      createLanguageModel: makeCreateLanguageModel() as never,
    });
    await collectEvents(runtime, makeRequest({ tools: [] }));

    const opts = firstCallOpts(streamText);
    expect(opts).not.toHaveProperty('tools');
    expect(opts).not.toHaveProperty('stopWhen');
    expect(opts).not.toHaveProperty('toolApproval');
    expect(opts).not.toHaveProperty('toolCallConcurrency');
  });

  it('non-empty tools runs tool calls one at a time (toolCallConcurrency 1)', async () => {
    const streamText = makeFakeStreamText([]);
    const runtime = new AiSdkRuntime({
      streamText,
      createLanguageModel: makeCreateLanguageModel() as never,
    });
    await collectEvents(runtime, makeRequest({ tools: [makeTool('t1')] }));

    const opts = firstCallOpts(streamText);
    expect(opts.toolCallConcurrency).toBe(1);
  });

  it('non-empty tools passes tools record, stopWhen and toolApproval', async () => {
    const tool1 = makeTool('t1');
    const streamText = makeFakeStreamText([]);
    const abortController = makeAbortController();
    const onApprove = vi.fn().mockResolvedValue('allow');
    const runtime = new AiSdkRuntime({
      streamText,
      createLanguageModel: makeCreateLanguageModel() as never,
    });
    await collectEvents(
      runtime,
      makeRequest({ tools: [tool1], abortSignal: abortController.signal, onApprove })
    );

    const opts = firstCallOpts(streamText);
    expect(opts).toHaveProperty('tools');
    expect(opts).toHaveProperty('stopWhen');
    expect(opts).toHaveProperty('toolApproval');

    // Keys equal tool names
    const tools = opts.tools as Record<
      string,
      {
        execute: (
          _input: unknown,
          _options: { toolCallId: string; abortSignal?: AbortSignal }
        ) => Promise<unknown>;
      }
    >;
    expect(Object.keys(tools)).toEqual(['t1']);

    // Calling the SDK tool's execute calls the RuntimeTool execute
    const abortSignal = abortController.signal;
    await tools['t1'].execute({ a: 1 }, { toolCallId: 'c', abortSignal });
    expect(tool1.execute).toHaveBeenCalledWith({ a: 1 }, { toolCallId: 'c', abortSignal });
  });

  it('toolApproval returns approved/denied from onApprove', async () => {
    const tool1 = makeTool('t1');
    const streamText = makeFakeStreamText([]);
    const onApproveAllow = vi.fn().mockResolvedValue('allow');
    const onApproveDeny = vi.fn().mockResolvedValue('deny');

    // Test allow
    const runtime1 = new AiSdkRuntime({
      streamText,
      createLanguageModel: makeCreateLanguageModel() as never,
    });
    await collectEvents(runtime1, makeRequest({ tools: [tool1], onApprove: onApproveAllow }));
    const opts1 = firstCallOpts(streamText);
    const approval1 = opts1.toolApproval as (_args: {
      toolCall: { toolCallId: string; toolName: string; input: unknown };
    }) => Promise<string>;
    const result1 = await approval1({ toolCall: { toolCallId: 'c', toolName: 't1', input: {} } });
    expect(result1).toBe('approved');

    // Test deny
    streamText.mockClear();
    const runtime2 = new AiSdkRuntime({
      streamText,
      createLanguageModel: makeCreateLanguageModel() as never,
    });
    await collectEvents(runtime2, makeRequest({ tools: [tool1], onApprove: onApproveDeny }));
    const opts2 = firstCallOpts(streamText);
    const approval2 = opts2.toolApproval as (_args: {
      toolCall: { toolCallId: string; toolName: string; input: unknown };
    }) => Promise<string>;
    const result2 = await approval2({ toolCall: { toolCallId: 'c', toolName: 't1', input: {} } });
    expect(result2).toBe('denied');
  });

  it('maps tool-call, tool-result, tool-error and tool-output-denied', async () => {
    const parts = [
      { type: 'tool-call', toolCallId: 'c1', toolName: 't1', input: { a: 1 } },
      { type: 'tool-result', toolCallId: 'c1', toolName: 't1', output: { result: 42 } },
      { type: 'tool-error', toolCallId: 'c2', toolName: 't1', error: new Error('boom') },
      { type: 'tool-output-denied', toolCallId: 'c3', toolName: 't1' },
    ];
    const streamText = makeFakeStreamText(parts);
    const runtime = new AiSdkRuntime({
      streamText,
      createLanguageModel: makeCreateLanguageModel() as never,
    });
    const events = await collectEvents(runtime, makeRequest());

    expect(events).toContainEqual({
      type: 'tool-call',
      toolCallId: 'c1',
      toolName: 't1',
      input: { a: 1 },
    });
    expect(events).toContainEqual({
      type: 'tool-result',
      toolCallId: 'c1',
      toolName: 't1',
      output: { result: 42 },
      isError: false,
    });

    const toolError = events.find(
      (e) => e.type === 'tool-result' && (e as { toolCallId: string }).toolCallId === 'c2'
    );
    expect(toolError).toBeDefined();
    expect((toolError as { isError: boolean }).isError).toBe(true);
    expect(typeof (toolError as { output: unknown }).output).toBe('string');

    const denied = events.find(
      (e) => e.type === 'tool-result' && (e as { toolCallId: string }).toolCallId === 'c3'
    );
    expect(denied).toBeDefined();
    expect((denied as { isError: boolean }).isError).toBe(true);
    expect((denied as { output: unknown }).output).toBe('Denied by permission policy or user.');
  });

  it('error part yields error with describeAiError and stops', async () => {
    const parts = [
      { type: 'error', error: Object.assign(new Error('provider fail'), { statusCode: 500 }) },
      { type: 'text-delta', text: 'should not appear' },
    ];
    const streamText = makeFakeStreamText(parts);
    const runtime = new AiSdkRuntime({
      streamText,
      createLanguageModel: makeCreateLanguageModel() as never,
    });
    const events = await collectEvents(runtime, makeRequest());

    expect(events[0]).toEqual({ type: 'error', message: 'HTTP 500: provider fail' });
    expect(events).toHaveLength(1);
  });

  it('abort part yields done aborted', async () => {
    const parts = [
      { type: 'abort', reason: 'user' },
      { type: 'text-delta', text: 'should not appear' },
    ];
    const streamText = makeFakeStreamText(parts);
    const runtime = new AiSdkRuntime({
      streamText,
      createLanguageModel: makeCreateLanguageModel() as never,
    });
    const events = await collectEvents(runtime, makeRequest());

    expect(events[0]).toEqual({ type: 'done', reason: 'aborted' });
    expect(events).toHaveLength(1);
  });

  it('thrown error after abort yields done aborted', async () => {
    const abortController = makeAbortController();
    async function* fakeStream() {
      yield { type: 'text-delta', text: 'partial' };
      abortController.abort();
      throw new DOMException('aborted', 'AbortError');
    }
    const streamText = vi.fn(() => ({ stream: fakeStream() }));
    const runtime = new AiSdkRuntime({
      streamText,
      createLanguageModel: makeCreateLanguageModel() as never,
    });
    const events = await collectEvents(
      runtime,
      makeRequest({ abortSignal: abortController.signal })
    );

    const last = events[events.length - 1];
    expect(last).toEqual({ type: 'done', reason: 'aborted' });
  });

  it('thrown error otherwise yields error', async () => {
    async function* fakeStream() {
      yield { type: 'text-delta', text: 'partial' };
      throw new Error('network failure');
    }
    const streamText = vi.fn(() => ({ stream: fakeStream() }));
    const runtime = new AiSdkRuntime({
      streamText,
      createLanguageModel: makeCreateLanguageModel() as never,
    });
    const events = await collectEvents(runtime, makeRequest());

    const last = events[events.length - 1];
    expect(last).toEqual({ type: 'error', message: 'network failure' });
  });

  it("createLanguageModel throwing yields error 'Unknown provider kind: x'", async () => {
    const streamText = makeFakeStreamText([]);
    const createLanguageModel = vi.fn(() => {
      throw new Error('Unknown provider kind: x');
    });
    const runtime = new AiSdkRuntime({
      streamText,
      createLanguageModel: createLanguageModel as never,
    });
    const events = await collectEvents(
      runtime,
      makeRequest({
        model: {
          provider: { kind: 'x', apiKey: null, host: '', apiVersion: null },
          modelId: 'foo',
        },
      })
    );

    expect(events).toEqual([{ type: 'error', message: 'Unknown provider kind: x' }]);
  });

  it('passes params, instructions, abortSignal and mapped messages', async () => {
    const streamText = makeFakeStreamText([]);
    const runtime = new AiSdkRuntime({
      streamText,
      createLanguageModel: makeCreateLanguageModel() as never,
    });
    const abortController = makeAbortController();
    const req = makeRequest({
      abortSignal: abortController.signal,
      messages: [
        { role: 'system', content: 'system msg' },
        { role: 'user', content: 'hello' },
        { role: 'error', content: 'err' },
      ],
      instructions: 'be helpful',
      params: { temperature: 0.5, maxOutputTokens: 1024, topP: 0.9, reasoning: true },
    });
    await collectEvents(runtime, req);

    const opts = firstCallOpts(streamText);
    expect(opts.temperature).toBe(0.5);
    expect(opts.maxOutputTokens).toBe(1024);
    expect(opts.topP).toBe(0.9);
    expect(opts.reasoning).toBe('medium');
    expect(opts.instructions).toBe('be helpful');
    expect(opts.abortSignal).toBe(abortController.signal);
    // system and error messages dropped
    expect(opts.messages).toEqual([{ role: 'user', content: 'hello' }]);
  });
});
