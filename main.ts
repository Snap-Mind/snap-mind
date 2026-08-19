import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  nativeTheme,
  shell,
} from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';
import { execFile } from 'child_process';
import SettingsService from './electron/SettingsService';
import SystemPermissionService from './electron/SystemPermissionService';
import logService from './electron/LogService';
import AutoUpdateService from './electron/AutoUpdateService';
import OpenAtLoginService from './electron/OpenAtLoginService';
import ThemeService from './electron/ThemeService';
import pathService from './electron/PathService';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { openDatabase } from './electron/db/client.js';
import { resolveMigrationsFolder, runMigrations } from './electron/db/migrate.js';
import { runImportIfNeeded } from './electron/db/import.js';
import { ProvidersService } from './electron/ProvidersService.js';
import * as dbSchema from './electron/db/schema.js';

declare module 'electron' {
  interface App {
    isQuitting: boolean;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const resourcesPath = isDev() ? path.join(__dirname, '..') : process.resourcesPath;

// GUI-launched apps on macOS/Windows may inherit an incomplete PATH that omits
// user-installed binaries. Restore the full PATH so child processes resolve as they do in a terminal.
pathService.fix();

// ---- SINGLE INSTANCE LOCK ----
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, _argv, _workingDirectory) => {
    if (!app.isReady()) return;
    showMainWindow();
  });
}

app.on('before-quit', () => {
  app.isQuitting = true;
  try {
    sqliteDb?.close();
  } catch (e) {
    logService.warn('[main] failed to close db', e);
  }
});

const settingsService = new SettingsService();
const openAtLoginService = new OpenAtLoginService();
const themeService = new ThemeService({
  getAppearanceMode: () => settingsService.getSettings()?.appearance?.theme,
});
let autoUpdateService: AutoUpdateService | null = null;

let tray = null;
let mainWindow: import('electron').BrowserWindow | null = null;
let sqliteDb: BetterSqlite3.Database | null = null;
let providersService: ProvidersService | null = null;
app.isQuitting = false;

function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'snapmind.db');
  sqliteDb = openDatabase(dbPath);
  const migrationsFolder = resolveMigrationsFolder(app.isPackaged, process.resourcesPath);
  runMigrations(sqliteDb, migrationsFolder);
  const drizzleDb = drizzle(sqliteDb, { schema: dbSchema });
  providersService = new ProvidersService(drizzleDb);
}

function providerCount(): number {
  if (!sqliteDb) return 0;
  const row = sqliteDb.prepare('SELECT COUNT(*) AS n FROM providers').get() as { n: number };
  return row.n;
}

function broadcastProvidersChanged(list: unknown) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('providers:changed', list);
  }
}

function isDev() {
  return !app.isPackaged;
}

function createMainWindow() {
  const titleBase = 'SnapMind';
  mainWindow = new BrowserWindow({
    width: 500,
    height: 700,
    minWidth: 400,
    minHeight: 500,
    frame: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
    focusable: true,
    show: false,
    title: titleBase,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: isDev(),
    },
  });

  if (isDev()) {
    mainWindow.loadURL('http://localhost:5173/#/chat').catch((err) => {
      logService.error('Failed to load main window URL:', err);
    });
  } else {
    mainWindow
      .loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash: '/chat' })
      .catch((err) => {
        logService.error('Failed to load main window file:', err);
      });
  }

  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
    mainWindow?.setTitle(titleBase);
  });

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      hideMainWindow();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  return mainWindow;
}

function showMainWindow() {
  const win = mainWindow ?? createMainWindow();
  if (!win) return;
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  win.focus();
  if (process.platform === 'darwin' && app.setActivationPolicy) {
    app.setActivationPolicy('regular');
  }
  if (process.platform === 'win32') {
    win.setAlwaysOnTop(true);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setAlwaysOnTop(false);
    }, 500);
  }
}

function hideMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
}

function registerHotkeys() {
  globalShortcut.unregisterAll();

  settingsService.getHotkeys().forEach((hotkey: any, index: number) => {
    if (!hotkey.enabled || !hotkey.key) return;
    try {
      globalShortcut.register(hotkey.key, () => {
        logService.info(`Hotkey pressed: ${hotkey.key}`);
        void triggerHotkey(hotkey);
      });
      logService.info(`Registered hotkey ${index + 1}: ${hotkey.key}`);
    } catch (error) {
      logService.error(`Failed to register hotkey ${hotkey.key}:`, error);
    }
  });
}

async function triggerHotkey(hotkey: { id: number; key: string; prompt?: string }) {
  // 1. Signal renderer to abort any in-flight AI request.
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('chat:abort');
  }

  // 2. If the hotkey has a prompt, run the helper and get the OS selection.
  let seed: { text?: string; prompt?: string } = {};
  if (hotkey.prompt) {
    try {
      seed = await runSelectionHelper(hotkey.prompt);
    } catch (err) {
      logService.error('Selection helper failed:', err);
      seed = {}; // Fresh empty session on failure; matches today's behaviour.
    }
  }

  // 3. Navigate to chat (even if user is on settings).
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('nav:go', '/chat');
  }

  // 4. Emit reset-with-seed to the renderer.
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('chat:reset-with-seed', seed);
  }

  // 5. Show and focus the window.
  showMainWindow();
}

export function runSelectionHelper(prompt: string): Promise<{ text?: string; prompt?: string }> {
  const helperPath =
    process.platform === 'win32'
      ? path.join(resourcesPath, 'helper', 'SelectedTextWin.exe')
      : path.join(resourcesPath, 'helper', 'selectedtext');
  const clipboardEnabled = String(!!settingsService.getSettings()?.general?.clipboardEnabled);

  return new Promise((resolve, reject) => {
    execFile(helperPath, [clipboardEnabled], (error, stdout, stderr) => {
      if (error) return reject(error);
      if (stderr) logService.warn('selectedtext stderr:', stderr);

      try {
        const result = JSON.parse(String(stdout).trim());
        if (result?.success && result?.selectedText) {
          resolve({ text: result.selectedText, prompt });
        } else {
          logService.warn('No selected text found:', result?.error || 'Unknown');
          resolve({ prompt }); // Prompt without text → renderer treats as empty seed.
        }
      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
}

function listenToSystemAccessibilityPermissionChange() {
  if (process.platform !== 'darwin') return;
  // Helper to broadcast permission change to all windows
  const broadcastPermissionChange = (permission: {
    id: string;
    name: string;
    isGranted: boolean;
  }) => {
    if (mainWindow) {
      mainWindow.webContents.send('permission:changed', [permission]);
    }
  };

  // Use SystemPermissionService polling API
  try {
    const permissionService = new SystemPermissionService();
    const watcher = permissionService.startAccessibilityPolling(
      (perm) => {
        try {
          broadcastPermissionChange(perm);
        } catch (e) {
          logService.error('[main] Error broadcasting accessibility change from poll:', e);
        }
      },
      isDev() ? 2000 : 5000
    );

    app.on('will-quit', () => {
      try {
        watcher.stop();
      } catch (e) {
        // ignore
      }
    });
  } catch (err) {
    logService.error(
      '[main] Failed to start accessibility polling via SystemPermissionService:',
      err
    );
  }
}

ipcMain.on('window:hide', () => {
  const win = mainWindow;
  if (win && !win.isDestroyed() && win.isVisible()) {
    win.hide();
  }
});

// Add IPC for quit from renderer
ipcMain.on('app:quit', () => {
  app.isQuitting = true;
  BrowserWindow.getAllWindows().forEach((win) => win.destroy());
  app.quit();
  app.exit(0); // Force exit for tray apps on macOS
});

// IPC handlers for hotkey management
ipcMain.handle('hotkeys:get', () => {
  return settingsService.getHotkeys();
});

ipcMain.handle('hotkeys:update', async (event, newHotkeys) => {
  if (!Array.isArray(newHotkeys) || newHotkeys.length === 0) {
    console.error('[main] Invalid hotkeys format received:', newHotkeys);
    return { success: false, error: 'Invalid hotkeys format' };
  }

  const updated = await settingsService.updateHotkeys(newHotkeys);
  registerHotkeys();
  return { success: true, hotkeys: updated };
});

ipcMain.handle('hotkeys:update-path', async (event, { path, value }) => {
  try {
    const updated = await settingsService.updateHotkey(path, value);
    registerHotkeys();
    return { success: true, hotkeys: updated };
  } catch (error) {
    console.error('[main] Failed to update hotkey:', error);
    return { success: false, error: error.message };
  }
});

// IPC handlers for settings management
ipcMain.handle('settings:get', () => {
  return settingsService.getSettings();
});
themeService.registerIpcHandlers();

ipcMain.handle('settings:update', async (event, newSettings) => {
  try {
    const beta = !!newSettings?.general?.autoUpdate?.betaChannel;
    if (autoUpdateService) {
      autoUpdateService.updatePrereleaseFlag(beta);
    }

    const updated = await settingsService.updateSettings(newSettings);
    themeService.applyNativeThemeFromSettings(updated?.appearance?.theme);
    logService.debug('[main] Settings updated:', updated);

    const senderId = event.sender.id;
    BrowserWindow.getAllWindows().forEach((win) => {
      if (win.webContents.id !== senderId) {
        win.webContents.send('settings:updated', updated);
      }
    });
    return { success: true, settings: updated };
  } catch (error) {
    logService.error('[main] Failed to update settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('settings:update-path', async (event, { path, value }) => {
  try {
    if (path[0] === 'general' && path[1] === 'autoUpdate' && path[2] === 'betaChannel') {
      const beta = !!value;
      if (autoUpdateService) {
        autoUpdateService.updatePrereleaseFlag(beta);
      }
    }

    const updated = await settingsService.updateSetting(path, value);
    themeService.applyNativeThemeFromSettings(updated?.appearance?.theme);
    logService.debug('[main] Settings updated:', updated);

    const senderId = event.sender.id;
    BrowserWindow.getAllWindows().forEach((win) => {
      if (win.webContents.id !== senderId) {
        win.webContents.send('settings:updated', updated);
      }
    });
    return { success: true, setting: updated };
  } catch (error) {
    console.error('[main] Failed to update setting:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('providers:list', async () => providersService!.list());

ipcMain.handle('providers:create', async (_e, input) => {
  const dto = await providersService!.create(input);
  broadcastProvidersChanged(await providersService!.list());
  return dto;
});

ipcMain.handle('providers:update', async (_e, id: number, patch) => {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid provider id');
  const dto = await providersService!.update(id, patch);
  broadcastProvidersChanged(await providersService!.list());
  return dto;
});

ipcMain.handle('providers:delete', async (_e, id: number) => {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid provider id');
  await providersService!.delete(id);
  broadcastProvidersChanged(await providersService!.list());
});

ipcMain.handle('models:upsert', async (_e, providerId: number, model) => {
  if (!Number.isInteger(providerId) || providerId <= 0) throw new Error('Invalid provider id');
  const dto = await providersService!.upsertModel(providerId, model);
  broadcastProvidersChanged(await providersService!.list());
  return dto;
});

ipcMain.handle('models:delete', async (_e, providerId: number, modelId: number) => {
  await providersService!.deleteModel(providerId, modelId);
  broadcastProvidersChanged(await providersService!.list());
});

// IPC handler to trigger text selection (for testing or manual triggers)
ipcMain.handle('text-selection:trigger', (_event, text: string, prompt: string) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('nav:go', '/chat');
    mainWindow.webContents.send('chat:reset-with-seed', { text, prompt });
    showMainWindow();
  }
  return { success: true };
});

// IPC handlers for log management
ipcMain.handle('logs:get-path', () => {
  return logService.getLogPath();
});

ipcMain.handle('logs:open-file', () => {
  const logFile = logService.getCurrentLogFile();
  shell.showItemInFolder(logFile);
  return { success: true };
});

ipcMain.handle('logs:log', (event, level, message, ...args) => {
  if (level === 'debug') {
    logService.debug(message, ...args);
  } else if (level === 'info') {
    logService.info(message, ...args);
  } else if (level === 'warn') {
    logService.warn(message, ...args);
  } else if (level === 'error') {
    logService.error(message, null, ...args);
  }
  return { success: true };
});

ipcMain.handle('permission:check', async (_event) => {
  try {
    const permissionService = new SystemPermissionService();
    const result = await permissionService.checkPermissions();
    return result;
  } catch (error) {
    logService.error('[main] permission:check handler error:', error);
    // propagate error to renderer
    throw error;
  }
});

// IPC to open system Accessibility settings on macOS
ipcMain.handle('system:open-accessibility', async () => {
  try {
    if (process.platform === 'darwin') {
      // Open the macOS System Settings Accessibility pane
      shell.openExternal(
        'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
      );
    }
    return { success: true };
  } catch (error) {
    logService.error('[main] Failed to open system accessibility settings:', error);
    return { success: false, error: error.message };
  }
});

// IPC to open the folder where the app is installed or resources live
ipcMain.handle('system:open-install-folder', async () => {
  try {
    const targetPath = isDev() ? path.join(__dirname, '..') : path.dirname(process.execPath);
    shell.openPath(targetPath);
    return { success: true };
  } catch (error) {
    logService.error('[main] Failed to open install folder:', error);
    return { success: false, error: error.message };
  }
});

// Safely open an external URL in the default browser (http/https only)
ipcMain.handle('shell:open-external', async (_event, url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { success: false, error: 'Only http and https URLs are allowed' };
    }
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    logService.error('[main] shell:open-external error:', error);
    return { success: false, error: error.message };
  }
});

// Update-related IPC
ipcMain.handle('update:check', () => {
  if (autoUpdateService) return autoUpdateService.manualCheck();
  return { started: false, reason: 'disabled' };
});
ipcMain.handle('update:install', () => {
  if (autoUpdateService) return autoUpdateService.installNow();
  return false;
});
ipcMain.handle('update:get-status', () => {
  if (autoUpdateService) return autoUpdateService.getStatus();
  return { type: 'idle' } as const;
});
ipcMain.handle('app:get-version', () => app.getVersion());

openAtLoginService.registerIpcHandlers();

app.on('window-all-closed', function () {
  // do nothing, so app stays active in tray
});

app.whenReady().then(async () => {
  // Log system info at startup
  logService.logSystemInfo();

  settingsService.initializeConfigs();

  try {
    initDatabase();
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    await runImportIfNeeded({
      settingsPath,
      service: providersService!,
      hasProviders: providerCount() > 0,
    });
    settingsService.setProvidersService(providersService!);
    await settingsService.resolveAndPersistDefaults();
  } catch (e) {
    logService.error('[main] database init failed', e);
    const { dialog } = await import('electron');
    const choice = dialog.showMessageBoxSync({
      type: 'error',
      buttons: ['Open user data folder', 'Quit'],
      defaultId: 1,
      title: 'SnapMind',
      message: "SnapMind can't open its settings database.",
      detail: String((e as Error)?.message ?? e),
    });
    if (choice === 0) shell.openPath(app.getPath('userData'));
    app.isQuitting = true;
    app.quit();
    return;
  }

  themeService.initialize();

  // Initialize auto update service based on settings (general.autoUpdate)
  try {
    const settings = settingsService.getSettings();
    const autoUpdate = settings?.general?.autoUpdate || {
      enabled: true,
      checkOnLaunchDelaySec: 10,
      betaChannel: false,
    };
    autoUpdateService = new AutoUpdateService({
      enabled: autoUpdate.enabled !== false,
      checkOnStartDelay:
        typeof autoUpdate.checkOnLaunchDelaySec === 'number'
          ? autoUpdate.checkOnLaunchDelaySec
          : 10,
      allowPrerelease: !!autoUpdate.betaChannel,
    });
    autoUpdateService.init();
  } catch (e) {
    logService.error('[main] failed to init auto update service', e);
  }

  // Use platform-specific tray icons with template and retina support
  let trayIcon;
  if (process.platform === 'darwin') {
    // Use template icon for macOS, Electron will pick @2x for retina automatically
    const trayIconPath = isDev()
      ? path.join(__dirname, '..', 'electron/assets/mind_tray_macos_Template.png')
      : path.join(__dirname, 'electron/assets/mind_tray_macos_Template.png');
    trayIcon = nativeImage.createFromPath(trayIconPath);
    trayIcon.setTemplateImage(true);
    tray = new Tray(trayIcon);
    logService.info('Tray icon created (macOS template):', trayIconPath);
  } else if (process.platform === 'win32') {
    const getWindowsTrayIcon = () => {
      const useWhiteIcon = nativeTheme.shouldUseDarkColors;
      const iconName = useWhiteIcon ? 'mind_tray_windows_white.ico' : 'mind_tray_windows.ico';
      return isDev()
        ? path.join(__dirname, '..', 'electron', 'assets', iconName)
        : path.join(__dirname, 'electron', 'assets', iconName);
    };

    const trayIconPath = getWindowsTrayIcon();
    trayIcon = nativeImage.createFromPath(trayIconPath);
    tray = new Tray(trayIcon);
    logService.info('Tray icon created (Windows):', trayIconPath);

    // Update icon when theme changes
    nativeTheme.on('updated', () => {
      const newIconPath = getWindowsTrayIcon();
      const newIcon = nativeImage.createFromPath(newIconPath);
      tray.setImage(newIcon);
      logService.info('Tray icon updated (Windows theme change):', newIconPath);
    });

    // Add double-click handler to show main window
    tray.on('double-click', () => {
      showMainWindow();
    });
  } else {
    const trayIconPath = isDev()
      ? path.join(__dirname, '..', 'electron/assets/mind_tray_macos_Template.png')
      : path.join(__dirname, 'electron/assets/mind_tray_macos_Template.png');
    trayIcon = nativeImage.createFromPath(trayIconPath);
    tray = new Tray(trayIcon);
    logService.info('Tray icon created (other):', trayIconPath);
  }

  // Create context menu for tray
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show SnapMind',
      click: () => showMainWindow(),
    },
    {
      label: 'Settings...  ',
      click: () => {
        showMainWindow();
        if (mainWindow) mainWindow.webContents.send('nav:go', '/settings/general');
      },
    },
    { type: 'separator' },
    {
      label: 'Quit  ',
      click: () => {
        app.isQuitting = true;
        BrowserWindow.getAllWindows().forEach((win) => win.destroy());
        app.quit();
        app.exit(0);
      },
    },
  ]);

  // Set the context menu
  tray.setContextMenu(contextMenu);

  // Set macOS Dock icon right-click menu
  if (process.platform === 'darwin' && app.dock) {
    const dockMenu = Menu.buildFromTemplate([
      {
        label: 'Show SnapMind',
        click: () => showMainWindow(),
      },
      {
        label: 'Settings...',
        click: () => {
          showMainWindow();
          if (mainWindow) mainWindow.webContents.send('nav:go', '/settings/general');
        },
      },
    ]);
    app.dock.setMenu(dockMenu);
  }

  createMainWindow();
  if (!openAtLoginService.isLoginLaunch()) {
    showMainWindow();
  } else {
    // Login-launch: keep window hidden until the user opens it from the dock or tray.
    hideMainWindow();
  }

  // Register hotkeys
  registerHotkeys();

  // Listen for changes to Accessibility/trust state
  listenToSystemAccessibilityPermissionChange();
});

app.on('activate', () => {
  showMainWindow();
});
