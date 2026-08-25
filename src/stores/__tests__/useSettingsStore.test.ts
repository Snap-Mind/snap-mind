import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Setting } from '@/types/setting';
import type { SystemPermission } from '@/types';

// Mock the electronAPI surface the store consumes.
type IPC = {
  getSettings: ReturnType<typeof vi.fn>;
  checkPermission: ReturnType<typeof vi.fn>;
  updateSetting: ReturnType<typeof vi.fn>;
  onSettingsUpdated: ReturnType<typeof vi.fn>;
  offSettingsUpdated: ReturnType<typeof vi.fn>;
  onPermissionChanged: ReturnType<typeof vi.fn>;
  offPermissionChanged: ReturnType<typeof vi.fn>;
};

const seedSettings: Setting = {
  general: { language: 'en', clipboardEnabled: true, azureApiKey: 'secret-plain' },
  appearance: { theme: 'light' },
  chat: {
    temperature: 0.7,
    max_tokens: 2048,
    top_p: 0.95,
    streamingEnabled: true,
    reasoningEnabled: false,
    webSearchEnabled: false,
    defaultModelId: 1,
    defaultProviderId: 1,
  },
};

const seedPermissions: SystemPermission[] = [
  { id: 'accessibility', name: 'Accessibility', isGranted: true } as unknown as SystemPermission,
];

function installIPC(overrides: Partial<IPC> = {}): IPC {
  const ipc: IPC = {
    getSettings: vi.fn(async () => JSON.parse(JSON.stringify(seedSettings))),
    checkPermission: vi.fn(async () => seedPermissions),
    updateSetting: vi.fn(async (_p, _v) => ({ success: true, setting: seedSettings })),
    onSettingsUpdated: vi.fn(),
    offSettingsUpdated: vi.fn(),
    onPermissionChanged: vi.fn(),
    offPermissionChanged: vi.fn(),
    ...overrides,
  };
  (globalThis as any).window = (globalThis as any).window ?? {};
  (globalThis as any).window.electronAPI = ipc;
  return ipc;
}

// Fresh store per test to avoid state leaking.
async function freshStore() {
  vi.resetModules();
  const mod = await import('../useSettingsStore');
  // Reset the store between tests (zustand instances share state across imports otherwise).
  mod.useSettingsStore.setState(mod.useSettingsStore.getInitialState(), true);
  return mod.useSettingsStore;
}

describe('useSettingsStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('hydrates from settings and permissions IPCs and flips isHydrated', async () => {
    installIPC();
    const store = await freshStore();
    expect(store.getState().isHydrated).toBe(false);

    await store.getState().hydrate();

    const s = store.getState();
    expect(s.isHydrated).toBe(true);
    expect(s.settings.chat.defaultModelId).toBe(1);
    expect(s.permissions[0].isGranted).toBe(true);
  });

  it('scrubs general.azureApiKey during hydrate', async () => {
    installIPC();
    const store = await freshStore();

    await store.getState().hydrate();

    expect(store.getState().settings.general.azureApiKey).toBe('');
  });

  it('subscribes to settings:updated and permission:changed during hydrate', async () => {
    const ipc = installIPC();
    const store = await freshStore();

    await store.getState().hydrate();

    expect(ipc.onSettingsUpdated).toHaveBeenCalledTimes(1);
    expect(ipc.onPermissionChanged).toHaveBeenCalledTimes(1);
  });

  it('updateSetting is optimistic and writes through IPC', async () => {
    const ipc = installIPC({
      updateSetting: vi.fn(async () => ({ success: true, setting: seedSettings })),
    });
    const store = await freshStore();
    await store.getState().hydrate();

    const promise = store.getState().updateSetting(['appearance', 'theme'], 'dark');
    // Optimistic update visible before await resolves.
    expect(store.getState().settings.appearance.theme).toBe('dark');
    await promise;
    expect(ipc.updateSetting).toHaveBeenCalledWith(['appearance', 'theme'], 'dark');
  });

  it('updateSetting optimistically sets defaultProviderId', async () => {
    installIPC();
    const store = await freshStore();
    await store.getState().hydrate();

    await store.getState().updateSetting(['chat', 'defaultProviderId'], 3);
    expect(store.getState().settings.chat.defaultProviderId).toBe(3);
  });

  it('updateSetting reverts optimistic write on IPC rejection', async () => {
    const ipc = installIPC({
      updateSetting: vi.fn(async () => ({ success: false, error: 'boom' })),
    });
    const store = await freshStore();
    await store.getState().hydrate();
    const before = store.getState().settings.appearance.theme;

    await expect(store.getState().updateSetting(['appearance', 'theme'], 'dark')).rejects.toThrow(
      /boom/
    );

    expect(store.getState().settings.appearance.theme).toBe(before);
    expect(ipc.updateSetting).toHaveBeenCalledOnce();
  });

  it('_applyRemoteSettings scrubs azureApiKey on remote updates too', async () => {
    installIPC();
    const store = await freshStore();
    await store.getState().hydrate();

    store.getState()._applyRemoteSettings({
      ...seedSettings,
      general: { ...seedSettings.general, azureApiKey: 'new-secret' },
    } as unknown as Setting);

    expect(store.getState().settings.general.azureApiKey).toBe('');
  });
});
