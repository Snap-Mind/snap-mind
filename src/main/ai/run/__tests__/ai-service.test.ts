import { describe, it, expect, vi } from 'vitest';
import type { ModelRuntime } from '../../runtime/model-runtime.js';
import type { RunEvent, StreamRequest, RunRef } from '../../runtime/types.js';
import { ToolRegistry } from '../../tools/registry.js';
import type { AgentDTO } from '../../../../shared/agent-dto.js';
import type { ProviderDTO } from '../../../../shared/provider-dto.js';
import { AIService } from '../ai-service.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeProvider(overrides: Partial<ProviderDTO> = {}): ProviderDTO {
  return {
    id: 10,
    kind: 'openai',
    name: 'OpenAI',
    host: null,
    apiKey: 'sk-test',
    description: null,
    models: [
      {
        id: 100,
        modelId: 'gpt-4o',
        name: 'GPT-4o',
        type: null,
        capabilities: [],
        description: null,
      },
    ],
    ...overrides,
  };
}

function makeAgent(overrides: Partial<AgentDTO> = {}): AgentDTO {
  return {
    id: 1,
    name: 'Default',
    description: null,
    instructions: 'Be helpful.',
    providerId: 10,
    modelId: 100,
    temperature: 0.7,
    maxTokens: 1000,
    topP: 0.95,
    reasoning: false,
    webSearch: false,
    isBuiltin: true,
    ...overrides,
  };
}

function makeService(
  agents: AgentDTO[],
  providers: ProviderDTO[],
  runtime: ModelRuntime,
  registry?: ToolRegistry
) {
  const agentsService = { list: vi.fn(async () => agents) };
  const providersService = { list: vi.fn(async () => providers) };
  const svc = new AIService(agentsService as never, providersService as never, {
    runtime,
    registry: registry ?? new ToolRegistry(),
  });
  return svc;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AIService (AgentRun-backed)', () => {
  it('resolve failure returns error code and starts nothing', async () => {
    // Agent with no api key
    const provider = makeProvider({ apiKey: null });
    const agent = makeAgent({ id: 1, isBuiltin: true });
    const streamSpy = vi.fn();
    const runtime: ModelRuntime = { stream: streamSpy as never };

    const svc = makeService([agent], [provider], runtime);
    const onEvent = vi.fn();

    const result = await svc.send(
      { agentId: 1, messages: [{ role: 'user', content: 'hi' }] },
      onEvent
    );

    expect(result).toEqual({
      error: expect.objectContaining({ code: 'no-api-key' }),
    });
    expect(streamSpy).not.toHaveBeenCalled();
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('returns runId before the first event', async () => {
    const agent = makeAgent();
    const provider = makeProvider();

    const runtime: ModelRuntime = {
      stream(): AsyncIterable<RunEvent> {
        return (async function* () {
          yield { type: 'done', reason: 'stop' } as RunEvent;
        })();
      },
    };

    const svc = makeService([agent], [provider], runtime);
    const onEvent = vi.fn();

    const result = await svc.send(
      { agentId: 1, messages: [{ role: 'user', content: 'hi' }] },
      onEvent
    );

    expect(result).toHaveProperty('streamId');
    expect(typeof (result as { streamId: string }).streamId).toBe('string');

    // Drain all pending microtasks. AgentRun is deferred via setImmediate (not a microtask),
    // so onEvent must NOT have fired yet — even after exhausting the entire microtask queue.
    for (let i = 0; i < 20; i++) await Promise.resolve();
    expect(onEvent).not.toHaveBeenCalled();

    // Now flush the setImmediate queue, then drain follow-on microtasks from AgentRun's for-await.
    await new Promise<void>((r) => setImmediate(r));
    for (let i = 0; i < 20; i++) await Promise.resolve();

    // AgentRun should have streamed and fired the done event.
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ runId: expect.any(String) }),
      expect.objectContaining({ type: 'done' })
    );
  });

  it('send aborts every open run', async () => {
    const agent = makeAgent();
    const provider = makeProvider();

    let firstSignal: AbortSignal | undefined;

    const runtime: ModelRuntime = {
      stream(req: StreamRequest): AsyncIterable<RunEvent> {
        return (async function* () {
          firstSignal ??= req.abortSignal;
          // Block until aborted
          await new Promise<void>((r) =>
            req.abortSignal.addEventListener('abort', () => r(), { once: true })
          );
          yield { type: 'done', reason: 'aborted' } as RunEvent;
        })();
      },
    };

    const svc = makeService([agent], [provider], runtime);

    const result1 = await svc.send(
      { agentId: 1, messages: [{ role: 'user', content: 'first' }] },
      vi.fn()
    );

    // Flush so first run starts
    await new Promise<void>((r) => setImmediate(r));
    await vi.waitFor(() => expect(firstSignal).toBeDefined());

    // Second send aborts every open run
    await svc.send({ agentId: 1, messages: [{ role: 'user', content: 'second' }] }, vi.fn());

    expect(result1).toHaveProperty('streamId');
    expect(firstSignal!.aborted).toBe(true);
  });

  it('abort(rootId) aborts active child', async () => {
    const controllerAgent = makeAgent({ id: 1, isBuiltin: true });
    const workerA = makeAgent({
      id: 2,
      name: 'Worker A',
      isBuiltin: false,
      modelId: 101,
      instructions: 'Worker A',
    });
    const provider = makeProvider({
      models: [
        {
          id: 100,
          modelId: 'root-model',
          name: 'Root',
          type: null,
          capabilities: [],
          description: null,
        },
        {
          id: 101,
          modelId: 'model-a',
          name: 'Model A',
          type: null,
          capabilities: [],
          description: null,
        },
      ],
    });

    let childSignal: AbortSignal | undefined;
    let resolveChildReady: () => void;
    const childReady = new Promise<void>((r) => {
      resolveChildReady = r;
    });

    const runtime: ModelRuntime = {
      stream(req: StreamRequest): AsyncIterable<RunEvent> {
        return (async function* () {
          if (req.tools.some((t) => t.name === 'invoke_agent')) {
            // Root controller — start child (do not await, let it run concurrently)
            const tool = req.tools.find((t) => t.name === 'invoke_agent')!;
            const childProm = tool.execute(
              { agentId: 2, prompt: 'go' },
              { toolCallId: 't1', abortSignal: req.abortSignal }
            );
            // Wait for child to absorb signal
            await childReady;
            void childProm.catch(() => {});
            // Block until root is aborted
            await new Promise<void>((r) =>
              req.abortSignal.addEventListener('abort', () => r(), { once: true })
            );
            yield { type: 'done', reason: 'aborted' } as RunEvent;
          } else {
            // Child run — expose signal
            childSignal = req.abortSignal;
            resolveChildReady!();
            await new Promise<void>((r) =>
              req.abortSignal.addEventListener('abort', () => r(), { once: true })
            );
            yield { type: 'done', reason: 'aborted' } as RunEvent;
          }
        })();
      },
    };

    const svc = makeService([controllerAgent, workerA], [provider], runtime);

    const result = await svc.send(
      { agentId: 1, messages: [{ role: 'user', content: 'run' }], loopEnabled: true },
      vi.fn()
    );
    expect(result).toHaveProperty('streamId');
    const rootId = (result as { streamId: string }).streamId;

    await new Promise<void>((r) => setImmediate(r));

    // Wait until child is running
    await childReady;

    expect(childSignal).toBeDefined();
    expect(childSignal!.aborted).toBe(false);

    // Abort root → should cascade to child
    svc.abort(rootId);

    expect(childSignal!.aborted).toBe(true);
  });

  it('abort(childId) leaves root running', async () => {
    const controllerAgent = makeAgent({ id: 1, isBuiltin: true });
    const workerA = makeAgent({
      id: 2,
      name: 'Worker A',
      isBuiltin: false,
      modelId: 101,
      instructions: 'Worker A',
    });
    const provider = makeProvider({
      models: [
        {
          id: 100,
          modelId: 'root-model',
          name: 'Root',
          type: null,
          capabilities: [],
          description: null,
        },
        {
          id: 101,
          modelId: 'model-a',
          name: 'Model A',
          type: null,
          capabilities: [],
          description: null,
        },
      ],
    });

    let rootSignal: AbortSignal | undefined;
    let childSignal: AbortSignal | undefined;
    let childRunId: string | undefined;

    // Resolves once the child's onEvent fires (meaning childRunId is captured)
    let resolveChildEventFired: () => void;
    const childEventFired = new Promise<void>((r) => {
      resolveChildEventFired = r;
    });

    const runtime: ModelRuntime = {
      stream(req: StreamRequest): AsyncIterable<RunEvent> {
        return (async function* () {
          if (req.tools.some((t) => t.name === 'invoke_agent')) {
            // Root controller
            rootSignal = req.abortSignal;
            const tool = req.tools.find((t) => t.name === 'invoke_agent')!;
            const childProm = tool.execute(
              { agentId: 2, prompt: 'go' },
              { toolCallId: 't1', abortSignal: req.abortSignal }
            );
            void childProm.catch(() => {});
            // Block until root is aborted (via second send abortAll)
            await new Promise<void>((r) =>
              req.abortSignal.addEventListener('abort', () => r(), { once: true })
            );
            yield { type: 'done', reason: 'aborted' } as RunEvent;
          } else {
            childSignal = req.abortSignal;
            // Yield one event so AgentRun fires onEvent for the child → captures childRunId
            yield { type: 'text-delta', text: 'working' } as RunEvent;
            // Block until child is aborted
            await new Promise<void>((r) =>
              req.abortSignal.addEventListener('abort', () => r(), { once: true })
            );
            yield { type: 'done', reason: 'aborted' } as RunEvent;
          }
        })();
      },
    };

    // Capture childRunId from onEvent for the child run
    const svc = makeService([controllerAgent, workerA], [provider], runtime);
    const onEvent = vi.fn((ref: RunRef) => {
      if (ref.parentRunId !== null && childRunId === undefined) {
        childRunId = ref.runId;
        resolveChildEventFired!();
      }
    });

    await svc.send(
      { agentId: 1, messages: [{ role: 'user', content: 'run' }], loopEnabled: true },
      onEvent
    );

    await new Promise<void>((r) => setImmediate(r));

    // Wait until the child's first event fires (guarantees childRunId and childSignal are set)
    await childEventFired;

    expect(childSignal).toBeDefined();
    expect(rootSignal).toBeDefined();
    expect(childRunId).toBeDefined();

    // Abort child — root should still be running
    svc.abort(childRunId!);

    expect(rootSignal!.aborted).toBe(false);
    expect(childSignal!.aborted).toBe(true);

    // Clean up: trigger root abort via second send (abortAll)
    await svc.send({ agentId: 1, messages: [] }, vi.fn());
  });

  it('respondApproval resolves a pending broker request', async () => {
    const agent = makeAgent();
    const provider = makeProvider();

    const registry = new ToolRegistry();
    registry.register({
      name: 'moderate_tool',
      description: 'A moderate-risk tool',
      inputSchema: { type: 'object', properties: {}, required: [] },
      risk: 'moderate',
      execute: async () => 'tool-result',
    });

    let capturedDecision: 'allow' | 'deny' | undefined;

    const runtime: ModelRuntime = {
      stream(req: StreamRequest): AsyncIterable<RunEvent> {
        return (async function* () {
          if (req.onApprove) {
            capturedDecision = await req.onApprove({
              toolCallId: 'tc-1',
              toolName: 'moderate_tool',
              input: {},
            });
          }
          yield { type: 'done', reason: 'stop' } as RunEvent;
        })();
      },
    };

    const svc = makeService([agent], [provider], runtime, registry);

    let capturedRequestId: string | undefined;
    const onEvent = vi.fn((_ref: RunRef, ev: RunEvent) => {
      if (ev.type === 'approval-request') {
        capturedRequestId = ev.requestId;
      }
    });

    await svc.send(
      { agentId: 1, messages: [{ role: 'user', content: 'run' }], loopEnabled: true },
      onEvent
    );

    await new Promise<void>((r) => setImmediate(r));

    // Wait until approval-request event fires
    await vi.waitFor(() => expect(capturedRequestId).toBeDefined());

    // Respond via AIService
    svc.respondApproval(capturedRequestId!, true);

    await vi.waitFor(() => expect(capturedDecision).toBe('allow'));
  });

  it('controller invokes worker A then B then A', async () => {
    const defaultAgent = makeAgent({ id: 1, isBuiltin: true, modelId: 100 });
    const workerA = makeAgent({
      id: 2,
      name: 'Worker A',
      isBuiltin: false,
      modelId: 101,
      instructions: 'You are Agent A.',
    });
    const workerB = makeAgent({
      id: 3,
      name: 'Worker B',
      isBuiltin: false,
      modelId: 102,
      instructions: 'You are Agent B.',
    });

    const provider = makeProvider({
      models: [
        {
          id: 100,
          modelId: 'root-model',
          name: 'Root',
          type: null,
          capabilities: [],
          description: null,
        },
        {
          id: 101,
          modelId: 'model-a',
          name: 'Model A',
          type: null,
          capabilities: [],
          description: null,
        },
        {
          id: 102,
          modelId: 'model-b',
          name: 'Model B',
          type: null,
          capabilities: [],
          description: null,
        },
      ],
    });

    const outputs: unknown[] = [];

    const runtime: ModelRuntime = {
      stream(req: StreamRequest): AsyncIterable<RunEvent> {
        return (async function* () {
          if (req.model.modelId === 'root-model') {
            // Root controller — calls invoke_agent three times
            const tool = req.tools.find((t) => t.name === 'invoke_agent');
            if (!tool) {
              yield { type: 'error', message: 'invoke_agent not found' } as RunEvent;
              return;
            }
            const r1 = await tool.execute(
              { agentId: 2, prompt: 'go' },
              { toolCallId: 't1', abortSignal: req.abortSignal }
            );
            const r2 = await tool.execute(
              { agentId: 3, prompt: 'go' },
              { toolCallId: 't2', abortSignal: req.abortSignal }
            );
            const r3 = await tool.execute(
              { agentId: 2, prompt: 'go' },
              { toolCallId: 't3', abortSignal: req.abortSignal }
            );
            outputs.push(r1, r2, r3);
            yield { type: 'done', reason: 'stop' } as RunEvent;
          } else if (req.model.modelId === 'model-a') {
            yield { type: 'text-delta', text: 'A' } as RunEvent;
            yield { type: 'done', reason: 'stop' } as RunEvent;
          } else {
            // model-b
            yield { type: 'text-delta', text: 'B' } as RunEvent;
            yield { type: 'done', reason: 'stop' } as RunEvent;
          }
        })();
      },
    };

    const svc = makeService([defaultAgent, workerA, workerB], [provider], runtime);

    let resolveRootDone: () => void;
    const rootDone = new Promise<void>((r) => {
      resolveRootDone = r;
    });

    const result = await svc.send(
      { agentId: 1, messages: [{ role: 'user', content: 'run' }], loopEnabled: true },
      (ref: RunRef, ev: RunEvent) => {
        if (ref.parentRunId === null && ev.type === 'done') {
          resolveRootDone!();
        }
      }
    );

    expect(result).toHaveProperty('streamId');

    // Flush setImmediate to let AgentRun start
    await new Promise<void>((r) => setImmediate(r));

    // Wait for root run to complete
    await rootDone;

    expect(outputs).toEqual(['A', 'B', 'A']);
  });

  it('error event from runtime is forwarded to onEvent (logging must not swallow it)', async () => {
    const agent = makeAgent();
    const provider = makeProvider();

    const runtime: ModelRuntime = {
      stream(): AsyncIterable<RunEvent> {
        return (async function* () {
          yield { type: 'error', message: 'boom' } as RunEvent;
        })();
      },
    };

    const svc = makeService([agent], [provider], runtime);
    const onEvent = vi.fn();

    await svc.send({ agentId: 1, messages: [{ role: 'user', content: 'hi' }] }, onEvent);

    await new Promise<void>((r) => setImmediate(r));
    for (let i = 0; i < 20; i++) await Promise.resolve();

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ runId: expect.any(String) }),
      expect.objectContaining({ type: 'error', message: 'boom' })
    );
  });
});
