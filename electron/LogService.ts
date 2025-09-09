// LogService.js
// Centralized logging service using electron-log
import mainLog from 'electron-log/main.js';
import path from 'path';
import { app } from 'electron';
import os from 'os';
import fs from 'fs';
import process from 'process';

/**
 * LogService provides a centralized interface for logging in both main and renderer processes.
 * It uses electron-log under the hood, which automatically writes to the appropriate log files
 * depending on the platform.
 */
class LogService {
  private log: typeof mainLog;

  constructor() {
    this.log = mainLog;

    this.log.initialize({ preload: true });
    Object.assign(console, this.log.functions);
    this.configureLogger();
  }

  /**
   * Configure the logger settings
   */
  configureLogger() {
    // Set maximum log file size (10MB)
    this.log.transports.file.maxSize = 10 * 1024 * 1024;

    // Set log level (debug, info, warn, error)
    this.log.transports.file.level = 'info';

    // Format log messages with timestamp, level, and scope
    this.log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {scope} {text}';

    // Format console logs (only in development)
    if (!app.isPackaged) {
      this.log.transports.console.format = '[{level}] {scope} {text}';
      this.log.transports.console.level = 'debug';
    } else {
      // Disable console logs in production
      this.log.transports.console.level = false;
    }
  }

  /**
   * Get the path to the log directory
   * @returns {string} Log directory path
   */
  getLogPath() {
    return path.dirname(this.log.transports.file.getFile().path);
  }

  /**
   * Get list of log files
   * @returns {Array<string>} Array of log file paths
   */
  getLogFiles() {
    const logDir = this.getLogPath();
    try {
      return fs
        .readdirSync(logDir)
        .filter((file) => file.startsWith('main.log'))
        .map((file) => path.join(logDir, file));
    } catch (error) {
      this.error('Failed to get log files', error);
      return [];
    }
  }

  /**
   * Get the current log file
   * @returns {string} Path to the current log file
   */
  getCurrentLogFile() {
    return this.log.transports.file.getFile().path;
  }

  /**
   * Log a debug message
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments
   */
  debug(message, ...args) {
    this.log.debug(message, ...args);
  }

  /**
   * Log an info message
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments
   */
  info(message, ...args) {
    this.log.info(message, ...args);
  }

  /**
   * Log a warning message
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments
   */
  warn(message, ...args) {
    this.log.warn(message, ...args);
  }

  /**
   * Log an error message
   * @param {string} message - The message to log
   * @param {Error} [error] - Optional error object
   * @param {...any} args - Additional arguments
   */
  error(message, error, ...args) {
    if (error instanceof Error) {
      this.log.error(message, error.message, error.stack, ...args);
    } else {
      this.log.error(message, error, ...args);
    }
  }

  /**
   * Create a scoped logger
   * @param {string} scope - The scope name (e.g., component name)
   * @returns {Object} Scoped logger
   */
  scope(scope) {
    const scopedLogger = this.log.scope(scope);
    return {
      debug: (message, ...args) => scopedLogger.debug(message, ...args),
      info: (message, ...args) => scopedLogger.info(message, ...args),
      warn: (message, ...args) => scopedLogger.warn(message, ...args),
      error: (message, error, ...args) => {
        if (error instanceof Error) {
          scopedLogger.error(message, error.message, error.stack, ...args);
        } else {
          scopedLogger.error(message, error, ...args);
        }
      },
    };
  }

  /**
   * System information for diagnostics
   * @returns {Object} System info
   */
  getSystemInfo() {
    return {
      platform: process.platform,
      osVersion: os.release(),
      arch: process.arch,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron,
      appVersion: app.getVersion(),
      logPath: this.getLogPath(),
    };
  }

  /**
   * Log system information at startup
   */
  logSystemInfo() {
    const sysInfo = this.getSystemInfo();
    this.info('Application started');
    this.info(`Platform: ${sysInfo.platform}`);
    this.info(`OS Version: ${sysInfo.osVersion}`);
    this.info(`Architecture: ${sysInfo.arch}`);
    this.info(`Node.js: ${sysInfo.nodeVersion}`);
    this.info(`Electron: ${sysInfo.electronVersion}`);
    this.info(`App Version: ${sysInfo.appVersion}`);
    this.info(`Log file location: ${this.getCurrentLogFile()}`);
  }
}

// Create and export a singleton instance
const logService = new LogService();
export default logService;
