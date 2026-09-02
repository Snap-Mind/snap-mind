import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useHotkeysStore } from '../useHotkeysStore';
import type { HotkeyDTO } from '@/types/hotkey-dto';

const sample: HotkeyDTO[] = [
  { id: 1, accelerator: 'CommandOrControl+`', mode: 'chat', agentId: 1, enabled: true },
  {
    id: 2,
    accelerator: 'CommandOrControl+Shift+T',
    mode: 'selection',
    agentId: null,
    enabled: false,
  },
];

function installApi() {
  const changedHandlers: ((list: HotkeyDTO[]) => void)[] = [];
  (window as any).electronAPI = {
    hotkeys: {
      list: vi.fn(async () => sample),
      update: vi.fn(async (id, patch) => ({ ...sample[1], id, ...patch })),
      onChanged: (cb: (list: HotkeyDTO[]) => void) => changedHandlers.push(cb),
      offChanged: vi.fn(),
    },
  };
  return { changedHandlers };
}

beforeEach(() => {
  useHotkeysStore.setState({ hotkeys: [], isHydrated: false });
});

describe('useHotkeysStore', () => {
  it('hydrates and subscribes to changes', async () => {
    const { changedHandlers } = installApi();
    await useHotkeysStore.getState().hydrate();
    expect(useHotkeysStore.getState().hotkeys).toEqual(sample);
    expect(useHotkeysStore.getState().isHydrated).toBe(true);

    changedHandlers.forEach((h) => h([{ ...sample[1], enabled: true }]));
    expect(useHotkeysStore.getState().hotkeys[0].enabled).toBe(true);
  });

  it('updateHotkey passes id and patch to the IPC', async () => {
    installApi();
    await useHotkeysStore.getState().hydrate();
    await useHotkeysStore.getState().updateHotkey(2, { agentId: 7, enabled: true });
    expect(window.electronAPI.hotkeys.update).toHaveBeenCalledWith(2, {
      agentId: 7,
      enabled: true,
    });
  });
});
