import { app, BrowserWindow, ipcMain, shell } from 'electron';

import type SettingsService from './SettingsService.js';
import type ThemeService from './ThemeService.js';
import type OpenAtLoginService from './OpenAtLoginService.js';
import type AutoUpdateService from './AutoUpdateService.js';
import type { ProvidersService } from './ProvidersService.js';
import logService from './LogService.js';
import SystemPermissionService from './SystemPermissionService.js';

export interface IpcHandlerContext {
  getMainWindow: () => BrowserWindow | null;
  settingsService: SettingsService;
  themeService: ThemeService;
  openAtLoginService: OpenAtLoginService;
  getProvidersService: () => ProvidersService;
  getAutoUpdateService: () => AutoUpdateService | null;
  registerHotkeys: () => void;
  showMainWindow: () => void;
  getAppRootDir: () => string;
}

export function registerIpcHandlers(ctx: IpcHandlerContext): void {
  const {
    getMainWindow,
    settingsService,
    themeService,
    openAtLoginService,
    getProvidersService,
    getAutoUpdateService,
    registerHotkeys,
    showMainWindow,
    getAppRootDir,
  } = ctx;

  const broadcastProvidersChanged = async () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('providers:changed', await getProvidersService().list());
    }
  };

  ipcMain.on('window:hide', () => {
    const win = getMainWindow();
    if (win && !win.isDestroyed() && win.isVisible()) {
      win.hide();
    }
  });

  ipcMain.on('app:quit', () => {
    app.isQuitting = true;
    BrowserWindow.getAllWindows().forEach((win) => win.destroy());
    app.quit();
    app.exit(0);
  });

  ipcMain.handle('hotkeys:get', () => settingsService.getHotkeys());

  ipcMain.handle('hotkeys:update', async (_event, newHotkeys) => {
    if (!Array.isArray(newHotkeys) || newHotkeys.length === 0) {
      logService.error('[ipc] Invalid hotkeys format received:', newHotkeys);
      return { success: false, error: 'Invalid hotkeys format' };
    }

    const updated = await settingsService.updateHotkeys(newHotkeys);
    registerHotkeys();
    return { success: true, hotkeys: updated };
  });

  ipcMain.handle('hotkeys:update-path', async (_event, { path: hotkeyPath, value }) => {
    try {
      const updated = await settingsService.updateHotkey(hotkeyPath, value);
      registerHotkeys();
      return { success: true, hotkeys: updated };
    } catch (error) {
      logService.error('[ipc] Failed to update hotkey:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('settings:get', () => settingsService.getSettings());

  ipcMain.handle('settings:update', async (event, newSettings) => {
    try {
      const beta = !!newSettings?.general?.autoUpdate?.betaChannel;
      getAutoUpdateService()?.updatePrereleaseFlag(beta);

      const updated = await settingsService.updateSettings(newSettings);
      themeService.applyNativeThemeFromSettings(updated?.appearance?.theme);
      logService.debug('[ipc] Settings updated:', updated);

      const senderId = event.sender.id;
      BrowserWindow.getAllWindows().forEach((win) => {
        if (win.webContents.id !== senderId) {
          win.webContents.send('settings:updated', updated);
        }
      });
      return { success: true, settings: updated };
    } catch (error) {
      logService.error('[ipc] Failed to update settings:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('settings:update-path', async (event, { path: settingPath, value }) => {
    try {
      if (
        settingPath[0] === 'general' &&
        settingPath[1] === 'autoUpdate' &&
        settingPath[2] === 'betaChannel'
      ) {
        getAutoUpdateService()?.updatePrereleaseFlag(!!value);
      }

      const updated = await settingsService.updateSetting(settingPath, value);
      themeService.applyNativeThemeFromSettings(updated?.appearance?.theme);
      logService.debug('[ipc] Settings updated:', updated);

      const senderId = event.sender.id;
      BrowserWindow.getAllWindows().forEach((win) => {
        if (win.webContents.id !== senderId) {
          win.webContents.send('settings:updated', updated);
        }
      });
      return { success: true, setting: updated };
    } catch (error) {
      logService.error('[ipc] Failed to update setting:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('providers:list', async () => getProvidersService().list());

  ipcMain.handle('providers:create', async (_event, input) => {
    const dto = await getProvidersService().create(input);
    await broadcastProvidersChanged();
    return dto;
  });

  ipcMain.handle('providers:update', async (_event, id: number, patch) => {
    if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid provider id');
    const dto = await getProvidersService().update(id, patch);
    await broadcastProvidersChanged();
    return dto;
  });

  ipcMain.handle('providers:delete', async (_event, id: number) => {
    if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid provider id');
    await getProvidersService().delete(id);
    await broadcastProvidersChanged();
  });

  ipcMain.handle('models:upsert', async (_event, providerId: number, model) => {
    if (!Number.isInteger(providerId) || providerId <= 0) throw new Error('Invalid provider id');
    const dto = await getProvidersService().upsertModel(providerId, model);
    await broadcastProvidersChanged();
    return dto;
  });

  ipcMain.handle('models:delete', async (_event, providerId: number, modelId: number) => {
    await getProvidersService().deleteModel(providerId, modelId);
    await broadcastProvidersChanged();
  });

  ipcMain.handle('text-selection:trigger', (_event, text: string, prompt: string) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('nav:go', '/chat');
      win.webContents.send('chat:reset-with-seed', { text, prompt });
      showMainWindow();
    }
    return { success: true };
  });

  ipcMain.handle('logs:get-path', () => logService.getLogPath());

  ipcMain.handle('logs:open-file', () => {
    shell.showItemInFolder(logService.getCurrentLogFile());
    return { success: true };
  });

  ipcMain.handle('logs:log', (_event, level, message, ...args) => {
    if (level === 'debug') logService.debug(message, ...args);
    else if (level === 'info') logService.info(message, ...args);
    else if (level === 'warn') logService.warn(message, ...args);
    else if (level === 'error') logService.error(message, null, ...args);
    return { success: true };
  });

  ipcMain.handle('permission:check', async () => {
    try {
      const permissionService = new SystemPermissionService();
      return await permissionService.checkPermissions();
    } catch (error) {
      logService.error('[ipc] permission:check handler error:', error);
      throw error;
    }
  });

  ipcMain.handle('system:open-accessibility', async () => {
    try {
      if (process.platform === 'darwin') {
        await shell.openExternal(
          'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
        );
      }
      return { success: true };
    } catch (error) {
      logService.error('[ipc] Failed to open system accessibility settings:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('system:open-install-folder', async () => {
    try {
      shell.openPath(getAppRootDir());
      return { success: true };
    } catch (error) {
      logService.error('[ipc] Failed to open install folder:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { success: false, error: 'Only http and https URLs are allowed' };
      }
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      logService.error('[ipc] shell:open-external error:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('update:check', () => {
    const autoUpdateService = getAutoUpdateService();
    if (autoUpdateService) return autoUpdateService.manualCheck();
    return { started: false, reason: 'disabled' };
  });

  ipcMain.handle('update:install', () => {
    const autoUpdateService = getAutoUpdateService();
    if (autoUpdateService) return autoUpdateService.installNow();
    return false;
  });

  ipcMain.handle('update:get-status', () => {
    const autoUpdateService = getAutoUpdateService();
    if (autoUpdateService) return autoUpdateService.getStatus();
    return { type: 'idle' } as const;
  });

  ipcMain.handle('app:get-version', () => app.getVersion());

  themeService.registerIpcHandlers();
  openAtLoginService.registerIpcHandlers();
}
