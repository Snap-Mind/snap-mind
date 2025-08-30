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

  // Helper to initialize or refresh SettingsManager
  const initializeSettingsManager = async (newSettings?: any) => {
    const manager = new SettingsManager(loggerService);
    if (newSettings) {
      manager.replaceSettings(newSettings); // Use new settings directly
      setSettingsManager(manager);
      setLoading(false);
    } else {
      await manager.initialize();
      setSettingsManager(manager);
      setLoading(false);
    }
  };

  useEffect(() => {
    initializeSettingsManager();

    // Listen for settings:updated event from main process
    if (window.electronAPI && window.electronAPI.onSettingsUpdated) {
      window.electronAPI.onSettingsUpdated((updatedSettings) => {
        loggerService.info('ServiceProvider received settings:updated event, refreshing context');
        initializeSettingsManager(updatedSettings); // Refresh context with new settings
      });
    }

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
