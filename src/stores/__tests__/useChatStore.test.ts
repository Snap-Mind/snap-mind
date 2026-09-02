import { beforeEach, describe, expect, it, vi } from 'vitest';

type AiHandlers = {
  onToken?: (payload: { streamId: string; text: string }) => void;
  onDone?: (payload: { streamId: string; reason: 'stop' | 'aborted' }) => void;
};

let aiHandlers: AiHandlers = {};
let aiSendMock = vi.fn();

const seedSettings = {};

const seedAgents = [
  {
    id: 1,
    name: 'Default',
    description: null,
    instructions: '',
    providerId: 1,
    modelId: 10,
    isBuiltin: true,
  },
  {
    id: 2,
    name: 'Translate',
    description: null,
    instructions: 'translate:',
    providerId: 1,
    modelId: 10,
    temperature: 0.2,
    isBuiltin: false,
  },
];

const seedProviders = [
  {
    id: 1,
    kind: 'openai',
    name: 'OpenAI',
    apiKey: 'k',
    host: 'x',
    description: null,
    models: [
      {
        id: 10,
        modelId: 'gpt-4',
        name: 'GPT-4',
        type: 'chat',
        capabilities: ['chat'],
        description: null,
      },
    ],
  },
];

function setupElectronApi() {
  aiHandlers = {};
  aiSendMock = vi.fn(async () => {
    const streamId = 's1';
    setTimeout(() => {
      aiHandlers.onToken?.({ streamId, text: 'Hello' });
      aiHandlers.onDone?.({ streamId, reason: 'stop' });
    }, 0);
    return { streamId };
  });

  (globalThis as any).window.electronAPI = {
    updateSetting: vi.fn(async () => ({ success: true })),
    aiSend: aiSendMock,
    aiAbort: vi.fn(async () => ({ ok: true })),
    onAiToken: (cb: AiHandlers['onToken']) => {
      aiHandlers.onToken = cb;
    },
    offAiToken: vi.fn(),
    onAiReasoning: vi.fn(),
    offAiReasoning: vi.fn(),
    onAiSource: vi.fn(),
    offAiSource: vi.fn(),
    onAiDone: (cb: AiHandlers['onDone']) => {
      aiHandlers.onDone = cb;
    },
    offAiDone: vi.fn(),
    onAiError: vi.fn(),
    offAiError: vi.fn(),
  };
}

async function freshStores() {
  vi.resetModules();
  setupElectronApi();
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
  const agentsMod = await import('../useAgentsStore');
  agentsMod.useAgentsStore.setState({ agents: seedAgents as any, isHydrated: true });
  const chatMod = await import('../useChatStore');
  chatMod.__resetChatStreamStateForTests();
  chatMod.useChatStore.setState(chatMod.useChatStore.getInitialState(), true);
  return {
    chat: chatMod.useChatStore,
    settings: settingsMod.useSettingsStore,
    agents: agentsMod,
  };
}

describe('useChatStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).window = (globalThis as any).window ?? {};
  });

  it('resetWithSeed({}) clears state without kicking off AI', async () => {
    const { chat } = await freshStores();
    chat.setState({ messages: [{ role: 'user', content: 'old' } as any], input: 'draft' });

    await chat.getState().resetWithSeed({});

    expect(chat.getState().messages).toEqual([]);
    expect(chat.getState().input).toBe('');
    expect(chat.getState().loading).toBe(false);
  });

  it('resetWithSeed({text, agentId}) seeds the agent instructions and calls aiSend', async () => {
    const { chat } = await freshStores();
    await chat.getState().resetWithSeed({ text: 'foo', agentId: 2 });

    const messages = chat.getState().messages;
    expect(messages[0]).toEqual({ role: 'system', content: 'translate:' });
    expect(messages[1]).toEqual({ role: 'user', content: 'foo' });
    expect(chat.getState().activeAgentId).toBe(2);

    expect(aiSendMock).toHaveBeenCalledWith({
      agentId: 2,
      messages: [
        { role: 'system', content: 'translate:' },
        { role: 'user', content: 'foo' },
      ],
    });
  });

  it('resetWithSeed with no text sets the agent and clears the session without sending', async () => {
    const { chat } = await freshStores();
    const before = aiSendMock.mock.calls.length;
    await chat.getState().resetWithSeed({ agentId: 1 });

    expect(chat.getState().messages).toEqual([]);
    expect(chat.getState().activeAgentId).toBe(1);
    expect(aiSendMock.mock.calls.length).toBe(before);
  });

  it('renders an error message when the hotkey has no agent', async () => {
    const { chat } = await freshStores();
    await chat.getState().resetWithSeed({ text: 'foo', agentId: null });

    const last = chat.getState().messages.at(-1)!;
    expect(last.role).toBe('error');
    expect(last.content).toMatch(/Settings > Hotkeys/);
  });

  it('renders an error message when the active agent is unbound', async () => {
    const { chat, agents } = await freshStores();
    agents.useAgentsStore.setState({
      agents: [{ ...seedAgents[1], providerId: null, modelId: null }] as any,
      isHydrated: true,
    });
    await chat.getState().resetWithSeed({ text: 'foo', agentId: 2 });

    const last = chat.getState().messages.at(-1)!;
    expect(last.role).toBe('error');
    expect(last.content).toMatch(/Translate/);
  });

  it('setWebSearch persists to the active agent', async () => {
    const updateAgent = vi.fn(async () => ({}) as any);
    const { chat, agents } = await freshStores();
    agents.useAgentsStore.setState({ updateAgent } as any);

    chat.getState().setActiveAgent(2);
    chat.getState().setWebSearch(true);

    expect(updateAgent).toHaveBeenCalledWith(2, { webSearch: true });
  });

  it('send() appends user + assistant messages and clears input', async () => {
    const { chat } = await freshStores();
    chat.getState().setActiveAgent(1);
    chat.getState().setInput('hi');
    await chat.getState().send();

    const msgs = chat.getState().messages;
    expect(msgs[0]).toMatchObject({ role: 'user', content: 'hi' });
    expect(msgs.at(-1)).toMatchObject({ role: 'assistant', content: 'Hello' });
    expect(chat.getState().input).toBe('');
    expect(chat.getState().loading).toBe(false);
  });

  it('setReasoning persists to the active agent', async () => {
    const updateAgent = vi.fn(async () => ({}) as any);
    const { chat, agents } = await freshStores();
    agents.useAgentsStore.setState({ updateAgent } as any);

    chat.getState().setActiveAgent(2);
    chat.getState().setReasoning(true);

    expect(updateAgent).toHaveBeenCalledWith(2, { reasoning: true });
  });

  it('abort() calls aiAbort and clears loading', async () => {
    const { chat } = await freshStores();
    chat.setState({ loading: true, streamId: 's1' } as any);

    chat.getState().abort();

    expect(window.electronAPI.aiAbort).toHaveBeenCalledWith('s1');
    expect(chat.getState().loading).toBe(false);
  });
});
