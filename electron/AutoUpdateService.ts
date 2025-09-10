import { app, BrowserWindow } from 'electron';
import logService from './LogService';
// electron-updater is CommonJS; import compatibility handled below
import electronUpdater, { type AppUpdater } from 'electron-updater';

// Thin wrapper class to manage auto update lifecycle.
export type UpdateEvent =
  | { type: 'checking' }
  | { type: 'available'; info: any }
  | { type: 'not-available'; info: any }
  | { type: 'error'; error: string }
  | {
      type: 'download-progress';
      progress: { percent: number; transferred: number; total: number; bytesPerSecond: number };
    }
  | { type: 'downloaded'; info: any };

export interface AutoUpdateOptions {
  allowPrerelease: boolean;
  checkOnStartDelay: number; // seconds
  enabled: boolean;
}

export default class AutoUpdateService {
  private updater: AppUpdater | null = null;
  private initialized = false;
  private options: AutoUpdateOptions;
  private lastProgressEmit = 0;

  constructor(options: AutoUpdateOptions) {
    this.options = options;
  }

  init() {
    if (this.initialized || !this.options.enabled) return;

    // Workaround for ESM compatibility as recommended by electron-builder docs
    const { autoUpdater } = electronUpdater as any;
    this.updater = autoUpdater as AppUpdater;

    this.updater.autoDownload = true;
    this.updater.allowPrerelease = this.options.allowPrerelease;
    // Let electron-builder manage feed (via app-update.yml)

    // Attach logger
    (this.updater as any).logger = logService.scope('update');

    this.registerEvents();
    this.initialized = true;

    if (this.options.checkOnStartDelay >= 0) {
      setTimeout(() => this.safeCheck(), this.options.checkOnStartDelay * 1000).unref();
    }
  }

  private registerEvents() {
    if (!this.updater) return;
    this.updater.on('checking-for-update', () => {
      logService.info('[update] checking for update');
      this.broadcast({ type: 'checking' });
    });
    this.updater.on('update-available', (info) => {
      logService.info('[update] update available', info?.version);
      this.broadcast({ type: 'available', info });
    });
    this.updater.on('update-not-available', (info) => {
      logService.info('[update] no update available');
      this.broadcast({ type: 'not-available', info });
    });
    this.updater.on('error', (err) => {
      logService.error('[update] error', err);
      this.broadcast({ type: 'error', error: err?.message || String(err) });
    });
    this.updater.on('download-progress', (p) => {
      const now = Date.now();
      if (now - this.lastProgressEmit < 500) return; // throttle
      this.lastProgressEmit = now;
      this.broadcast({
        type: 'download-progress',
        progress: {
          percent: p.percent,
          transferred: p.transferred,
          total: p.total,
          bytesPerSecond: p.bytesPerSecond,
        },
      });
    });
    this.updater.on('update-downloaded', (info) => {
      logService.info('[update] update downloaded', info?.version);
      this.broadcast({ type: 'downloaded', info });
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
    if (!this.updater) return { started: false, reason: 'not-initialized-or-disabled' };
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
}
