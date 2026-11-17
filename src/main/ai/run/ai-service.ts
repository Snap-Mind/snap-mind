import type { AgentsService } from '../../services/agents-service.js';
import type { ProvidersService } from '../../services/providers-service.js';
import type { ModelRuntime } from '../runtime/model-runtime.js';
import type { RunRef, RunEvent } from '../runtime/types.js';
import type { AiSendRequest, AiSendResult } from '../../../shared/ai-ipc.js';
import { ToolRegistry } from '../tools/registry.js';
import { RunRegistry } from './run-registry.js';
import { ApprovalBroker } from './approval-broker.js';
import { SessionTree } from './session-tree.js';
import { AgentRun, type ResolvedTarget } from './agent-run.js';
import { createInvokeAgentTool } from '../tools/invoke-agent.js';
import { resolveAgentForRun } from '../resolve-agent-for-run.js';
import logService from '../../log-service.js';
import { redactValue } from '../redact.js';

export { type AiSendResult };

export class AIService {
  private readonly agentsService: AgentsService;
  private readonly providersService: ProvidersService;
  private readonly runtime: ModelRuntime;
  private readonly registry: ToolRegistry;
  private readonly runs: RunRegistry;
  private readonly broker: ApprovalBroker;
  private readonly tree: SessionTree;
  private readonly sendLog = logService.scope('ai.send');
  private readonly streamLog = logService.scope('ai.stream');
  private readonly abortLog = logService.scope('ai.abort');

  constructor(
    agentsService: AgentsService,
    providersService: ProvidersService,
    deps: { runtime: ModelRuntime; registry: ToolRegistry }
  ) {
    this.agentsService = agentsService;
    this.providersService = providersService;
    this.runtime = deps.runtime;
    this.registry = deps.registry;
    this.runs = new RunRegistry();
    this.broker = new ApprovalBroker();
    this.tree = new SessionTree();
  }

  async send(
    req: AiSendRequest,
    onEvent: (_ref: RunRef, _event: RunEvent) => void
  ): Promise<AiSendResult> {
    // Abort and clear any previous session
    this.runs.abortAll();
    this.tree.clear();

    // Resolve root agent
    const agents = await this.agentsService.list();
    const providers = await this.providersService.list();
    const resolved = resolveAgentForRun(req.agentId, agents, providers);

    if (resolved.ok === false) {
      this.sendLog.info(
        'resolve failed',
        redactValue({ agentId: req.agentId, code: resolved.code })
      );
      return { error: { code: resolved.code, message: resolved.message } };
    }

    const target: ResolvedTarget = {
      agent: resolved.agent,
      provider: resolved.provider,
      model: resolved.model,
    };

    const runId = crypto.randomUUID();
    const signal = this.runs.open(runId, null);
    this.tree.createRoot(runId, req.agentId, req.messages);

    this.sendLog.debug(
      'starting run',
      redactValue({
        runId,
        agentId: req.agentId,
        kind: target.provider.kind,
        modelId: target.model.modelId,
        loopEnabled: req.loopEnabled ?? false,
      })
    );

    // Wrap onEvent to log error events before forwarding
    const wrappedOnEvent = (ref: RunRef, event: RunEvent): void => {
      if (event.type === 'error') {
        this.streamLog.error(
          'run error',
          redactValue({ runId: ref.runId, parentRunId: ref.parentRunId, message: event.message })
        );
      }
      onEvent(ref, event);
    };

    // listWorkers: non-builtin agents with a resolvable target
    const listWorkers = async (): Promise<ResolvedTarget[]> => {
      const freshAgents = await this.agentsService.list();
      const freshProviders = await this.providersService.list();
      return freshAgents
        .filter((a) => !a.isBuiltin)
        .flatMap((a) => {
          const r = resolveAgentForRun(a.id, freshAgents, freshProviders);
          return r.ok ? [{ agent: r.agent, provider: r.provider, model: r.model }] : [];
        });
    };

    // Per R14: declare before closure captures it; assigned below before setImmediate fires.
    // The closure references agentRun before const is possible (circular init), so let is intentional.
    // eslint-disable-next-line prefer-const
    let agentRun: AgentRun;

    const makeInvokeAgentTool = (parent: RunRef) =>
      createInvokeAgentTool({
        listWorkers,
        runs: this.runs,
        tree: this.tree,
        startChild: (i) => agentRun.start(i),
        newRunId: () => crypto.randomUUID(),
        parent,
      });

    agentRun = new AgentRun({
      runtime: this.runtime,
      registry: this.registry,
      broker: this.broker,
      tree: this.tree,
      onEvent: wrappedOnEvent,
      makeInvokeAgentTool,
    });

    setImmediate(() => {
      void agentRun
        .start({
          runId,
          parentRunId: null,
          parentToolCallId: null,
          target,
          messages: req.messages,
          loopEnabled: req.loopEnabled ?? false,
          signal,
        })
        .finally(() => this.runs.close(runId));
    });

    return { streamId: runId };
  }

  abort(runId: string): void {
    this.abortLog.debug('abort', { runId });
    this.runs.abort(runId);
  }

  respondApproval(requestId: string, approved: boolean): void {
    this.broker.respond(requestId, approved);
  }
}
