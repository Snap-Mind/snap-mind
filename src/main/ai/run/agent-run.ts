import type { AgentDTO } from '../../../shared/agent-dto.js';
import type { ModelDTO, ProviderDTO } from '../../../shared/provider-dto.js';
import type { Message } from '../../../shared/chat.js';
import type { ModelRuntime } from '../runtime/model-runtime.js';
import type { RunEvent, RunRef, RuntimeTool, ToolCall } from '../runtime/types.js';
import { checkPermission } from '../permission/policy.js';
import { PERMISSION_MODE } from '../permission/modes.js';
import type { ToolDef } from '../tools/registry.js';
import { ToolRegistry } from '../tools/registry.js';
import { SessionTree } from './session-tree.js';
import { ApprovalBroker } from './approval-broker.js';
import { mapParams } from '../mapping/map-params.js';
import { describeAiError } from '../describe-ai-error.js';

export const MAX_STEPS = 10;

export type ResolvedTarget = { agent: AgentDTO; provider: ProviderDTO; model: ModelDTO };

export type RunOutcome = {
  status: 'stop' | 'aborted' | 'error';
  text: string;
  message?: string;
};

export type StartRunInput = RunRef & {
  target: ResolvedTarget;
  messages: Message[];
  loopEnabled: boolean;
  signal: AbortSignal;
};

export class AgentRun {
  private runtime: ModelRuntime;
  private registry: ToolRegistry;
  private broker: ApprovalBroker;
  private tree: SessionTree;
  private onEvent: (_ref: RunRef, _event: RunEvent) => void;
  private makeInvokeAgentTool: (_parent: RunRef) => Promise<ToolDef | null>;

  constructor(deps: {
    runtime: ModelRuntime;
    registry: ToolRegistry;
    broker: ApprovalBroker;
    tree: SessionTree;
    onEvent: (_ref: RunRef, _event: RunEvent) => void;
    makeInvokeAgentTool: (_parent: RunRef) => Promise<ToolDef | null>;
  }) {
    this.runtime = deps.runtime;
    this.registry = deps.registry;
    this.broker = deps.broker;
    this.tree = deps.tree;
    this.onEvent = deps.onEvent;
    this.makeInvokeAgentTool = deps.makeInvokeAgentTool;
  }

  async start(input: StartRunInput): Promise<RunOutcome> {
    const { runId, parentRunId, parentToolCallId, target, messages, loopEnabled, signal } = input;
    const ref: RunRef = { runId, parentRunId, parentToolCallId };
    const { agent, provider, model } = target;

    // A run is a "controller" when it is the root, is builtin, and loop is enabled
    const controller = parentRunId === null && agent.isBuiltin && loopEnabled;

    // Build the list of ToolDefs for this run
    let toolDefs: ToolDef[] = [];
    if (loopEnabled) {
      toolDefs = [...this.registry.list()];
      if (controller) {
        const invokeAgent = await this.makeInvokeAgentTool(ref);
        if (invokeAgent !== null) {
          toolDefs.push(invokeAgent);
        }
      }
    }

    // Bind each ToolDef to a RuntimeTool, injecting runId into the execute context
    const runtimeTools: RuntimeTool[] = toolDefs.map((def) => ({
      name: def.name,
      description: def.description,
      inputSchema: def.inputSchema,
      execute: (inp: unknown, opts: { toolCallId: string; abortSignal: AbortSignal }) =>
        def.execute(inp, { runId, toolCallId: opts.toolCallId, abortSignal: opts.abortSignal }),
    }));

    // onApprove is only wired when there are tools
    const onApprove =
      runtimeTools.length > 0
        ? async (call: ToolCall): Promise<'allow' | 'deny'> => {
            const def = toolDefs.find((d) => d.name === call.toolName);
            if (!def) return 'deny';
            const decision = checkPermission(call.toolName, def.risk, PERMISSION_MODE);
            if (decision !== 'ask') return decision;
            // 'ask' — go through the approval broker
            const { requestId, decision: decisionPromise } = this.broker.request(runId, call);
            this.onEvent(ref, {
              type: 'approval-request',
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              input: call.input,
              requestId,
            });
            return decisionPromise;
          }
        : undefined;

    // Build generation params (drop webSearch — not in GenerationParams)
    const { webSearch: _webSearch, ...params } = mapParams(agent);

    // Build StreamRequest
    const trimmedInstructions = agent.instructions.trim();
    const streamRequest = {
      model: {
        provider: {
          kind: provider.kind,
          apiKey: provider.apiKey,
          host: provider.host ?? '',
          apiVersion: provider.apiVersion ?? null,
        },
        modelId: model.modelId,
      },
      params,
      messages,
      instructions: trimmedInstructions || undefined,
      tools: runtimeTools,
      maxSteps: MAX_STEPS,
      abortSignal: signal,
      onApprove,
    };

    // Register abort listener — cancels pending approvals for this run
    const onAbort = (): void => {
      this.broker.cancelRun(runId);
    };
    signal.addEventListener('abort', onAbort, { once: true });

    let text = '';
    let outcome: RunOutcome | undefined;

    try {
      for await (const event of this.runtime.stream(streamRequest)) {
        this.onEvent(ref, event);
        if (event.type === 'text-delta') {
          text += event.text;
        } else if (event.type === 'done') {
          outcome = {
            status: event.reason === 'stop' ? 'stop' : 'aborted',
            text,
          };
          break; // R9: stop at first terminal event
        } else if (event.type === 'error') {
          outcome = { status: 'error', text, message: event.message };
          break;
        }
      }
    } catch (err) {
      // R8: runtime threw — emit synthetic terminal event
      if (signal.aborted) {
        const doneEvent: RunEvent = { type: 'done', reason: 'aborted' };
        this.onEvent(ref, doneEvent);
        outcome = { status: 'aborted', text };
      } else {
        const message = describeAiError(err);
        const errorEvent: RunEvent = { type: 'error', message };
        this.onEvent(ref, errorEvent);
        outcome = { status: 'error', text, message };
      }
    } finally {
      signal.removeEventListener('abort', onAbort);
    }

    // Handle missing terminal event (iterable ended without done/error)
    if (outcome === undefined) {
      const reason = signal.aborted ? 'aborted' : 'stop';
      const doneEvent: RunEvent = { type: 'done', reason };
      this.onEvent(ref, doneEvent);
      outcome = { status: reason === 'stop' ? 'stop' : 'aborted', text };
    }

    // R7: append assistant text to session tree on clean stop
    if (outcome.status === 'stop') {
      this.tree.appendAssistant(runId, text);
    }

    return outcome;
  }
}
