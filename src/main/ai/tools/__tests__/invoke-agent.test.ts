import { describe, it, expect, vi } from 'vitest';
import { createInvokeAgentTool } from '../invoke-agent.js';
import { RunRegistry } from '../../run/run-registry.js';
import { SessionTree } from '../../run/session-tree.js';
import type { ResolvedTarget, RunOutcome, StartRunInput } from '../../run/agent-run.js';
import type { RunRef } from '../../runtime/types.js';
import type { AgentDTO } from '../../../../shared/agent-dto.js';
import type { ModelDTO, ProviderDTO } from '../../../../shared/provider-dto.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeAgent(overrides: Partial<AgentDTO> = {}): AgentDTO {
  return {
    id: 2,
    name: 'Translator',
    description: 'Translates text',
    instructions: '',
    providerId: 1,
    modelId: 1,
    isBuiltin: false,
    ...overrides,
  };
}

function makeTarget(agent: AgentDTO): ResolvedTarget {
  return { agent, provider: baseProvider, model: baseModel };
}

const parentRef: RunRef = {
  runId: 'parent-run',
  parentRunId: null,
  parentToolCallId: null,
};

function makeCtx(runId = 'parent-run', toolCallId = 'tc-1') {
  return { runId, toolCallId, abortSignal: new AbortController().signal };
}

let idCounter = 0;
function newRunId(): string {
  idCounter += 1;
  return `child-run-${idCounter}`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createInvokeAgentTool', () => {
  it('returns null when no workers', async () => {
    const runs = new RunRegistry();
    const tree = new SessionTree();
    const result = await createInvokeAgentTool({
      listWorkers: async () => [],
      runs,
      tree,
      startChild: vi.fn(),
      newRunId,
      parent: parentRef,
    });
    expect(result).toBeNull();
  });

  it('lists workers in description and enum', async () => {
    const runs = new RunRegistry();
    const tree = new SessionTree();
    const workers: ResolvedTarget[] = [
      makeTarget(makeAgent({ id: 2, name: 'Translator', description: 'Translates text' })),
      makeTarget(makeAgent({ id: 3, name: 'Summarizer', description: 'Summarizes content' })),
    ];
    const def = await createInvokeAgentTool({
      listWorkers: async () => workers,
      runs,
      tree,
      startChild: vi.fn(),
      newRunId,
      parent: parentRef,
    });
    expect(def).not.toBeNull();
    const schema = def!.inputSchema as {
      properties: { agentId: { enum: number[] } };
    };
    expect(schema.properties.agentId.enum).toEqual([2, 3]);
    expect(def!.description).toContain('- 2: Translator — Translates text');
    expect(def!.risk).toBe('safe');
  });

  it('rejects agentId outside the roster', async () => {
    const runs = new RunRegistry();
    const tree = new SessionTree();
    const workers: ResolvedTarget[] = [
      makeTarget(makeAgent({ id: 2, name: 'Translator', description: 'Translates text' })),
    ];
    const def = await createInvokeAgentTool({
      listWorkers: async () => workers,
      runs,
      tree,
      startChild: vi.fn(),
      newRunId,
      parent: parentRef,
    });
    const ctx = makeCtx();
    await expect(def!.execute({ agentId: 1, prompt: 'x' }, ctx)).rejects.toThrow(/not available/);
  });

  it('starts child with parent links and returns text', async () => {
    const runs = new RunRegistry();
    const tree = new SessionTree();
    const parentRunId = 'parent-run';
    // Create a root node so addChild can work
    tree.createRoot(parentRunId, 99, []);
    runs.open(parentRunId, null);

    const workers: ResolvedTarget[] = [
      makeTarget(makeAgent({ id: 2, name: 'Translator', description: 'Translates text' })),
    ];
    const capturedInputs: StartRunInput[] = [];
    const startChild = vi.fn(async (input: StartRunInput): Promise<RunOutcome> => {
      capturedInputs.push(input);
      return { status: 'stop', text: 'done text' };
    });

    const def = await createInvokeAgentTool({
      listWorkers: async () => workers,
      runs,
      tree,
      startChild,
      newRunId,
      parent: parentRef,
    });

    const ctx = makeCtx(parentRunId, 'tc-42');
    const result = await def!.execute({ agentId: 2, prompt: 'hi' }, ctx);

    expect(result).toBe('done text');
    expect(startChild).toHaveBeenCalledOnce();
    const call = capturedInputs[0];
    expect(call.parentRunId).toBe(parentRunId);
    expect(call.parentToolCallId).toBe('tc-42');
    expect(call.loopEnabled).toBe(true);
    expect(call.messages).toEqual([{ role: 'user', content: 'hi' }]);

    // Tree has the child under the parent
    const childNode = tree.get(call.runId);
    expect(childNode).toBeDefined();
    expect(childNode!.parentId).toBe(parentRunId);

    runs.close(parentRunId);
  });

  it('child error becomes thrown tool error', async () => {
    const runs = new RunRegistry();
    const tree = new SessionTree();
    const parentRunId = 'parent-run-err';
    tree.createRoot(parentRunId, 99, []);
    runs.open(parentRunId, null);

    const workers: ResolvedTarget[] = [
      makeTarget(makeAgent({ id: 2, name: 'Translator', description: 'Translates text' })),
    ];
    const startChild = vi.fn(
      async (): Promise<RunOutcome> => ({
        status: 'error',
        text: '',
        message: 'no API key',
      })
    );

    const def = await createInvokeAgentTool({
      listWorkers: async () => workers,
      runs,
      tree,
      startChild,
      newRunId,
      parent: parentRef,
    });

    const ctx = makeCtx(parentRunId, 'tc-err');
    await expect(def!.execute({ agentId: 2, prompt: 'hello' }, ctx)).rejects.toThrow(/no API key/);

    runs.close(parentRunId);
  });

  it('child abort throws Worker run was aborted.', async () => {
    const runs = new RunRegistry();
    const tree = new SessionTree();
    const parentRunId = 'parent-run-abort';
    tree.createRoot(parentRunId, 99, []);
    runs.open(parentRunId, null);

    const workers: ResolvedTarget[] = [
      makeTarget(makeAgent({ id: 2, name: 'Translator', description: 'Translates text' })),
    ];
    const startChild = vi.fn(
      async (): Promise<RunOutcome> => ({
        status: 'aborted',
        text: '',
      })
    );

    const def = await createInvokeAgentTool({
      listWorkers: async () => workers,
      runs,
      tree,
      startChild,
      newRunId,
      parent: parentRef,
    });

    const ctx = makeCtx(parentRunId, 'tc-ab');
    await expect(def!.execute({ agentId: 2, prompt: 'hello' }, ctx)).rejects.toThrow(
      'Worker run was aborted.'
    );

    runs.close(parentRunId);
  });

  it('closes child run even when child throws', async () => {
    const runs = new RunRegistry();
    const tree = new SessionTree();
    const parentRunId = 'parent-run-close';
    tree.createRoot(parentRunId, 99, []);
    runs.open(parentRunId, null);

    const workers: ResolvedTarget[] = [
      makeTarget(makeAgent({ id: 2, name: 'Translator', description: 'Translates text' })),
    ];
    let capturedChildId = '';
    const startChild = vi.fn(async (input: StartRunInput): Promise<RunOutcome> => {
      capturedChildId = input.runId;
      throw new Error('unexpected crash');
    });

    const def = await createInvokeAgentTool({
      listWorkers: async () => workers,
      runs,
      tree,
      startChild,
      newRunId,
      parent: parentRef,
    });

    const ctx = makeCtx(parentRunId, 'tc-close');
    await expect(def!.execute({ agentId: 2, prompt: 'hello' }, ctx)).rejects.toThrow(
      'unexpected crash'
    );

    expect(runs.isOpen(capturedChildId)).toBe(false);

    runs.close(parentRunId);
  });

  it('aborting parent signal aborts child signal', async () => {
    const runs = new RunRegistry();
    const tree = new SessionTree();
    const parentRunId = 'parent-run-cascade';

    // Open parent run in a real RunRegistry
    runs.open(parentRunId, null);
    // Create tree root so addChild can work
    tree.createRoot(parentRunId, 99, []);

    const workers: ResolvedTarget[] = [
      makeTarget(makeAgent({ id: 2, name: 'Translator', description: 'Translates text' })),
    ];

    let capturedChildSignal: AbortSignal | null = null;
    // startChild that captures the signal and waits (never resolves until externally aborted)
    const startChild = vi.fn(
      (input: StartRunInput): Promise<RunOutcome> =>
        new Promise((resolve) => {
          capturedChildSignal = input.signal;
          input.signal.addEventListener('abort', () => {
            resolve({ status: 'aborted', text: '' });
          });
        })
    );

    const def = await createInvokeAgentTool({
      listWorkers: async () => workers,
      runs,
      tree,
      startChild,
      newRunId,
      parent: { runId: parentRunId, parentRunId: null, parentToolCallId: null },
    });

    const ctx = makeCtx(parentRunId, 'tc-cascade');
    const executePromise = def!.execute({ agentId: 2, prompt: 'hello' }, ctx);

    // Wait a tick for startChild to be called and signal captured
    await Promise.resolve();

    expect(capturedChildSignal).not.toBeNull();

    // Abort the parent run — child signal should be aborted
    runs.abort(parentRunId);

    // The execute promise should now resolve (startChild resolved via abort listener)
    await expect(executePromise).rejects.toThrow('Worker run was aborted.');

    expect(capturedChildSignal!.aborted).toBe(true);

    runs.close(parentRunId);
  });
});
