import log from 'electron-log/renderer';

type Logger = typeof log;

export class LoggerService {
  private log: Logger;

  constructor() {
    this.log = log;

    // Override console with electron-log
    Object.assign(console, log.functions);
  }

  debug(message, ...args) {
    this.log.debug(message, ...args);
  }

  info(message, ...args) {
    this.log.info(message, ...args);
  }

  warn(message, ...args) {
    this.log.warn(message, ...args);
  }

  error(message, error, ...args) {
    if (error instanceof Error) {
      this.log.error(message, error.message, error.stack, ...args);
    } else {
      this.log.error(message, error, ...args);
    }
  }

  async getLogPath() {
    if (window.electronAPI && window.electronAPI.getLogPath) {
      return await window.electronAPI.getLogPath();
    }
    return null;
  }

  async openLogFile() {
    if (window.electronAPI && window.electronAPI.openLogFile) {
      return await window.electronAPI.openLogFile();
    }
    return false;
  }
}

const loggerService = new LoggerService();
export default loggerService;
