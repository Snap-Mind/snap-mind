import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/AIService', () => {
  class AIService {
    static instances: AIService[] = [];
    lastCall: any = null;
    constructor(public settings: any) {
      AIService.instances.push(this);
    }
    async sendMessageToAI(messages: any[], onToken: (t: string) => void, opts: any) {
      this.lastCall = { messages, opts };
      onToken('Hello');
      return { role: 'assistant', content: 'Hello' };
    }
  }
  return { AIService };
});

const seedSettings = {
  chat: {
    temperature: 0.7,
    max_tokens: 2048,
    top_p: 0.95,
    streamingEnabled: true,
    reasoningEnabled: false,
    webSearchEnabled: false,
    defaultModelId: 10,
    defaultProviderId: 1,
  },
};

const seedProviders = [
  {
    id: 1,
    kind: 'openai',
    name: 'OpenAI',
    apiKey: 'k',
    host: 'x',
    description: null,
    models: [{ id: 10, modelId: 'gpt-4', name: 'GPT-4', type: 'chat', capabilities: ['chat'], description: null }],
  },
];

async function freshStores() {
  vi.resetModules();
  const settingsMod = await import('../useSettingsStore');
  settingsMod.useSettingsStore.setState(
    {
      ...settingsMod.useSettingsStore.getInitialState(),
      settings: seedSettings as any,
      isHydrated: true,
    },
    true
  );
  const providersMod = await import('../useProvidersStore');
  providersMod.useProvidersStore.setState(
    {
      ...providersMod.useProvidersStore.getInitialState(),
      providers: seedProviders as any,
      isHydrated: true,
    },
    true
  );
  const chatMod = await import('../useChatStore');
  chatMod.useChatStore.setState(chatMod.useChatStore.getInitialState(), true);
  return { chat: chatMod.useChatStore, settings: settingsMod.useSettingsStore };
}

describe('useChatStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).window = (globalThis as any).window ?? {};
    (globalThis as any).window.electronAPI = {
      updateSetting: vi.fn(async () => ({ success: true })),
    };
  });

  it('resetWithSeed({}) clears state without kicking off AI', async () => {
    const { chat } = await freshStores();
    chat.setState({ messages: [{ role: 'user', content: 'old' } as any], input: 'draft' });

    await chat.getState().resetWithSeed({});

    expect(chat.getState().messages).toEqual([]);
    expect(chat.getState().input).toBe('');
    expect(chat.getState().loading).toBe(false);
  });

  it('resetWithSeed({text, prompt}) seeds and calls AIService', async () => {
    const { chat } = await freshStores();
    const { AIService } = await import('@/services/AIService');

    await chat.getState().resetWithSeed({ text: 'foo', prompt: 'translate:' });

    const msgs = chat.getState().messages;
    expect(msgs[0]).toMatchObject({ role: 'system', content: 'translate:' });
    expect(msgs[1]).toMatchObject({ role: 'user', content: 'foo' });
    expect((AIService as any).instances.length).toBeGreaterThan(0);
  });

  it('send() appends user + assistant messages and clears input', async () => {
    const { chat } = await freshStores();
    chat.getState().setInput('hi');
    await chat.getState().send();

    const msgs = chat.getState().messages;
    expect(msgs[0]).toMatchObject({ role: 'user', content: 'hi' });
    expect(msgs.at(-1)).toMatchObject({ role: 'assistant', content: 'Hello' });
    expect(chat.getState().input).toBe('');
    expect(chat.getState().loading).toBe(false);
  });

  it('setReasoning mirrors to settings store via IPC', async () => {
    const { chat, settings } = await freshStores();
    const spy = window.electronAPI.updateSetting as any;

    chat.getState().setReasoning(true);

    expect(spy).toHaveBeenCalledWith(['chat', 'reasoningEnabled'], true);
    expect(chat.getState().reasoningEnabled).toBe(true);
    expect(settings.getState().settings.chat.reasoningEnabled).toBe(true);
  });

  it('setModel writes both defaultProviderId and defaultModelId to settings', async () => {
    const { chat, settings } = await freshStores();
    const spy = window.electronAPI.updateSetting as any;

    chat.getState().setModel(2, 20);

    expect(spy).toHaveBeenCalledWith(['chat', 'defaultProviderId'], 2);
    expect(spy).toHaveBeenCalledWith(['chat', 'defaultModelId'], 20);
    expect(chat.getState().currentProviderId).toBe(2);
    expect(chat.getState().currentModelId).toBe(20);
    expect(settings.getState().settings.chat.defaultProviderId).toBe(2);
    expect(settings.getState().settings.chat.defaultModelId).toBe(20);
  });

  it('abort() sets loading false and marks controller aborted', async () => {
    const { chat } = await freshStores();
    const ctrl = new AbortController();
    chat.setState({ loading: true, abortController: ctrl } as any);

    chat.getState().abort();

    expect(ctrl.signal.aborted).toBe(true);
    expect(chat.getState().loading).toBe(false);
  });
});
