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
    const init = async () => {
      const settingsManager = new SettingsManager(loggerService);
      await settingsManager.initialize();
      setSettingsManager(settingsManager);
      setLoading(false);
    };

    init();
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
