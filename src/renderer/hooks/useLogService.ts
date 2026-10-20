import loggerService, { LoggerService } from '../services/logger-service';

export const useLogService = (): LoggerService => loggerService;
