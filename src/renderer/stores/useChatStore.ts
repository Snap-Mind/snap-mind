import { create } from 'zustand';
import type { StoreApi } from 'zustand';
import type { Message, ChatSource, ContentPart } from '@/types/chat';
import { useAgentsStore } from './useAgentsStore';
import { useProvidersStore } from './useProvidersStore';
import { resolveAgent, agentErrorMessage, findBuiltinAgentId } from '@/services/agent-resolver';
import type { AgentResolution } from '@/services/agent-resolver';
import { applyAiEvent, settleRunningParts } from './apply-ai-event';
import type { AiStreamEvent } from './apply-ai-event';

export interface ImageAttachment {
  data: string;
  mimeType: string;
  name: string;
}

type StreamEnd = { kind: 'stop' } | { kind: 'aborted' } | { kind: 'error'; message: string };

interface ChatInternalState {
  runId: string | null;
}

export interface ChatStoreState extends ChatInternalState {
  messages: Message[];
  input: string;
  images: ImageAttachment[];
  loading: boolean;
  autoScroll: boolean;
  reasoningEnabled: boolean;
  webSearchEnabled: boolean;
  activeAgentId: number | null;
  loopEnabled: boolean;

  setInput(v: string): void;
  addImages(files: File[]): Promise<void>;
  removeImage(i: number): void;
  clearImages(): void;
  setAutoScroll(v: boolean): void;
  setReasoning(v: boolean): void;
  setWebSearch(v: boolean): void;
  setActiveAgent(id: number | null): void;
  setLoopEnabled(v: boolean): void;

  send(): Promise<void>;
  abort(): void;
  resetWithSeed(seed?: { text?: string; agentId?: number | null }): Promise<void>;
  hydrateFromSettings(): void;
}

type ChatSet = StoreApi<ChatStoreState>['setState'];

let aiListenersBound = false;
let currentRunId: string | null = null;
// Bumped by every new request (and by resetWithSeed); a continuation whose sequence number is
// no longer current belongs to a superseded run and must not touch the store.
let requestSeq = 0;
let reasoningOpen = false;
const streamWaiters = new Map<string, (end: StreamEnd) => void>();

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

function readFileAsBase64(file: File): Promise<ImageAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve({ data: base64, mimeType: file.type, name: file.name });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function resolveActiveAgent(agentId: number | null): AgentResolution {
  return resolveAgent(
    agentId,
    useAgentsStore.getState().agents,
    useProvidersStore.getState().providers
  );
}

function pushErrorMessage(set: ChatSet, message: string) {
  set((cur) => ({
    messages: [...cur.messages, { role: 'error', content: message } as unknown as Message],
  }));
}

function appendTokenToLastAssistant(set: ChatSet, token: string) {
  set((cur) => {
    const msgs = [...cur.messages];
    const last = msgs.length - 1;
    if (last >= 0 && msgs[last].role === 'assistant') {
      msgs[last] = { ...msgs[last], content: (msgs[last].content as string) + token };
    }
    return { messages: msgs };
  });
}

function attachSourcesToLastAssistant(set: ChatSet, sources: ChatSource[]) {
  set((cur) => {
    const msgs = [...cur.messages];
    const last = msgs.length - 1;
    if (last >= 0 && msgs[last].role === 'assistant') {
      msgs[last] = { ...msgs[last], sources } as Message;
    }
    return { messages: msgs };
  });
}

function finishStreamWaiter(runId: string, end: StreamEnd) {
  const resolve = streamWaiters.get(runId);
  if (resolve) {
    streamWaiters.delete(runId);
    resolve(end);
  }
}

function waitForStreamEnd(runId: string): Promise<StreamEnd> {
  return new Promise((resolve) => {
    streamWaiters.set(runId, resolve);
  });
}

function ensureAiListeners(set: ChatSet) {
  if (aiListenersBound) return;
  const api = window.electronAPI;
  if (!api?.onAiToken) return;
  aiListenersBound = true;

  api.onAiToken((e) => {
    if (e.parentRunId !== null) {
      if (currentRunId) {
        const ev: AiStreamEvent = { kind: 'token', e };
        set((cur) => ({ messages: applyAiEvent(cur.messages, currentRunId!, ev) }));
      }
      return;
    }
    if (e.runId !== currentRunId) return;
    if (reasoningOpen) {
      reasoningOpen = false;
      appendTokenToLastAssistant(set, '</think>');
    }
    appendTokenToLastAssistant(set, e.text);
  });

  api.onAiReasoning((e) => {
    if (e.parentRunId !== null) return;
    if (e.runId !== currentRunId) return;
    if (!reasoningOpen) {
      reasoningOpen = true;
      appendTokenToLastAssistant(set, '<think>');
    }
    appendTokenToLastAssistant(set, e.text);
  });

  api.onAiSource((e) => {
    if (e.parentRunId !== null) return;
    if (e.runId !== currentRunId) return;
    attachSourcesToLastAssistant(set, [e.source]);
  });

  api.onAiDone((e) => {
    if (e.parentRunId !== null) {
      if (currentRunId) {
        const ev: AiStreamEvent = { kind: 'done', e };
        set((cur) => ({ messages: applyAiEvent(cur.messages, currentRunId!, ev) }));
      }
      return;
    }
    if (e.runId === currentRunId && reasoningOpen) {
      reasoningOpen = false;
      appendTokenToLastAssistant(set, '</think>');
    }
    // Resolve even superseded runs so their continuations unwind (they bail out as stale).
    finishStreamWaiter(e.runId, { kind: e.reason });
  });

  api.onAiError((e) => {
    if (e.parentRunId !== null) {
      if (currentRunId) {
        const ev: AiStreamEvent = { kind: 'error', e };
        set((cur) => ({ messages: applyAiEvent(cur.messages, currentRunId!, ev) }));
      }
      return;
    }
    if (e.runId === currentRunId && reasoningOpen) {
      reasoningOpen = false;
      appendTokenToLastAssistant(set, '</think>');
    }
    finishStreamWaiter(e.runId, { kind: 'error', message: e.message });
  });

  api.onAiToolCall?.((e) => {
    if (!currentRunId) return;
    const ev: AiStreamEvent = { kind: 'tool-call', e };
    set((cur) => ({ messages: applyAiEvent(cur.messages, currentRunId!, ev) }));
  });

  api.onAiApprovalRequest?.((e) => {
    if (!currentRunId) return;
    const ev: AiStreamEvent = { kind: 'approval-request', e };
    set((cur) => ({ messages: applyAiEvent(cur.messages, currentRunId!, ev) }));
  });

  api.onAiToolResult?.((e) => {
    if (!currentRunId) return;
    const ev: AiStreamEvent = { kind: 'tool-result', e };
    set((cur) => ({ messages: applyAiEvent(cur.messages, currentRunId!, ev) }));
  });
}

/** Supersede any in-flight request: its late events and its continuation are ignored. */
function invalidateCurrentRequest(): void {
  requestSeq++;
  currentRunId = null;
  reasoningOpen = false;
}

async function executeStreamingRequest(
  res: Extract<AgentResolution, { ok: true }>,
  set: ChatSet,
  messages: Message[],
  options: { onAbort?: 'append-system' | 'ignore'; loopEnabled?: boolean } = {}
): Promise<void> {
  const { onAbort = 'append-system', loopEnabled = false } = options;
  ensureAiListeners(set);
  invalidateCurrentRequest();
  const seq = requestSeq;
  const isCurrent = () => seq === requestSeq;

  try {
    const result = await window.electronAPI.aiSend({
      agentId: res.agent.id,
      messages: messages.filter((m) => m.role !== 'error'),
      loopEnabled,
    });

    if (!isCurrent()) {
      // A newer request (or a reset) took over while this one was starting; nobody listens.
      if (!('error' in result)) void window.electronAPI.aiAbort?.(result.runId);
      return;
    }

    if ('error' in result) {
      pushErrorMessage(set, result.error.message);
      return;
    }

    const endPromise = waitForStreamEnd(result.runId);
    currentRunId = result.runId;
    set({ runId: result.runId });

    const end = await endPromise;
    if (!isCurrent()) return;
    currentRunId = null;
    // Nothing on this turn can progress any more: a worker whose done was lost or arrives after
    // the root's, or an approval left pending, must not spin forever.
    set((cur) => ({ runId: null, messages: settleRunningParts(cur.messages) }));

    if (end.kind === 'error') {
      // The provider wording is the headline; extra lines go into the collapsible detail.
      const [headline, ...rest] = end.message.split('\n');
      const detail = rest.join('\n').trim();
      set((cur) => {
        const last = cur.messages.at(-1);
        // Only drop a truly empty placeholder; a turn that delegated keeps its tool parts.
        const placeholder =
          last?.role === 'assistant' && last?.content === '' && !last.parts?.length;
        const base = placeholder ? cur.messages.slice(0, -1) : cur.messages;
        return {
          messages: [
            ...base,
            {
              role: 'error',
              content: headline.trim() || 'Failed to get response.',
              detail: detail || undefined,
            } as unknown as Message,
          ],
        };
      });
      return;
    }

    if (end.kind === 'aborted' && onAbort === 'append-system') {
      set((cur) => ({
        messages: [...cur.messages, { role: 'system', content: 'Response is aborted.' } as Message],
      }));
    }
  } finally {
    if (isCurrent()) {
      currentRunId = null;
      set({ loading: false, runId: null });
    }
  }
}

export function __resetChatStreamStateForTests(): void {
  aiListenersBound = false;
  currentRunId = null;
  requestSeq = 0;
  reasoningOpen = false;
  streamWaiters.clear();
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  messages: [],
  input: '',
  images: [],
  loading: false,
  autoScroll: true,
  reasoningEnabled: false,
  webSearchEnabled: false,
  activeAgentId: null,
  loopEnabled: false,
  runId: null,

  setInput: (v) => set({ input: v }),

  addImages: async (files) => {
    const imageFiles = files.filter(isImageFile);
    if (!imageFiles.length) return;
    const attachments = await Promise.all(imageFiles.map(readFileAsBase64));
    set((s) => ({ images: [...s.images, ...attachments] }));
  },

  removeImage: (i) => set((s) => ({ images: s.images.filter((_, idx) => idx !== i) })),
  clearImages: () => set({ images: [] }),
  setAutoScroll: (v) => set({ autoScroll: v }),

  setLoopEnabled: (v) => set({ loopEnabled: v }),

  setActiveAgent: (id) => {
    const agent = useAgentsStore.getState().agents.find((a) => a.id === id);
    set({ activeAgentId: id, loopEnabled: agent?.isBuiltin ?? false });
  },

  setReasoning: (v) => {
    set({ reasoningEnabled: v });
    const id = get().activeAgentId;
    if (id != null) void useAgentsStore.getState().updateAgent(id, { reasoning: v });
  },

  setWebSearch: (v) => {
    set({ webSearchEnabled: v });
    const id = get().activeAgentId;
    if (id != null) void useAgentsStore.getState().updateAgent(id, { webSearch: v });
  },

  hydrateFromSettings: () => {
    const builtinId = findBuiltinAgentId(useAgentsStore.getState().agents);
    const agent = useAgentsStore.getState().agents.find((a) => a.id === builtinId);
    set({
      activeAgentId: builtinId,
      reasoningEnabled: agent?.reasoning ?? false,
      webSearchEnabled: agent?.webSearch ?? false,
      loopEnabled: agent?.isBuiltin ?? false,
    });

    window.electronAPI?.chat?.onResetWithSeed?.((seed) => {
      void useChatStore.getState().resetWithSeed(seed ?? {});
    });
    window.electronAPI?.chat?.onAbort?.(() => {
      useChatStore.getState().abort();
    });
    ensureAiListeners(set);
  },

  abort: () => {
    const id = get().runId;
    if (id) void window.electronAPI?.aiAbort?.(id);
    set({ loading: false, runId: null });
  },

  send: async () => {
    const s = get();
    if (s.loading) return;
    const trimmed = s.input.trim();
    if (!trimmed && s.images.length === 0) return;

    let content: string | ContentPart[];
    if (s.images.length > 0) {
      const parts: ContentPart[] = [];
      if (trimmed) parts.push({ type: 'text', text: trimmed });
      for (const img of s.images) {
        parts.push({ type: 'image', data: img.data, mimeType: img.mimeType });
      }
      content = parts;
    } else {
      content = trimmed;
    }

    const userMsg: Message = { role: 'user', content };
    const next = [...s.messages, userMsg];

    const res = resolveActiveAgent(s.activeAgentId);
    if (res.ok === false) {
      set({ messages: next, input: '', images: [] });
      pushErrorMessage(set, agentErrorMessage(res));
      return;
    }

    const seeded =
      res.agent.instructions.trim().length > 0 && s.messages.length === 0
        ? [{ role: 'system', content: res.agent.instructions } as Message, ...next]
        : next;

    set({
      messages: [...seeded, { role: 'assistant', content: '' } as Message],
      input: '',
      images: [],
      loading: true,
    });

    // executeStreamingRequest clears loading/runId itself, but only while it is still the
    // current request, so a superseded run never resets state that belongs to a newer one.
    await executeStreamingRequest(res, set, seeded, {
      onAbort: 'append-system',
      loopEnabled: get().loopEnabled,
    });
  },

  resetWithSeed: async (seed) => {
    get().abort();
    // The aborted run's late events and continuation must not touch the reset chat.
    invalidateCurrentRequest();
    const agentId = seed?.agentId ?? get().activeAgentId ?? null;
    set({ messages: [], input: '', images: [], loading: false, activeAgentId: agentId });

    const agent = useAgentsStore.getState().agents.find((a) => a.id === agentId);
    set({
      reasoningEnabled: agent?.reasoning ?? false,
      webSearchEnabled: agent?.webSearch ?? false,
      loopEnabled: agent?.isBuiltin ?? false,
    });

    if (!seed?.text) return;

    const res = resolveActiveAgent(agentId);
    if (res.ok === false) {
      pushErrorMessage(set, agentErrorMessage(res));
      return;
    }

    const seeded: Message[] = [];
    if (res.agent.instructions.trim().length > 0) {
      seeded.push({ role: 'system', content: res.agent.instructions } as Message);
    }
    seeded.push({ role: 'user', content: seed.text } as Message);

    set({
      loading: true,
      messages: [...seeded, { role: 'assistant', content: '' } as Message],
    });

    await executeStreamingRequest(res, set, seeded, {
      onAbort: 'ignore',
      loopEnabled: get().loopEnabled,
    });
  },
}));
