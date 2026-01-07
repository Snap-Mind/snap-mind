import { app, BrowserWindow } from 'electron';
import path from 'path';
import logService from './LogService';
// electron-updater is CommonJS; import compatibility handled below
import electronUpdater, { type AppUpdater } from 'electron-updater';

import { UpdateEvent } from '@/types/autoUpdate';

export interface AutoUpdateOptions {
  allowPrerelease: boolean;
  checkOnStartDelay: number; // seconds
  enabled: boolean;
}

const __rootdir = process.cwd();

export default class AutoUpdateService {
  private updater: AppUpdater | null = null;
  private initialized = false;
  private options: AutoUpdateOptions;
  private lastProgressEmit = 0;
  private currentStatus: UpdateEvent | { type: 'idle' } = { type: 'idle' };

  constructor(options: AutoUpdateOptions) {
    this.options = options;
  }

  init() {
    if (this.initialized) return;

    // Workaround for ESM compatibility as recommended by electron-builder docs
    const { autoUpdater } = electronUpdater as any;
    this.updater = autoUpdater as AppUpdater;

    this.updater.autoDownload = true;
    this.updater.allowPrerelease = this.options.allowPrerelease;
    // Enable update checks in development with dev-app-update.yml
    if (!app.isPackaged) {
      try {
        (this.updater as any).forceDevUpdateConfig = true;
        // When running from source, main is executed from dist-electron/main.js.
        // Use project root as CWD to locate dev-app-update.yml reliably.
        const devConfigPath = path.join(__rootdir, 'dev-app-update.yml');
        (this.updater as any).updateConfigPath = devConfigPath;
        logService.info('[update] dev mode: forceDevUpdateConfig enabled, path =', devConfigPath);
      } catch (e) {
        logService.warn('[update] dev mode: failed to enable forceDevUpdateConfig', e);
      }
    }
    // Let electron-builder manage feed (via app-update.yml)

    // Attach logger
    (this.updater as any).logger = logService.scope('update');

    this.registerEvents();
    this.initialized = true;

    if (this.options.enabled && this.options.checkOnStartDelay >= 0) {
      setTimeout(() => this.safeCheck(), this.options.checkOnStartDelay * 1000).unref();
    }
  }

  private registerEvents() {
    if (!this.updater) return;
    this.updater.on('checking-for-update', () => {
      logService.info('[update] checking for update');
      const evt: UpdateEvent = { type: 'checking' };
      this.currentStatus = evt;
      this.broadcast(evt);
    });
    this.updater.on('update-available', (info) => {
      logService.info('[update] update available', info?.version);
      const evt: UpdateEvent = { type: 'available', info };
      this.currentStatus = evt;
      this.broadcast(evt);
    });
    this.updater.on('update-not-available', (info) => {
      logService.info('[update] no update available');
      const evt: UpdateEvent = { type: 'not-available', info };
      this.currentStatus = evt;
      this.broadcast(evt);
    });
    this.updater.on('error', (err) => {
      logService.error('[update] error', err);
      // Show "not available" to UI instead of error message
      const evt: UpdateEvent = { type: 'not-available', info: {} };
      this.currentStatus = evt;
      this.broadcast(evt);
    });
    this.updater.on('download-progress', (p) => {
      const now = Date.now();
      if (now - this.lastProgressEmit < 500) return; // throttle
      this.lastProgressEmit = now;
      const evt: UpdateEvent = {
        type: 'download-progress',
        progress: {
          percent: p.percent,
          transferred: p.transferred,
          total: p.total,
          bytesPerSecond: p.bytesPerSecond,
        },
      };
      this.currentStatus = evt;
      this.broadcast(evt);
    });
    this.updater.on('update-downloaded', (info) => {
      logService.info('[update] update downloaded', info?.version);
      const evt: UpdateEvent = { type: 'downloaded', info };
      this.currentStatus = evt;
      this.broadcast(evt);
    });
  }

  private broadcast(evt: UpdateEvent) {
    BrowserWindow.getAllWindows().forEach((w) => {
      try {
        w.webContents.send('update:event', evt);
      } catch {
        /* ignore */
      }
    });
  }

  safeCheck() {
    if (!this.updater) return;
    try {
      this.updater.checkForUpdates().catch((e) => {
        logService.error('[update] checkForUpdates failed', e);
      });
    } catch (e) {
      logService.error('[update] unexpected check error', e);
    }
  }

  manualCheck() {
    if (!this.initialized) this.init();
    if (!this.updater) return { started: false, reason: 'init-failed' };
    this.safeCheck();
    return { started: true };
  }

  installNow() {
    if (!this.updater) return false;
    try {
      this.updater.quitAndInstall(false, true);
      return true;
    } catch (e) {
      logService.error('[update] quitAndInstall failed', e);
      return false;
    }
  }

  updatePrereleaseFlag(allow: boolean) {
    if (this.updater) {
      this.updater.allowPrerelease = allow;
      logService.info('[update] allowPrerelease set to', allow);
    }
  }

  getStatus(): UpdateEvent | { type: 'idle' } {
    return this.currentStatus;
  }
}
