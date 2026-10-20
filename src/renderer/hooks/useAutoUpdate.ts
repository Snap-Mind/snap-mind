import { useEffect, useState } from 'react';
import { autoUpdateManager } from '@/services/auto-update-manager';
import { UpdateStatus } from '@/types/autoUpdate';

export const useAutoUpdate = () => {
  const [status, setStatus] = useState<UpdateStatus>(autoUpdateManager.getStatus());

  useEffect(() => {
    const off = autoUpdateManager.onStatusChange(setStatus);
    return () => off();
  }, []);

  return {
    status,
    checkForUpdates: () => autoUpdateManager.checkForUpdates(),
    installUpdateNow: () => autoUpdateManager.installUpdateNow(),
  };
};
