import type { Message, ToolPart, SubRun, ToolPartState } from '@/types/chat';
import type {
  AiTokenEvent,
  AiDoneEvent,
  AiErrorEvent,
  AiToolCallEvent,
  AiApprovalRequestEvent,
  AiToolResultEvent,
} from '@/types/ai-ipc';

export type AiStreamEvent =
  | { kind: 'token'; e: AiTokenEvent }
  | { kind: 'done'; e: AiDoneEvent }
  | { kind: 'error'; e: AiErrorEvent }
  | { kind: 'tool-call'; e: AiToolCallEvent }
  | { kind: 'approval-request'; e: AiApprovalRequestEvent }
  | { kind: 'tool-result'; e: AiToolResultEvent };

function findPartWithSubRun(
  messages: Message[],
  toolCallId: string
): { msgIdx: number; partIdx: number } | null {
  for (let mi = messages.length - 1; mi >= 0; mi--) {
    const parts = messages[mi].parts;
    if (!parts) continue;
    for (let pi = 0; pi < parts.length; pi++) {
      if (parts[pi].toolCallId === toolCallId && parts[pi].subRun !== undefined) {
        return { msgIdx: mi, partIdx: pi };
      }
    }
  }
  return null;
}

function findPartByCallId(
  messages: Message[],
  toolCallId: string
): { msgIdx: number; partIdx: number } | null {
  for (let mi = messages.length - 1; mi >= 0; mi--) {
    const parts = messages[mi].parts;
    if (!parts) continue;
    for (let pi = 0; pi < parts.length; pi++) {
      if (parts[pi].toolCallId === toolCallId) {
        return { msgIdx: mi, partIdx: pi };
      }
    }
  }
  return null;
}

function updatePart(
  messages: Message[],
  msgIdx: number,
  partIdx: number,
  updater: (part: ToolPart) => ToolPart
): Message[] {
  const msgs = [...messages];
  const msg = msgs[msgIdx];
  const parts = [...(msg.parts ?? [])];
  parts[partIdx] = updater(parts[partIdx]);
  msgs[msgIdx] = { ...msg, parts };
  return msgs;
}

function newSubRun(toolName: string, input: unknown): SubRun | undefined {
  if (toolName !== 'invoke_agent') return undefined;
  const agentId = (input as Record<string, unknown> | undefined)?.agentId;
  if (typeof agentId !== 'number') return undefined;
  return { runId: '', agentId, text: '', status: 'running' };
}

function newToolPart(
  toolCallId: string,
  toolName: string,
  input: unknown,
  state: ToolPartState
): ToolPart {
  const part: ToolPart = { type: 'tool', toolCallId, toolName, input, state };
  const subRun = newSubRun(toolName, input);
  if (subRun) part.subRun = subRun;
  return part;
}

function appendPart(messages: Message[], msgIdx: number, part: ToolPart): Message[] {
  const msgs = [...messages];
  const msg = msgs[msgIdx];
  msgs[msgIdx] = { ...msg, parts: [...(msg.parts ?? []), part] };
  return msgs;
}

/**
 * Called when the root run ends. Anything still in flight on the last assistant message can
 * no longer progress: a running sub-run is marked aborted (its own done event may be lost or
 * arrive after the root's), and a pending approval is resolved as an error so no card is left
 * waiting. Returns the same reference when nothing needs settling.
 */
export function settleRunningParts(messages: Message[]): Message[] {
  let idx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      idx = i;
      break;
    }
  }
  if (idx === -1) return messages;
  const parts = messages[idx].parts;
  if (!parts?.length) return messages;

  let changed = false;
  const nextParts = parts.map((part) => {
    const pendingApproval = part.state === 'approval-requested';
    const runningSubRun = part.subRun?.status === 'running';
    if (!pendingApproval && !runningSubRun) return part;
    changed = true;
    const next: ToolPart = { ...part };
    if (pendingApproval) {
      next.state = 'output-error';
      next.output = 'Run ended before approval.';
    }
    if (runningSubRun) next.subRun = { ...part.subRun!, status: 'aborted' };
    return next;
  });
  if (!changed) return messages;

  const msgs = [...messages];
  msgs[idx] = { ...messages[idx], parts: nextParts };
  return msgs;
}

export function applyAiEvent(messages: Message[], rootRunId: string, ev: AiStreamEvent): Message[] {
  const { kind } = ev;
  const e = ev.e as any; // union discriminated by kind; cast to access fields generically

  // (a) Child path: parentRunId === rootRunId
  if (e.parentRunId === rootRunId) {
    // Child tool events are ignored in v1
    if (kind === 'tool-call' || kind === 'approval-request' || kind === 'tool-result') {
      return messages;
    }
    const loc = findPartWithSubRun(messages, e.parentToolCallId);
    if (!loc) return messages;

    if (kind === 'token') {
      return updatePart(messages, loc.msgIdx, loc.partIdx, (part) => {
        const subRun: SubRun = { ...part.subRun! };
        subRun.text += e.text;
        if (subRun.runId === '') subRun.runId = e.runId;
        return { ...part, subRun };
      });
    }
    if (kind === 'done') {
      return updatePart(messages, loc.msgIdx, loc.partIdx, (part) => {
        const subRun: SubRun = {
          ...part.subRun!,
          status: e.reason === 'aborted' ? 'aborted' : 'done',
        };
        return { ...part, subRun };
      });
    }
    if (kind === 'error') {
      return updatePart(messages, loc.msgIdx, loc.partIdx, (part) => {
        const subRun: SubRun = { ...part.subRun!, status: 'error', error: e.message };
        return { ...part, subRun };
      });
    }
    return messages;
  }

  // (b) Root tool path: parentRunId === null && runId === rootRunId
  if (e.parentRunId === null && e.runId === rootRunId) {
    // Root token/done/error stay on today's store paths — no change here
    if (kind === 'token' || kind === 'done' || kind === 'error') {
      return messages;
    }

    // Find the last assistant message
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        lastAssistantIdx = i;
        break;
      }
    }
    if (lastAssistantIdx === -1) return messages;

    const loc = findPartByCallId(messages, e.toolCallId);

    if (kind === 'tool-call') {
      // Upsert: approval-request / tool-result may have arrived first and created the part.
      if (loc) {
        return updatePart(messages, loc.msgIdx, loc.partIdx, (part) => {
          const next: ToolPart = { ...part, toolName: e.toolName, input: e.input };
          if (!part.subRun) {
            const subRun = newSubRun(e.toolName, e.input);
            // If the result already landed, the worker is finished — never start it as running.
            if (subRun && part.state === 'output-available') subRun.status = 'done';
            if (subRun && part.state === 'output-error') {
              subRun.status = 'error';
              subRun.error = String(part.output);
            }
            if (subRun) next.subRun = subRun;
          }
          return next;
        });
      }
      return appendPart(
        messages,
        lastAssistantIdx,
        newToolPart(e.toolCallId, e.toolName, e.input, 'input-available')
      );
    }

    if (kind === 'approval-request') {
      if (!loc) {
        // The approval can overtake its tool-call; create the part so the card renders.
        const part = newToolPart(e.toolCallId, e.toolName, e.input, 'approval-requested');
        part.requestId = e.requestId;
        return appendPart(messages, lastAssistantIdx, part);
      }
      return updatePart(messages, loc.msgIdx, loc.partIdx, (part) => ({
        ...part,
        state: 'approval-requested' as const,
        requestId: e.requestId,
      }));
    }

    if (kind === 'tool-result') {
      const state: ToolPartState = e.isError ? 'output-error' : 'output-available';
      const settle = (part: ToolPart): ToolPart => {
        const next: ToolPart = { ...part, state, output: e.output };
        // The worker may never have started (bad agentId, schema failure) or its own
        // done/error may be lost; the root result is authoritative for a still-running subRun.
        if (part.subRun?.status === 'running') {
          next.subRun = e.isError
            ? { ...part.subRun, status: 'error', error: String(e.output) }
            : { ...part.subRun, status: 'done' };
        }
        return next;
      };
      if (!loc) {
        return appendPart(
          messages,
          lastAssistantIdx,
          settle(newToolPart(e.toolCallId, e.toolName, undefined, state))
        );
      }
      return updatePart(messages, loc.msgIdx, loc.partIdx, settle);
    }

    return messages;
  }

  // (c) Anything else — stale run, return same reference
  return messages;
}
