import { createContext, useEffect, useState, useMemo, ReactNode } from 'react';
import { Spinner } from '@heroui/react';
import { LoggerService } from '../services/LoggerService';
import { SettingsManager } from '../services/SettingsManager';

import { SystemPermission } from '@/types';
import { AutoUpdateManager } from '../services/AutoUpdateManager';

const LoggerServiceContext = createContext<LoggerService | null>(null);
const SettingsManagerContext = createContext<SettingsManager | null>(null);
const SystemPermissionsContext = createContext<SystemPermission[] | null>(null);
const AutoUpdateManagerContext = createContext<AutoUpdateManager | null>(null);

interface ServiceProviderProps {
  children: ReactNode;
}

const ServiceProvider = ({ children }: ServiceProviderProps) => {
  const loggerService = useMemo(() => new LoggerService(), []);
  const autoUpdateManager = useMemo(() => new AutoUpdateManager(), []);
  const [settingsManager, setSettingsManager] = useState<SettingsManager | null>(null);
  const [systemPermissions, setSystemPermissions] = useState<SystemPermission[] | null>(null);
  const [theme] = useState<'light' | 'dark'>(
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeManager = async () => {
      const manager = new SettingsManager(loggerService);
      await manager.initialize();

      setSettingsManager(manager);

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

    const initializeSystemPermissions = async () => {
      const permissions: SystemPermission[] = await window.electronAPI.checkPermission();
      setSystemPermissions(permissions);

      if (window.electronAPI && window.electronAPI.onPermissionChanged) {
        window.electronAPI.onPermissionChanged((changedPermissions) => {
          setSystemPermissions(changedPermissions);
        });
      }
    };

    // Async initializations
    Promise.all([initializeManager(), initializeSystemPermissions()]).finally(() => {
      setLoading(false);
    });

    // Sync initializations
    autoUpdateManager.initialize();

    // Cleanup listener on unmount
    return () => {
      autoUpdateManager.dispose();
      if (window.electronAPI) {
        if (window.electronAPI.offSettingsUpdated) {
          window.electronAPI.offSettingsUpdated();
        }
        if (window.electronAPI.offPermissionChanged) {
          window.electronAPI.offPermissionChanged();
        }
      }
    };
  }, [loggerService, autoUpdateManager]);

  return (
    <>
      {loading ? (
        <div
          className={`${theme === 'dark' ? 'dark' : ''} bg-background text-default h-screen w-full flex items-center justify-center`}
        >
          <Spinner variant="dots" size="lg" />
        </div>
      ) : (
        <LoggerServiceContext.Provider value={loggerService}>
          <SettingsManagerContext.Provider value={settingsManager}>
            <SystemPermissionsContext.Provider value={systemPermissions}>
              <AutoUpdateManagerContext.Provider value={autoUpdateManager}>
                {children}
              </AutoUpdateManagerContext.Provider>
            </SystemPermissionsContext.Provider>
          </SettingsManagerContext.Provider>
        </LoggerServiceContext.Provider>
      )}
    </>
  );
};

export {
  ServiceProvider,
  LoggerServiceContext,
  SettingsManagerContext,
  SystemPermissionsContext,
  AutoUpdateManagerContext,
};
