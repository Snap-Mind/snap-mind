import { create } from 'zustand';
import type { StoreApi } from 'zustand';
import type { Message, ChatSource, ContentPart } from '@/types/chat';
import { useAgentsStore } from './useAgentsStore';
import { useProvidersStore } from './useProvidersStore';
import { resolveAgent, agentErrorMessage, findBuiltinAgentId } from '@/services/agentResolver';
import type { AgentResolution } from '@/services/agentResolver';

export interface ImageAttachment {
  data: string;
  mimeType: string;
  name: string;
}

type StreamEnd = { kind: 'stop' } | { kind: 'aborted' } | { kind: 'error'; message: string };

interface ChatInternalState {
  streamId: string | null;
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

  setInput(v: string): void;
  addImages(files: File[]): Promise<void>;
  removeImage(i: number): void;
  clearImages(): void;
  setAutoScroll(v: boolean): void;
  setReasoning(v: boolean): void;
  setWebSearch(v: boolean): void;
  setActiveAgent(id: number | null): void;

  send(): Promise<void>;
  abort(): void;
  resetWithSeed(seed?: { text?: string; agentId?: number | null }): Promise<void>;
  hydrateFromSettings(): void;
}

type ChatSet = StoreApi<ChatStoreState>['setState'];

let aiListenersBound = false;
let currentStreamId: string | null = null;
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

function finishStreamWaiter(streamId: string, end: StreamEnd) {
  const resolve = streamWaiters.get(streamId);
  if (resolve) {
    streamWaiters.delete(streamId);
    resolve(end);
  }
}

function waitForStreamEnd(streamId: string): Promise<StreamEnd> {
  return new Promise((resolve) => {
    streamWaiters.set(streamId, resolve);
  });
}

function ensureAiListeners(set: ChatSet) {
  if (aiListenersBound) return;
  const api = window.electronAPI;
  if (!api?.onAiToken) return;
  aiListenersBound = true;

  api.onAiToken(({ streamId, text }) => {
    if (streamId !== currentStreamId) return;
    if (reasoningOpen) {
      reasoningOpen = false;
      appendTokenToLastAssistant(set, '</think>');
    }
    appendTokenToLastAssistant(set, text);
  });

  api.onAiReasoning(({ streamId, text }) => {
    if (streamId !== currentStreamId) return;
    if (!reasoningOpen) {
      reasoningOpen = true;
      appendTokenToLastAssistant(set, '<think>');
    }
    appendTokenToLastAssistant(set, text);
  });

  api.onAiSource(({ streamId, source }) => {
    if (streamId !== currentStreamId) return;
    attachSourcesToLastAssistant(set, [source]);
  });

  api.onAiDone(({ streamId, reason }) => {
    if (streamId !== currentStreamId) return;
    if (reasoningOpen) {
      reasoningOpen = false;
      appendTokenToLastAssistant(set, '</think>');
    }
    finishStreamWaiter(streamId, { kind: reason });
  });

  api.onAiError(({ streamId, message }) => {
    if (streamId !== currentStreamId) return;
    if (reasoningOpen) {
      reasoningOpen = false;
      appendTokenToLastAssistant(set, '</think>');
    }
    finishStreamWaiter(streamId, { kind: 'error', message });
  });
}

async function executeStreamingRequest(
  res: Extract<AgentResolution, { ok: true }>,
  set: ChatSet,
  messages: Message[],
  options: { onAbort?: 'append-system' | 'ignore' } = {}
): Promise<void> {
  const onAbort = options.onAbort ?? 'append-system';
  ensureAiListeners(set);
  reasoningOpen = false;

  const result = await window.electronAPI.aiSend({
    agentId: res.agent.id,
    messages: messages.filter((m) => m.role !== 'error'),
  });

  if ('error' in result) {
    pushErrorMessage(set, result.error.message);
    return;
  }

  const endPromise = waitForStreamEnd(result.streamId);
  currentStreamId = result.streamId;
  set({ streamId: result.streamId });

  const end = await endPromise;
  currentStreamId = null;
  set({ streamId: null });

  if (end.kind === 'error') {
    set((cur) => {
      const last = cur.messages.at(-1);
      const placeholder = last?.role === 'assistant' && last?.content === '';
      const base = placeholder ? cur.messages.slice(0, -1) : cur.messages;
      return {
        messages: [
          ...base,
          {
            role: 'error',
            content: 'Failed to get response.',
            detail: end.message,
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
}

export function __resetChatStreamStateForTests(): void {
  aiListenersBound = false;
  currentStreamId = null;
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
  streamId: null,

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

  setActiveAgent: (id) => set({ activeAgentId: id }),

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
    const id = get().streamId;
    if (id) void window.electronAPI?.aiAbort?.(id);
    set({ loading: false, streamId: null });
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

    try {
      await executeStreamingRequest(res, set, seeded, { onAbort: 'append-system' });
    } finally {
      set({ loading: false, streamId: null });
      currentStreamId = null;
    }
  },

  resetWithSeed: async (seed) => {
    get().abort();
    const agentId = seed?.agentId ?? get().activeAgentId ?? null;
    set({ messages: [], input: '', images: [], loading: false, activeAgentId: agentId });

    const agent = useAgentsStore.getState().agents.find((a) => a.id === agentId);
    set({
      reasoningEnabled: agent?.reasoning ?? false,
      webSearchEnabled: agent?.webSearch ?? false,
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

    try {
      await executeStreamingRequest(res, set, seeded, { onAbort: 'ignore' });
    } finally {
      set({ loading: false, streamId: null });
      currentStreamId = null;
    }
  },
}));
