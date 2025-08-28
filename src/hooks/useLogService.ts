import { useContext } from 'react';
import { LoggerServiceContext } from '../contexts/ServiceProvider';
import { LoggerService } from '../services/LoggerService';

export const useLogService = (): LoggerService => {
  const context = useContext(LoggerServiceContext);
  if (context === null) {
    throw new Error('useLogService must be used within a LoggerServiceProvider');
  }
  return context;
};
