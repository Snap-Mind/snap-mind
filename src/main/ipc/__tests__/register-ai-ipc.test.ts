import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { RunRef, RunEvent } from '../../ai/runtime/types.js';
import type { AiSendRequest } from '../../../shared/ai-ipc.js';

// -----------------------------------------------------------------------
// Mock electron before importing the module under test
// -----------------------------------------------------------------------
const handlers: Record<string, (..._args: unknown[]) => unknown> = {};

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, fn: (..._args: unknown[]) => unknown) => {
      handlers[channel] = fn;
    }),
  },
}));

// -----------------------------------------------------------------------
// Fake AIService
// -----------------------------------------------------------------------
type OnEvent = (_ref: RunRef, _ev: RunEvent) => void;

function makeFakeService() {
  let capturedOnEvent: OnEvent | null = null;

  const service = {
    send: vi.fn(async (_req: AiSendRequest, onEvent: OnEvent) => {
      capturedOnEvent = onEvent;
      return { runId: 'run-1' };
    }),
    abort: vi.fn(),
    respondApproval: vi.fn(),
    fire(ref: RunRef, ev: RunEvent) {
      capturedOnEvent?.(ref, ev);
    },
  };

  return service;
}

// -----------------------------------------------------------------------
// Import module under test after mocks are set up
// -----------------------------------------------------------------------
async function setup() {
  vi.resetModules();
  Object.keys(handlers).forEach((k) => delete handlers[k]);
  const fakeService = makeFakeService();
  const { registerAiIpc } = await import('../register-ai-ipc.js');
  registerAiIpc(() => fakeService as never);
  return fakeService;
}

function makeSender(destroyed = false) {
  return {
    send: vi.fn(),
    isDestroyed: () => destroyed,
  };
}

const rootRef: RunRef = { runId: 'run-1', parentRunId: null, parentToolCallId: null };
const childRef: RunRef = { runId: 'run-2', parentRunId: 'run-1', parentToolCallId: 'tc-1' };

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------
describe('registerAiIpc', () => {
  beforeEach(async () => {
    await setup();
  });

  describe('maps each RunEvent type to its channel with AiRunRef', () => {
    it.each([
      [
        'text-delta',
        'ai:token',
        { type: 'text-delta', text: 'hello' } as RunEvent,
        { text: 'hello' },
      ],
      [
        'reasoning-delta',
        'ai:reasoning',
        { type: 'reasoning-delta', text: 'thinking' } as RunEvent,
        { text: 'thinking' },
      ],
      [
        'source',
        'ai:source',
        { type: 'source', url: 'https://example.com', title: 'Example' } as RunEvent,
        { source: { url: 'https://example.com', title: 'Example' } },
      ],
      [
        'tool-call',
        'ai:tool-call',
        {
          type: 'tool-call',
          toolCallId: 'tc-1',
          toolName: 'search',
          input: { q: 'x' },
        } as RunEvent,
        { toolCallId: 'tc-1', toolName: 'search', input: { q: 'x' } },
      ],
      [
        'approval-request',
        'ai:approval-request',
        {
          type: 'approval-request',
          toolCallId: 'tc-2',
          toolName: 'run_cmd',
          input: { cmd: 'ls' },
          requestId: 'req-1',
        } as RunEvent,
        { toolCallId: 'tc-2', toolName: 'run_cmd', input: { cmd: 'ls' }, requestId: 'req-1' },
      ],
      [
        'tool-result',
        'ai:tool-result',
        {
          type: 'tool-result',
          toolCallId: 'tc-3',
          toolName: 'search',
          output: { results: [] },
          isError: false,
        } as RunEvent,
        { toolCallId: 'tc-3', toolName: 'search', output: { results: [] }, isError: false },
      ],
      ['done', 'ai:done', { type: 'done', reason: 'stop' } as RunEvent, { reason: 'stop' }],
      ['error', 'ai:error', { type: 'error', message: 'oops' } as RunEvent, { message: 'oops' }],
    ])('%s → %s with AiRunRef fields', async (_, channel, event, expectedExtra) => {
      const fakeService = makeFakeService();
      // Re-register with fresh service
      Object.keys(handlers).forEach((k) => delete handlers[k]);
      const { registerAiIpc } = await import('../register-ai-ipc.js');
      registerAiIpc(() => fakeService as never);

      const sender = makeSender();
      const fakeEvent = { sender };

      // Invoke ai:send handler
      const sendHandler = handlers['ai:send'];
      expect(sendHandler).toBeDefined();
      const req: AiSendRequest = { agentId: 1, messages: [], loopEnabled: false };
      const promise = sendHandler(fakeEvent, req) as Promise<unknown>;

      // Fire the event synchronously via fakeService
      fakeService.fire(rootRef, event);

      await promise;

      expect(sender.send).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({
          runId: rootRef.runId,
          parentRunId: rootRef.parentRunId,
          parentToolCallId: rootRef.parentToolCallId,
          ...expectedExtra,
        })
      );
    });
  });

  it('forwards child run events (parentRunId !== null)', async () => {
    const fakeService = makeFakeService();
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    const { registerAiIpc } = await import('../register-ai-ipc.js');
    registerAiIpc(() => fakeService as never);

    const sender = makeSender();
    const req: AiSendRequest = { agentId: 1, messages: [], loopEnabled: false };
    const promise = handlers['ai:send']({ sender }, req) as Promise<unknown>;

    fakeService.fire(childRef, { type: 'text-delta', text: 'child text' });
    await promise;

    expect(sender.send).toHaveBeenCalledWith(
      'ai:token',
      expect.objectContaining({
        runId: 'run-2',
        parentRunId: 'run-1',
        parentToolCallId: 'tc-1',
        text: 'child text',
      })
    );
  });

  it('skips send when window is destroyed', async () => {
    const fakeService = makeFakeService();
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    const { registerAiIpc } = await import('../register-ai-ipc.js');
    registerAiIpc(() => fakeService as never);

    const sender = makeSender(true); // destroyed = true
    const req: AiSendRequest = { agentId: 1, messages: [], loopEnabled: false };
    const promise = handlers['ai:send']({ sender }, req) as Promise<unknown>;

    fakeService.fire(rootRef, { type: 'text-delta', text: 'hello' });
    await promise;

    expect(sender.send).not.toHaveBeenCalled();
  });

  it('ai:approval-response calls respondApproval', async () => {
    const fakeService = makeFakeService();
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    const { registerAiIpc } = await import('../register-ai-ipc.js');
    registerAiIpc(() => fakeService as never);

    const handler = handlers['ai:approval-response'];
    expect(handler).toBeDefined();

    await handler({}, { requestId: 'req-1', approved: true });
    expect(fakeService.respondApproval).toHaveBeenCalledWith('req-1', true);
  });

  it('ai:abort passes runId', async () => {
    const fakeService = makeFakeService();
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    const { registerAiIpc } = await import('../register-ai-ipc.js');
    registerAiIpc(() => fakeService as never);

    const handler = handlers['ai:abort'];
    expect(handler).toBeDefined();

    await handler({}, 'run-42');
    expect(fakeService.abort).toHaveBeenCalledWith('run-42');
  });
});
