import { createContext, useEffect, useState, useMemo, ReactNode } from 'react';
import { LoggerService } from '../services/LoggerService';
import { SettingsManager } from '../services/SettingsManager';

export const LoggerServiceContext = createContext<LoggerService | null>(null);
export const SettingsManagerContext = createContext<SettingsManager | null>(null);

interface ServiceProviderProps {
  children: ReactNode;
}

export const ServiceProvider = ({ children }: ServiceProviderProps) => {
  const loggerService = useMemo(() => new LoggerService(), []);
  const [settingsManager, setSettingsManager] = useState<SettingsManager | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeManager = async () => {
      const manager = new SettingsManager(loggerService);
      await manager.initialize();

      setSettingsManager(manager);
      setLoading(false);

      // Listen for settings:updated event from main process
      if (window.electronAPI && window.electronAPI.onSettingsUpdated) {
        window.electronAPI.onSettingsUpdated((updatedSettings) => {
          loggerService.info('ServiceProvider received settings:updated event, refreshing context');
          const newManager = new SettingsManager(loggerService);
          newManager.initialize({ settings: updatedSettings, hotkeys: manager.getHotkeys() });
          setSettingsManager(newManager);
          setLoading(false);
        });
      }
    };

    initializeManager();

    // Cleanup listener on unmount
    return () => {
      if (window.electronAPI && window.electronAPI.offSettingsUpdated) {
        window.electronAPI.offSettingsUpdated();
      }
    };
  }, [loggerService]);

  return (
    <>
      {loading ? (
        <>Loading...</>
      ) : (
        <LoggerServiceContext.Provider value={loggerService}>
          <SettingsManagerContext.Provider value={settingsManager}>
            {children}
          </SettingsManagerContext.Provider>
        </LoggerServiceContext.Provider>
      )}
    </>
  );
};
