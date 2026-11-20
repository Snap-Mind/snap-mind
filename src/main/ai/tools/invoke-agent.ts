import type { ResolvedTarget, RunOutcome, StartRunInput } from '../run/agent-run.js';
import type { RunRegistry } from '../run/run-registry.js';
import type { SessionTree } from '../run/session-tree.js';
import type { RunRef } from '../runtime/types.js';
import type { ToolDef, ToolContext } from './registry.js';
import logService from '../../log-service.js';
import { redactValue } from '../redact.js';

const invokeLog = logService.scope('ai.invoke');

export async function createInvokeAgentTool(deps: {
  listWorkers: () => Promise<ResolvedTarget[]>;
  runs: RunRegistry;
  tree: SessionTree;
  startChild: (_input: StartRunInput) => Promise<RunOutcome>;
  newRunId: () => string;
  parent: RunRef;
}): Promise<ToolDef | null> {
  const { listWorkers, runs, tree, startChild, newRunId } = deps;

  const workers = await listWorkers();

  if (workers.length === 0) {
    return null;
  }

  const workerIds = workers.map((w) => w.agent.id);
  const workerMap = new Map<number, ResolvedTarget>(workers.map((w) => [w.agent.id, w]));

  const descriptionLines = [
    'Delegate a task to another saved agent and get its reply as text. Call one agent at a time.',
    'Available agents:',
    ...workers.map((w) => {
      const rawDesc = w.agent.description;
      const desc = rawDesc && rawDesc.trim() ? rawDesc.trim() : 'no description';
      return `- ${w.agent.id}: ${w.agent.name} — ${desc}`;
    }),
  ];
  const description = descriptionLines.join('\n');

  const def: ToolDef = {
    name: 'invoke_agent',
    description,
    inputSchema: {
      type: 'object',
      properties: {
        agentId: { type: 'integer', enum: workerIds },
        prompt: { type: 'string', minLength: 1 },
      },
      required: ['agentId', 'prompt'],
      additionalProperties: false,
    },
    risk: 'safe',
    async execute(input: unknown, ctx: ToolContext): Promise<unknown> {
      const { agentId, prompt } = input as { agentId: number; prompt: string };

      // Validate agentId against roster snapshot
      if (!workerMap.has(agentId)) {
        throw new Error(`Agent ${agentId} is not available.`);
      }

      // Validate prompt
      if (typeof prompt !== 'string' || prompt.length === 0) {
        throw new Error('prompt must be a non-empty string.');
      }

      const target = workerMap.get(agentId)!;
      const childRunId = newRunId();
      const signal = runs.open(childRunId, ctx.runId);

      const messages = [{ role: 'user' as const, content: prompt }];
      invokeLog.debug(
        'child start',
        redactValue({
          parentRunId: ctx.runId,
          childRunId,
          toolCallId: ctx.toolCallId,
          agentId,
          agentName: target.agent.name,
          promptChars: prompt.length,
        })
      );

      try {
        tree.addChild(ctx.runId, childRunId, agentId, messages);
        const outcome = await startChild({
          runId: childRunId,
          parentRunId: ctx.runId,
          parentToolCallId: ctx.toolCallId,
          target,
          messages,
          loopEnabled: true,
          signal,
        });

        invokeLog.debug(
          'child end',
          redactValue({
            childRunId,
            status: outcome.status,
            textChars: outcome.text.length,
            message: outcome.message,
          })
        );

        if (outcome.status === 'stop') {
          return outcome.text;
        } else if (outcome.status === 'aborted') {
          throw new Error('Worker run was aborted.');
        } else {
          throw new Error(outcome.message ?? 'Worker run failed.');
        }
      } finally {
        runs.close(childRunId);
      }
    },
  };

  return def;
}
