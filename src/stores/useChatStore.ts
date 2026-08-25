import { create } from 'zustand';
import type { StoreApi } from 'zustand';
import type { Message, ChatSource, ContentPart } from '@/types/chat';
import { AIService } from '@/services/AIService';
import { useAgentsStore } from './useAgentsStore';
import { useProvidersStore } from './useProvidersStore';
import { resolveAgent, agentErrorMessage, findBuiltinAgentId } from '@/services/agentResolver';
import type { AgentResolution } from '@/services/agentResolver';

export interface ImageAttachment {
  data: string;
  mimeType: string;
  name: string;
}

interface ChatInternalState {
  abortController: AbortController | null;
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

async function runAIRequest(
  res: Extract<AgentResolution, { ok: true }>,
  messages: Message[],
  onToken: (t: string) => void,
  onSources: (s: ChatSource[]) => void,
  signal: AbortSignal
): Promise<{ role: 'assistant'; content: string }> {
  const service = new AIService({
    provider: res.provider,
    model: res.model,
    params: {
      temperature: res.agent.temperature,
      maxTokens: res.agent.maxTokens,
      topP: res.agent.topP,
      reasoning: res.agent.reasoning,
      webSearch: res.agent.webSearch,
    },
  });
  return service.sendMessageToAI(messages, onToken, {
    signal,
    onWebSources: onSources,
  }) as unknown as { role: 'assistant'; content: string };
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

async function executeStreamingRequest(
  res: Extract<AgentResolution, { ok: true }>,
  set: ChatSet,
  messages: Message[],
  signal: AbortSignal,
  options: { onAbort?: 'append-system' | 'ignore' } = {}
): Promise<void> {
  const onAbort = options.onAbort ?? 'append-system';

  try {
    await runAIRequest(
      res,
      messages,
      (token) => appendTokenToLastAssistant(set, token),
      (sources) => attachSourcesToLastAssistant(set, sources),
      signal
    );
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      if (onAbort === 'append-system') {
        set((cur) => ({
          messages: [
            ...cur.messages,
            { role: 'system', content: 'Response is aborted.' } as Message,
          ],
        }));
      }
      return;
    }

    set((cur) => {
      const last = cur.messages.at(-1);
      const placeholder = last?.role === 'assistant' && last?.content === '';
      const base = placeholder ? cur.messages.slice(0, -1) : cur.messages;
      const detail = err instanceof Error ? err.message : String(err ?? '');
      return {
        messages: [
          ...base,
          { role: 'error', content: 'Failed to get response.', detail } as unknown as Message,
        ],
      };
    });
  }
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
  abortController: null,

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
  },

  abort: () => {
    const c = get().abortController;
    if (c) c.abort();
    set({ loading: false, abortController: null });
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

    const ctrl = new AbortController();
    set({ abortController: ctrl });

    try {
      await executeStreamingRequest(res, set, seeded, ctrl.signal, { onAbort: 'append-system' });
    } finally {
      set({ loading: false, abortController: null });
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

    const ctrl = new AbortController();
    set({
      loading: true,
      abortController: ctrl,
      messages: [...seeded, { role: 'assistant', content: '' } as Message],
    });

    try {
      await executeStreamingRequest(res, set, seeded, ctrl.signal, { onAbort: 'ignore' });
    } finally {
      set({ loading: false, abortController: null });
    }
  },
}));
