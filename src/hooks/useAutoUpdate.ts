import { useContext, useEffect, useState } from 'react';
import { AutoUpdateManagerContext } from '@/contexts/ServiceProvider';
import { UpdateStatus } from '@/types/autoUpdate';

export const useAutoUpdate = () => {
  const manager = useContext(AutoUpdateManagerContext);
  if (!manager) throw new Error('useAutoUpdate must be used within ServiceProvider');

  const [status, setStatus] = useState<UpdateStatus>(manager.getStatus());

  useEffect(() => {
    const off = manager.onStatusChange(setStatus);
    return () => off();
  }, [manager]);

  return {
    status,
    checkForUpdates: () => manager.checkForUpdates(),
    installUpdateNow: () => manager.installUpdateNow(),
  };
};
