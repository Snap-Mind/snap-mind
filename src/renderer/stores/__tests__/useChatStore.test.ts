import { beforeEach, describe, expect, it, vi } from 'vitest';

type AiHandlers = {
  onToken?: (payload: {
    runId: string;
    parentRunId: string | null;
    parentToolCallId: string | null;
    text: string;
  }) => void;
  onDone?: (payload: {
    runId: string;
    parentRunId: string | null;
    parentToolCallId: string | null;
    reason: 'stop' | 'aborted';
  }) => void;
  onError?: (payload: {
    runId: string;
    parentRunId: string | null;
    parentToolCallId: string | null;
    message: string;
  }) => void;
  onToolCall?: (payload: {
    runId: string;
    parentRunId: string | null;
    parentToolCallId: string | null;
    toolCallId: string;
    toolName: string;
    input: unknown;
  }) => void;
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
    const runId = 's1';
    setTimeout(() => {
      aiHandlers.onToken?.({ runId, parentRunId: null, parentToolCallId: null, text: 'Hello' });
      aiHandlers.onDone?.({ runId, parentRunId: null, parentToolCallId: null, reason: 'stop' });
    }, 0);
    return { runId };
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
    onAiError: (cb: AiHandlers['onError']) => {
      aiHandlers.onError = cb;
    },
    offAiError: vi.fn(),
    onAiToolCall: (cb: AiHandlers['onToolCall']) => {
      aiHandlers.onToolCall = cb;
    },
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
      loopEnabled: false,
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

  it('send() shows the provider error text and drops the empty assistant bubble', async () => {
    const { chat } = await freshStores();
    aiSendMock.mockImplementation(async () => {
      setTimeout(() => {
        aiHandlers.onError?.({
          runId: 's1',
          parentRunId: null,
          parentToolCallId: null,
          message: 'HTTP 410: Gone\n{"error":"model not found"}',
        });
      }, 0);
      return { runId: 's1' };
    });

    chat.getState().setActiveAgent(1);
    chat.getState().setInput('hi');
    await chat.getState().send();

    const msgs = chat.getState().messages;
    expect(msgs.at(-1)).toMatchObject({
      role: 'error',
      content: 'HTTP 410: Gone',
      detail: '{"error":"model not found"}',
    });
    expect(msgs.some((m) => m.role === 'assistant')).toBe(false);
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
    chat.setState({ loading: true, runId: 's1' } as any);

    chat.getState().abort();

    expect(window.electronAPI.aiAbort).toHaveBeenCalledWith('s1');
    expect(chat.getState().loading).toBe(false);
  });

  it('loopEnabled defaults true for builtin agent and false otherwise', async () => {
    const { chat } = await freshStores();
    chat.getState().hydrateFromSettings();
    expect(chat.getState().loopEnabled).toBe(true); // agent 1 is builtin

    chat.getState().setActiveAgent(2); // agent 2 is not builtin
    expect(chat.getState().loopEnabled).toBe(false);
  });

  it('send passes loopEnabled to aiSend', async () => {
    const { chat } = await freshStores();
    chat.getState().setActiveAgent(1);
    chat.setState({ loopEnabled: true } as any);
    chat.getState().setInput('hi');
    await chat.getState().send();

    expect(aiSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        loopEnabled: true,
      })
    );
  });

  it('ignores token events whose runId is not current', async () => {
    const { chat } = await freshStores();

    aiSendMock.mockImplementation(async () => {
      const runId = 'current-run';
      setTimeout(() => {
        // Fire a stale runId token first — should be ignored
        aiHandlers.onToken?.({
          runId: 'stale-run',
          parentRunId: null,
          parentToolCallId: null,
          text: 'stale text',
        });
        // Fire the current runId token — should be appended
        aiHandlers.onToken?.({
          runId,
          parentRunId: null,
          parentToolCallId: null,
          text: 'valid text',
        });
        aiHandlers.onDone?.({ runId, parentRunId: null, parentToolCallId: null, reason: 'stop' });
      }, 0);
      return { runId };
    });

    chat.getState().setActiveAgent(1);
    chat.getState().setInput('hi');
    await chat.getState().send();

    const msgs = chat.getState().messages;
    const assistant = msgs.find((m) => m.role === 'assistant');
    expect(assistant?.content).toBe('valid text');
    expect(assistant?.content).not.toContain('stale text');
  });
  function rootRef(runId: string) {
    return { runId, parentRunId: null, parentToolCallId: null };
  }

  function invokeAgentCall(runId: string) {
    aiHandlers.onToolCall?.({
      ...rootRef(runId),
      toolCallId: 'tc-agent',
      toolName: 'invoke_agent',
      input: { agentId: 2, prompt: 'translate this' },
    });
  }

  it('root done while a subRun is still running leaves the subRun aborted', async () => {
    const { chat } = await freshStores();
    aiSendMock.mockImplementation(async () => {
      setTimeout(() => {
        invokeAgentCall('s1');
        aiHandlers.onToken?.({
          runId: 'child-1',
          parentRunId: 's1',
          parentToolCallId: 'tc-agent',
          text: 'partial',
        });
        // Root done overtakes the child's done(aborted).
        aiHandlers.onDone?.({ ...rootRef('s1'), reason: 'aborted' });
      }, 0);
      return { runId: 's1' };
    });

    chat.getState().setActiveAgent(1);
    chat.getState().setInput('hi');
    await chat.getState().send();

    // The child's done arrives after the root run has ended and is dropped by the store.
    aiHandlers.onDone?.({
      runId: 'child-1',
      parentRunId: 's1',
      parentToolCallId: 'tc-agent',
      reason: 'aborted',
    });

    const assistant = chat.getState().messages.find((m) => m.role === 'assistant')!;
    expect(assistant.parts![0].subRun).toMatchObject({ text: 'partial', status: 'aborted' });
  });

  it('provider error after delegating keeps the assistant turn with its parts', async () => {
    const { chat } = await freshStores();
    aiSendMock.mockImplementation(async () => {
      setTimeout(() => {
        invokeAgentCall('s1');
        aiHandlers.onError?.({ ...rootRef('s1'), message: 'HTTP 500: boom' });
      }, 0);
      return { runId: 's1' };
    });

    chat.getState().setActiveAgent(1);
    chat.getState().setInput('hi');
    await chat.getState().send();

    const msgs = chat.getState().messages;
    const assistant = msgs.find((m) => m.role === 'assistant');
    expect(assistant).toBeDefined();
    expect(assistant!.parts).toHaveLength(1);
    expect(assistant!.parts![0].subRun!.status).toBe('aborted');
    expect(msgs.at(-1)).toMatchObject({ role: 'error', content: 'HTTP 500: boom' });
  });

  it('a stale run ending after a newer send does not touch the new run', async () => {
    const { chat } = await freshStores();
    aiSendMock.mockImplementationOnce(async () => ({ runId: 'A' }));
    aiSendMock.mockImplementationOnce(async () => ({ runId: 'B' }));

    chat.getState().setActiveAgent(1);
    chat.getState().setInput('first');
    const sendA = chat.getState().send();
    await vi.waitFor(() => expect(chat.getState().runId).toBe('A'));

    chat.getState().abort(); // user presses Stop; A's done(aborted) has not arrived yet
    chat.getState().setInput('second');
    const sendB = chat.getState().send();
    await vi.waitFor(() => expect(chat.getState().runId).toBe('B'));

    aiHandlers.onDone?.({ ...rootRef('A'), reason: 'aborted' });
    await sendA;

    const msgs = chat.getState().messages;
    expect(msgs.at(-1)).toEqual({ role: 'assistant', content: '' });
    expect(msgs.some((m) => m.content === 'Response is aborted.')).toBe(false);
    expect(chat.getState().loading).toBe(true);
    expect(chat.getState().runId).toBe('B');

    aiHandlers.onToken?.({ ...rootRef('B'), text: 'B answer' });
    aiHandlers.onDone?.({ ...rootRef('B'), reason: 'stop' });
    await sendB;
    expect(chat.getState().messages.at(-1)).toMatchObject({
      role: 'assistant',
      content: 'B answer',
    });
    expect(chat.getState().loading).toBe(false);
  });

  it('a stale run ending while a newer send is starting does not touch the new run', async () => {
    const { chat } = await freshStores();
    aiSendMock.mockImplementationOnce(async () => ({ runId: 'A' }));
    aiSendMock.mockImplementationOnce(async () => {
      // A's done(aborted) lands while B's aiSend round-trip is still in flight.
      aiHandlers.onDone?.({ ...rootRef('A'), reason: 'aborted' });
      await Promise.resolve();
      return { runId: 'B' };
    });

    chat.getState().setActiveAgent(1);
    chat.getState().setInput('first');
    const sendA = chat.getState().send();
    await vi.waitFor(() => expect(chat.getState().runId).toBe('A'));

    chat.getState().abort();
    chat.getState().setInput('second');
    const sendB = chat.getState().send();
    await sendA;
    await vi.waitFor(() => expect(chat.getState().runId).toBe('B'));

    const msgs = chat.getState().messages;
    expect(msgs.at(-1)).toEqual({ role: 'assistant', content: '' });
    expect(msgs.some((m) => m.content === 'Response is aborted.')).toBe(false);
    expect(chat.getState().loading).toBe(true);

    aiHandlers.onDone?.({ ...rootRef('B'), reason: 'stop' });
    await sendB;
    expect(chat.getState().loading).toBe(false);
  });
});
