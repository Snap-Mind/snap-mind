import { describe, it, expect, vi } from 'vitest';
import { AgentRun, MAX_STEPS } from '../agent-run.js';
import type { ResolvedTarget, StartRunInput } from '../agent-run.js';
import { ToolRegistry } from '../../tools/registry.js';
import type { ToolDef } from '../../tools/registry.js';
import { SessionTree } from '../session-tree.js';
import { ApprovalBroker } from '../approval-broker.js';
import type { ModelRuntime } from '../../runtime/model-runtime.js';
import type { RunEvent, StreamRequest, RunRef } from '../../runtime/types.js';
import type { AgentDTO } from '../../../../shared/agent-dto.js';
import type { ModelDTO, ProviderDTO } from '../../../../shared/provider-dto.js';
import type { Message } from '../../../../shared/chat.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeRuntime(script: RunEvent[] | ((_req: StreamRequest) => AsyncIterable<RunEvent>)): {
  runtime: ModelRuntime;
  requests: StreamRequest[];
} {
  const requests: StreamRequest[] = [];
  const runtime: ModelRuntime = {
    stream(req: StreamRequest): AsyncIterable<RunEvent> {
      requests.push(req);
      if (typeof script === 'function') {
        return script(req);
      }
      return (async function* () {
        for (const event of script) {
          yield event;
        }
      })();
    },
  };
  return { runtime, requests };
}

const baseAgent: AgentDTO = {
  id: 1,
  name: 'TestAgent',
  description: null,
  instructions: 'You are helpful.',
  providerId: 1,
  modelId: 1,
  isBuiltin: false,
};

const builtinAgent: AgentDTO = { ...baseAgent, isBuiltin: true };

const baseProvider: ProviderDTO = {
  id: 1,
  kind: 'openai',
  name: 'OpenAI',
  host: null,
  apiKey: 'sk-test',
  description: null,
  models: [],
};

const baseModel: ModelDTO = {
  id: 1,
  modelId: 'gpt-4o',
  name: 'GPT-4o',
  type: null,
  capabilities: [],
  description: null,
};

function makeTarget(agent: AgentDTO = baseAgent): ResolvedTarget {
  return { agent, provider: baseProvider, model: baseModel };
}

function makeInput(overrides: Partial<StartRunInput> = {}): StartRunInput {
  return {
    runId: 'run-1',
    parentRunId: null,
    parentToolCallId: null,
    target: makeTarget(),
    messages: [] as Message[],
    loopEnabled: false,
    signal: new AbortController().signal,
    ...overrides,
  };
}

function noop_onEvent(_ref: RunRef, _event: RunEvent): void {}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentRun', () => {
  it('loop off streams with no tools', async () => {
    const { runtime, requests } = fakeRuntime([{ type: 'done', reason: 'stop' }]);
    const run = new AgentRun({
      runtime,
      registry: new ToolRegistry(),
      broker: new ApprovalBroker(),
      tree: new SessionTree(),
      onEvent: noop_onEvent,
      makeInvokeAgentTool: async () => null,
    });

    await run.start(makeInput({ loopEnabled: false }));

    expect(requests).toHaveLength(1);
    expect(requests[0].tools).toEqual([]);
    expect(requests[0].onApprove).toBeUndefined();
  });

  it('controller with no workers streams with no tools', async () => {
    const { runtime, requests } = fakeRuntime([{ type: 'done', reason: 'stop' }]);
    const run = new AgentRun({
      runtime,
      registry: new ToolRegistry(), // empty registry
      broker: new ApprovalBroker(),
      tree: new SessionTree(),
      onEvent: noop_onEvent,
      makeInvokeAgentTool: async () => null, // no workers
    });

    await run.start(
      makeInput({ target: makeTarget(builtinAgent), loopEnabled: true, parentRunId: null })
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].tools).toEqual([]);
  });

  it('controller gets invoke_agent when roster non-empty', async () => {
    const { runtime, requests } = fakeRuntime([{ type: 'done', reason: 'stop' }]);
    const invokeAgentDef: ToolDef = {
      name: 'invoke_agent',
      description: 'Invoke a worker agent',
      inputSchema: {},
      risk: 'safe',
      execute: async () => null,
    };
    const run = new AgentRun({
      runtime,
      registry: new ToolRegistry(), // empty registry
      broker: new ApprovalBroker(),
      tree: new SessionTree(),
      onEvent: noop_onEvent,
      makeInvokeAgentTool: async () => invokeAgentDef,
    });

    await run.start(
      makeInput({ target: makeTarget(builtinAgent), loopEnabled: true, parentRunId: null })
    );

    expect(requests).toHaveLength(1);
    expect(requests[0].tools.map((t) => t.name)).toEqual(['invoke_agent']);
  });

  it('child run never gets invoke_agent', async () => {
    const { runtime } = fakeRuntime([{ type: 'done', reason: 'stop' }]);
    const makeInvokeAgentTool = vi.fn(async () => null);
    const run = new AgentRun({
      runtime,
      registry: new ToolRegistry(),
      broker: new ApprovalBroker(),
      tree: new SessionTree(),
      onEvent: noop_onEvent,
      makeInvokeAgentTool,
    });

    await run.start(
      makeInput({
        target: makeTarget(builtinAgent),
        loopEnabled: true,
        parentRunId: 'p',
        parentToolCallId: 'tc-p',
      })
    );

    expect(makeInvokeAgentTool).not.toHaveBeenCalled();
  });

  it('non-builtin root never gets invoke_agent', async () => {
    const { runtime } = fakeRuntime([{ type: 'done', reason: 'stop' }]);
    const makeInvokeAgentTool = vi.fn(async () => null);
    const run = new AgentRun({
      runtime,
      registry: new ToolRegistry(),
      broker: new ApprovalBroker(),
      tree: new SessionTree(),
      onEvent: noop_onEvent,
      makeInvokeAgentTool,
    });

    await run.start(
      makeInput({
        target: makeTarget(baseAgent), // isBuiltin: false
        loopEnabled: true,
        parentRunId: null,
      })
    );

    expect(makeInvokeAgentTool).not.toHaveBeenCalled();
  });

  it('passes generation params', async () => {
    const { runtime, requests } = fakeRuntime([{ type: 'done', reason: 'stop' }]);
    const run = new AgentRun({
      runtime,
      registry: new ToolRegistry(),
      broker: new ApprovalBroker(),
      tree: new SessionTree(),
      onEvent: noop_onEvent,
      makeInvokeAgentTool: async () => null,
    });

    // agent with no overrides → all defaults
    await run.start(makeInput({ target: makeTarget(baseAgent) }));

    expect(requests[0].params).toEqual({
      temperature: 0.7,
      maxOutputTokens: 2048,
      topP: 0.95,
      reasoning: false,
    });
    expect(requests[0].maxSteps).toBe(MAX_STEPS);
    expect(MAX_STEPS).toBe(10);
  });

  it('forwards events tagged with RunRef and returns accumulated text', async () => {
    const script: RunEvent[] = [
      { type: 'text-delta', text: 'a' },
      { type: 'text-delta', text: 'b' },
      { type: 'done', reason: 'stop' },
    ];
    const { runtime } = fakeRuntime(script);

    const received: Array<{ ref: RunRef; event: RunEvent }> = [];
    const run = new AgentRun({
      runtime,
      registry: new ToolRegistry(),
      broker: new ApprovalBroker(),
      tree: new SessionTree(),
      onEvent: (ref, event) => received.push({ ref, event }),
      makeInvokeAgentTool: async () => null,
    });

    const ref: RunRef = { runId: 'run-fw', parentRunId: null, parentToolCallId: null };
    const outcome = await run.start(makeInput({ ...ref }));

    expect(outcome).toEqual({ status: 'stop', text: 'ab' });
    expect(received).toHaveLength(3);
    for (const { ref: r } of received) {
      expect(r).toEqual(ref);
    }
    expect(received[0].event).toEqual({ type: 'text-delta', text: 'a' });
    expect(received[1].event).toEqual({ type: 'text-delta', text: 'b' });
    expect(received[2].event).toEqual({ type: 'done', reason: 'stop' });
  });

  it('missing terminal event emits done', async () => {
    // Stream ends with a text-delta but no done/error
    const script: RunEvent[] = [{ type: 'text-delta', text: 'hello' }];
    const { runtime } = fakeRuntime(script);

    const received: RunEvent[] = [];
    const run = new AgentRun({
      runtime,
      registry: new ToolRegistry(),
      broker: new ApprovalBroker(),
      tree: new SessionTree(),
      onEvent: (_ref, event) => received.push(event),
      makeInvokeAgentTool: async () => null,
    });

    const outcome = await run.start(makeInput());

    // Should have emitted a synthetic done stop
    const lastEvent = received[received.length - 1];
    expect(lastEvent).toEqual({ type: 'done', reason: 'stop' });
    expect(outcome).toEqual({ status: 'stop', text: 'hello' });
  });

  it('onApprove: safe tool allows without broker', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'safe_tool',
      description: 'A safe tool',
      inputSchema: {},
      risk: 'safe',
      execute: async () => 'ok',
    });

    let approveResult: 'allow' | 'deny' | undefined;
    const { runtime } = fakeRuntime(async function* (req) {
      approveResult = await req.onApprove!({
        toolCallId: 'tc1',
        toolName: 'safe_tool',
        input: {},
      });
      yield { type: 'done', reason: 'stop' } as RunEvent;
    });

    const broker = new ApprovalBroker();
    const respondSpy = vi.spyOn(broker, 'request');

    const run = new AgentRun({
      runtime,
      registry,
      broker,
      tree: new SessionTree(),
      onEvent: noop_onEvent,
      makeInvokeAgentTool: async () => null,
    });

    await run.start(makeInput({ loopEnabled: true }));

    expect(approveResult).toBe('allow');
    // Safe tools bypass the broker entirely
    expect(respondSpy).not.toHaveBeenCalled();
  });

  it('onApprove: moderate tool emits approval-request and waits for broker', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'mod_tool',
      description: 'A moderate tool',
      inputSchema: {},
      risk: 'moderate',
      execute: async () => 'ok',
    });

    const broker = new ApprovalBroker();
    const received: RunEvent[] = [];

    // Fix issue 1: capture decision in outer variable; never use expect() inside generator
    let capturedDecision: 'allow' | 'deny' | undefined;
    const { runtime } = fakeRuntime(async function* (req) {
      capturedDecision = await req.onApprove!({
        toolCallId: 'tc-mod',
        toolName: 'mod_tool',
        input: { x: 1 },
      });
      yield { type: 'done', reason: 'stop' } as RunEvent;
    });

    const run = new AgentRun({
      runtime,
      registry,
      broker,
      tree: new SessionTree(),
      onEvent: (_ref, event) => {
        received.push(event);
        if (event.type === 'approval-request') {
          // Respond asynchronously after the await is set up
          Promise.resolve().then(() => broker.respond(event.requestId, true));
        }
      },
      makeInvokeAgentTool: async () => null,
    });

    const outcome = await run.start(makeInput({ loopEnabled: true }));

    // Assert outside the generator
    expect(capturedDecision).toBe('allow');
    expect(outcome.status).toBe('stop');
    const approvalEvent = received.find((e) => e.type === 'approval-request');
    expect(approvalEvent).toBeDefined();
    expect(approvalEvent).toMatchObject({
      type: 'approval-request',
      toolCallId: 'tc-mod',
      toolName: 'mod_tool',
      input: { x: 1 },
    });
  });

  it('abort cancels pending approval', async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: 'mod_tool2',
      description: 'A moderate tool',
      inputSchema: {},
      risk: 'moderate',
      execute: async () => 'ok',
    });

    const controller = new AbortController();
    const broker = new ApprovalBroker();

    let approveResult: 'allow' | 'deny' | undefined;
    const { runtime } = fakeRuntime(async function* (req) {
      approveResult = await req.onApprove!({
        toolCallId: 'tc-abort',
        toolName: 'mod_tool2',
        input: {},
      });
      // After the approval is cancelled (deny), emit done so the run can end
      yield { type: 'done', reason: 'stop' } as RunEvent;
    });

    const run = new AgentRun({
      runtime,
      registry,
      broker,
      tree: new SessionTree(),
      onEvent: (_ref, event) => {
        if (event.type === 'approval-request') {
          // Abort the signal — which triggers broker.cancelRun(runId) → resolves to 'deny'
          setTimeout(() => controller.abort(), 0);
        }
      },
      makeInvokeAgentTool: async () => null,
    });

    await run.start(makeInput({ loopEnabled: true, signal: controller.signal }));

    expect(approveResult).toBe('deny');
  });

  it('makeInvokeAgentTool throwing resolves error outcome', async () => {
    // Issue 2: setup code outside try could cause start() to reject; now it must resolve error outcome
    const received: RunEvent[] = [];
    const { runtime } = fakeRuntime([{ type: 'done', reason: 'stop' }]);

    const run = new AgentRun({
      runtime,
      registry: new ToolRegistry(),
      broker: new ApprovalBroker(),
      tree: new SessionTree(),
      onEvent: (_ref, event) => received.push(event),
      makeInvokeAgentTool: async () => {
        throw new Error('db down');
      },
    });

    // builtin root with loop on → makeInvokeAgentTool is called and throws
    const outcome = await run.start(
      makeInput({ target: makeTarget(builtinAgent), loopEnabled: true, parentRunId: null })
    );

    expect(outcome.status).toBe('error');
    expect(outcome.message).toContain('db down');
    // onEvent should have received exactly one error event
    const errorEvents = received.filter((e) => e.type === 'error');
    expect(errorEvents).toHaveLength(1);
  });

  it('onApprove after abort returns deny without broker request', async () => {
    // Issue 3: after abort the signal, onApprove must return 'deny' immediately
    // without calling broker.request (which would create an unresolvable pending request)
    const registry = new ToolRegistry();
    registry.register({
      name: 'post_abort_tool',
      description: 'A moderate tool',
      inputSchema: {},
      risk: 'moderate',
      execute: async () => 'ok',
    });

    const controller = new AbortController();
    const broker = new ApprovalBroker();
    const received: RunEvent[] = [];
    const requestSpy = vi.spyOn(broker, 'request');

    let postAbortDecision: 'allow' | 'deny' | undefined;
    const { runtime } = fakeRuntime(async function* (req) {
      // Abort the controller first, then call onApprove
      controller.abort();
      postAbortDecision = await req.onApprove!({
        toolCallId: 'tc-post-abort',
        toolName: 'post_abort_tool',
        input: {},
      });
      yield { type: 'done', reason: 'stop' } as RunEvent;
    });

    const run = new AgentRun({
      runtime,
      registry,
      broker,
      tree: new SessionTree(),
      onEvent: (_ref, event) => received.push(event),
      makeInvokeAgentTool: async () => null,
    });

    await run.start(makeInput({ loopEnabled: true, signal: controller.signal }));

    expect(postAbortDecision).toBe('deny');
    // broker.request must NOT have been called — no hanging pending request
    expect(requestSpy).not.toHaveBeenCalled();
    // No approval-request event should have been emitted
    expect(received.some((e) => e.type === 'approval-request')).toBe(false);
  });

  it('bound tool execute receives runId in ctx', async () => {
    const registry = new ToolRegistry();
    let capturedRunId: string | undefined;
    let capturedToolCallId: string | undefined;

    registry.register({
      name: 'ctx_tool',
      description: 'Tool that captures ctx',
      inputSchema: {},
      risk: 'safe',
      execute: async (_input, ctx) => {
        capturedRunId = ctx.runId;
        capturedToolCallId = ctx.toolCallId;
        return 'done';
      },
    });

    const { runtime } = fakeRuntime(async function* (req) {
      // Directly call the bound RuntimeTool execute
      await req.tools[0].execute({}, { toolCallId: 'tc-ctx', abortSignal: req.abortSignal });
      yield { type: 'done', reason: 'stop' } as RunEvent;
    });

    const run = new AgentRun({
      runtime,
      registry,
      broker: new ApprovalBroker(),
      tree: new SessionTree(),
      onEvent: noop_onEvent,
      makeInvokeAgentTool: async () => null,
    });

    const runId = 'run-ctx-test';
    await run.start(makeInput({ runId, loopEnabled: true }));

    expect(capturedRunId).toBe(runId);
    expect(capturedToolCallId).toBe('tc-ctx');
  });
});
