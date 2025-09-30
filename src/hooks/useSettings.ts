import { useContext, useCallback, useState } from 'react';
import { SettingsManagerContext, SystemPermissionsContext } from '../contexts/ServiceProvider';
import { SettingsChangeHandler, HotkeysChangeHandler, SystemPermission } from '@/types';
import { Setting, Hotkey } from '@/types/setting';

interface UseSettingsReturn {
  isLoading: boolean;
  settings: Setting;
  hotkeys: Hotkey[];
  permissions: SystemPermission[];
  setSettings: SettingsChangeHandler;
  setHotkeys: HotkeysChangeHandler;
}

export const useSettings = (): UseSettingsReturn => {
  const settingsContext = useContext(SettingsManagerContext);
  const systemPermissionsContext = useContext(SystemPermissionsContext);

  if (!settingsContext) {
    throw new Error('useSettings must be used within a SettingsManagerContext');
  }

  if (!systemPermissionsContext) {
    throw new Error('useSettings must be used within a SystemPermissionsContext');
  }

  // Local reactive snapshots (minimal change approach). External code is responsible for any global sync.
  const [settingsState, setSettingsState] = useState<Setting>(() => settingsContext.getSettings());
  const [hotkeysState, setHotkeysState] = useState<Hotkey[]>(() => settingsContext.getHotkeys());

  const updateSettings: SettingsChangeHandler = useCallback(
    async (path, value) => {
      const updated = await settingsContext.updateSetting(path, value);
      setSettingsState(updated);
      return updated;
    },
    [settingsContext]
  );

  const updateHotkeys: HotkeysChangeHandler = useCallback(
    async (path, value) => {
      const updated = await settingsContext.updateHotkey(path, value);
      setHotkeysState(updated as Hotkey[]); // underlying returns Hotkey[]
      return updated;
    },
    [settingsContext]
  );

  return {
    isLoading: !settingsContext.isInitialized,
    settings: settingsState,
    hotkeys: hotkeysState,
    permissions: systemPermissionsContext,
    setSettings: updateSettings,
    setHotkeys: updateHotkeys,
  };
};
