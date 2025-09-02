import { useContext, useCallback } from 'react';
import { SettingsManagerContext } from '../contexts/ServiceProvider';
import { SettingsChangeHandler, HotkeysChangeHandler } from '@/types';
import { Setting, Hotkey } from '@/types/setting';

interface UseSettingsReturn {
  isLoading: boolean;
  settings: Setting;
  hotkeys: Hotkey[];
  setSettings: SettingsChangeHandler;
  setHotkeys: HotkeysChangeHandler;
}

export const useSettings = (): UseSettingsReturn => {
  const context = useContext(SettingsManagerContext);

  if (!context) {
    throw new Error('useSettings must be used within a SettingsManagerContext');
  }

  const updateSettings: SettingsChangeHandler = useCallback(
    async (path, value) => {
      return await context.updateSetting(path, value);
    },
    [context]
  );

  const updateHotkeys: HotkeysChangeHandler = useCallback(
    async (path, value) => {
      return await context.updateHotkey(path, value);
    },
    [context]
  );

  return {
    isLoading: !context.isInitialized,
    settings: context.getSettings(),
    hotkeys: context.getHotkeys(),
    setSettings: updateSettings,
    setHotkeys: updateHotkeys,
  };
};
