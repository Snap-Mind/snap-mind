import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProvidersStore } from '../useProvidersStore';
import type { ProviderDTO } from '@/types/provider-dto';

const sample: ProviderDTO[] = [
  {
    id: 1,
    kind: 'openai',
    name: 'OpenAI',
    host: null,
    apiKey: null,
    description: null,
    models: [],
  },
];

function installApi() {
  const changedHandlers: ((list: ProviderDTO[]) => void)[] = [];
  (window as any).electronAPI = {
    providers: {
      list: vi.fn(async () => sample),
      create: vi.fn(async (input) => ({
        id: 2,
        models: [],
        host: null,
        apiKey: null,
        description: null,
        ...input,
      })),
      update: vi.fn(async (id, patch) => ({ ...sample[0], id, ...patch })),
      delete: vi.fn(async () => {}),
      onChanged: (cb: (list: ProviderDTO[]) => void) => changedHandlers.push(cb),
      offChanged: vi.fn(),
    },
    models: {
      upsert: vi.fn(async (_pid, m) => ({
        id: 10,
        type: null,
        capabilities: [],
        description: null,
        ...m,
      })),
      delete: vi.fn(async () => {}),
    },
  };
  return { changedHandlers };
}

beforeEach(() => {
  useProvidersStore.setState({ providers: [], isHydrated: false });
});

describe('useProvidersStore', () => {
  it('hydrates from providers.list and subscribes to changes', async () => {
    const { changedHandlers } = installApi();
    await useProvidersStore.getState().hydrate();
    expect(useProvidersStore.getState().providers).toEqual(sample);
    expect(useProvidersStore.getState().isHydrated).toBe(true);

    const next: ProviderDTO[] = [{ ...sample[0], name: 'Renamed' }];
    changedHandlers.forEach((h) => h(next));
    expect(useProvidersStore.getState().providers[0].name).toBe('Renamed');
  });

  it('createProvider calls the IPC', async () => {
    installApi();
    await useProvidersStore.getState().hydrate();
    await useProvidersStore.getState().createProvider({ kind: 'ollama', name: 'Local' });
    expect(window.electronAPI.providers.create).toHaveBeenCalledWith({
      kind: 'ollama',
      name: 'Local',
    });
  });
});
