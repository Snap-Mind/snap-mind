import { create } from 'zustand';
import type { Setting, Hotkey, ModelSetting } from '@/types/setting';
import type { SystemPermission } from '@/types';

type SettingValue = string | number | boolean | ModelSetting[];

export interface SettingsStoreState {
  settings: Setting;
  hotkeys: Hotkey[];
  permissions: SystemPermission[];
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  updateSetting: (path: (string | number)[], value: unknown) => Promise<void>;
  updateHotkey: (path: (string | number)[], value: unknown) => Promise<void>;
  updateSettings: (next: Setting) => Promise<void>;

  _applyRemoteSettings: (next: Setting) => void;
  _applyRemotePermissions: (next: SystemPermission[]) => void;
}

const EMPTY_SETTINGS: Setting = {} as unknown as Setting;

function scrubSecrets(s: Setting): Setting {
  // Providers (incl. apiKeys) live in SQLite as of Phase 2 and are not part of `settings`.
  // Only the legacy general.azureApiKey scrub remains.
  if (s?.general && (s.general as any).azureApiKey) {
    return {
      ...s,
      general: { ...s.general, azureApiKey: '' } as Setting['general'],
    };
  }
  return s;
}

function setImmutable(obj: any, path: (string | number)[], value: unknown): any {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (typeof head === 'number') {
    const arr = Array.isArray(obj) ? obj.slice() : [];
    while (arr.length <= head) arr.push(undefined);
    arr[head] = setImmutable(arr[head], rest, value);
    return arr;
  }
  const base = obj && typeof obj === 'object' && !Array.isArray(obj) ? { ...obj } : {};
  base[head] = setImmutable(base?.[head], rest, value);
  return base;
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  settings: EMPTY_SETTINGS,
  hotkeys: [],
  permissions: [],
  isHydrated: false,

  hydrate: async () => {
    const api = window.electronAPI;
    const [settings, hotkeys, permissions] = await Promise.all([
      api.getSettings(),
      api.getHotkeys(),
      api.checkPermission(),
    ]);

    set({
      settings: scrubSecrets(settings as Setting),
      hotkeys: hotkeys as Hotkey[],
      permissions: (permissions ?? []) as SystemPermission[],
      isHydrated: true,
    });

    api.onSettingsUpdated?.((next: Setting) => {
      get()._applyRemoteSettings(next);
    });
    api.onPermissionChanged?.((next: SystemPermission[]) => {
      get()._applyRemotePermissions(next);
    });
  },

  updateSetting: async (path, value) => {
    const prev = get().settings;
    const optimistic = setImmutable(prev, path, value) as Setting;
    set({ settings: scrubSecrets(optimistic) });

    try {
      const res = await window.electronAPI.updateSetting(path, value as SettingValue);
      if (res && res.success === false) {
        set({ settings: prev });
        throw new Error((res as { error?: string }).error || 'settings:update-path failed');
      }
    } catch (err) {
      set({ settings: prev });
      throw err;
    }
  },

  updateHotkey: async (path, value) => {
    const prev = get().hotkeys;
    const optimistic = setImmutable(prev, path, value) as Hotkey[];
    set({ hotkeys: optimistic });

    try {
      const res = await window.electronAPI.updateHotkey(path, value as SettingValue);
      if (res && res.success === false) {
        set({ hotkeys: prev });
        throw new Error((res as { error?: string }).error || 'hotkeys:update-path failed');
      }
      if (res && Array.isArray(res.hotkeys)) {
        set({ hotkeys: res.hotkeys as Hotkey[] });
      }
    } catch (err) {
      set({ hotkeys: prev });
      throw err;
    }
  },

  updateSettings: async (next) => {
    const prev = get().settings;
    set({ settings: scrubSecrets(next) });
    try {
      const res = await window.electronAPI.updateSettings(next);
      if (res && res.success === false) {
        set({ settings: prev });
        throw new Error((res as { error?: string }).error || 'settings:update failed');
      }
    } catch (err) {
      set({ settings: prev });
      throw err;
    }
  },

  _applyRemoteSettings: (next) => set({ settings: scrubSecrets(next) }),
  _applyRemotePermissions: (next) => set({ permissions: next }),
}));
