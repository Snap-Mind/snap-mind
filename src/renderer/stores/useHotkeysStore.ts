import { create } from 'zustand';
import type { HotkeyDTO, UpdateHotkeyPatch } from '@/types/hotkey-dto';

export interface HotkeysStoreState {
  hotkeys: HotkeyDTO[];
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  updateHotkey: (id: number, patch: UpdateHotkeyPatch) => Promise<HotkeyDTO>;
}

export const useHotkeysStore = create<HotkeysStoreState>((set) => ({
  hotkeys: [],
  isHydrated: false,

  hydrate: async () => {
    const list = await window.electronAPI.hotkeys.list();
    set({ hotkeys: list, isHydrated: true });
    window.electronAPI.hotkeys.onChanged((next) => set({ hotkeys: next }));
  },

  updateHotkey: async (id, patch) => window.electronAPI.hotkeys.update(id, patch),
}));
