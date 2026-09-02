import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAgentsStore } from '../useAgentsStore';
import type { AgentDTO } from '@/types/agent-dto';

const sample: AgentDTO[] = [
  {
    id: 1,
    name: 'Default',
    description: null,
    instructions: '',
    providerId: null,
    modelId: null,
    isBuiltin: true,
  },
];

function installApi() {
  const changedHandlers: ((list: AgentDTO[]) => void)[] = [];
  (window as any).electronAPI = {
    agents: {
      list: vi.fn(async () => sample),
      create: vi.fn(async (input) => ({
        id: 2,
        description: null,
        instructions: '',
        providerId: null,
        modelId: null,
        isBuiltin: false,
        ...input,
      })),
      update: vi.fn(async (id, patch) => ({ ...sample[0], id, ...patch })),
      delete: vi.fn(async () => {}),
      onChanged: (cb: (list: AgentDTO[]) => void) => changedHandlers.push(cb),
      offChanged: vi.fn(),
    },
  };
  return { changedHandlers };
}

beforeEach(() => {
  useAgentsStore.setState({ agents: [], isHydrated: false });
});

describe('useAgentsStore', () => {
  it('hydrates from agents.list and subscribes to changes', async () => {
    const { changedHandlers } = installApi();
    await useAgentsStore.getState().hydrate();
    expect(useAgentsStore.getState().agents).toEqual(sample);
    expect(useAgentsStore.getState().isHydrated).toBe(true);

    changedHandlers.forEach((h) => h([{ ...sample[0], instructions: 'Be terse.' }]));
    expect(useAgentsStore.getState().agents[0].instructions).toBe('Be terse.');
  });

  it('createAgent and updateAgent call the IPC', async () => {
    installApi();
    await useAgentsStore.getState().hydrate();
    await useAgentsStore.getState().createAgent({ name: 'Translate' });
    expect(window.electronAPI.agents.create).toHaveBeenCalledWith({ name: 'Translate' });

    await useAgentsStore.getState().updateAgent(1, { temperature: 0.4 });
    expect(window.electronAPI.agents.update).toHaveBeenCalledWith(1, { temperature: 0.4 });
  });
});
