import {
  app,
  BrowserWindow,
  globalShortcut,
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
import { AgentsService } from './electron/AgentsService.js';
import { HotkeysService } from './electron/HotkeysService.js';
import { runAgentImportIfNeeded } from './electron/db/importAgents.js';
import type { HotkeyDTO } from './electron/HotkeysService.js';
import * as dbSchema from './electron/db/schema.js';
import { resolveUserDataPath } from './electron/userDataPath.js';
import { registerIpcHandlers } from './electron/IpcHandlers.js';

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
  isQuitting = true;
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
let drizzleDb: ReturnType<typeof drizzle<typeof dbSchema>> | null = null;
let providersService: ProvidersService | null = null;
let agentsService: AgentsService | null = null;
let hotkeysService: HotkeysService | null = null;
let isQuitting = false;

function quitApp() {
  isQuitting = true;
  BrowserWindow.getAllWindows().forEach((win) => win.destroy());
  app.quit();
  app.exit(0);
}

function initDatabase() {
  const dbPath = path.join(resolveUserDataPath(), 'snapmind.db');
  sqliteDb = openDatabase(dbPath);
  const migrationsFolder = resolveMigrationsFolder(app.isPackaged, process.resourcesPath);
  runMigrations(sqliteDb, migrationsFolder);
  drizzleDb = drizzle(sqliteDb, { schema: dbSchema });
  providersService = new ProvidersService(drizzleDb);
  agentsService = new AgentsService(drizzleDb);
  hotkeysService = new HotkeysService(drizzleDb);
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
    if (!isQuitting) {
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

  const rows = hotkeysService?.listSync() ?? [];
  rows.forEach((hotkey, index) => {
    if (!hotkey.enabled || !hotkey.accelerator) return;
    try {
      globalShortcut.register(hotkey.accelerator, () => {
        logService.info(`Hotkey pressed: ${hotkey.accelerator}`);
        void triggerHotkey(hotkey);
      });
      logService.info(`Registered hotkey ${index + 1}: ${hotkey.accelerator}`);
    } catch (error) {
      logService.error(`Failed to register hotkey ${hotkey.accelerator}:`, error);
    }
  });
}

async function triggerHotkey(hotkey: HotkeyDTO) {
  // 1. Signal renderer to abort any in-flight AI request.
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('chat:abort');
  }

  // 2. Selection hotkeys read the OS selection; chat hotkeys just open the window.
  let text: string | undefined;
  if (hotkey.mode === 'selection') {
    try {
      ({ text } = await runSelectionHelper());
    } catch (err) {
      logService.error('Selection helper failed:', err);
    }
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('nav:go', '/chat');
    mainWindow.webContents.send('chat:reset-with-seed', { text, agentId: hotkey.agentId });
  }

  showMainWindow();
}

export function runSelectionHelper(): Promise<{ text?: string }> {
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
          resolve({ text: result.selectedText });
        } else {
          logService.warn('No selected text found:', result?.error || 'Unknown');
          resolve({});
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

registerIpcHandlers({
  getMainWindow: () => mainWindow,
  settingsService,
  themeService,
  openAtLoginService,
  getProvidersService: () => providersService!,
  getAgentsService: () => agentsService!,
  getHotkeysService: () => hotkeysService!,
  getAutoUpdateService: () => autoUpdateService,
  registerHotkeys,
  showMainWindow,
  getAppRootDir: () => (isDev() ? path.join(__dirname, '..') : path.dirname(process.execPath)),
  quitApp,
});

app.on('window-all-closed', function () {
  // do nothing, so app stays active in tray
});

app.whenReady().then(async () => {
  // Log system info at startup
  logService.logSystemInfo();

  settingsService.initializeConfigs();

  try {
    initDatabase();
    const userDataDir = resolveUserDataPath();
    const settingsPath = path.join(userDataDir, 'settings.json');
    const importResult = await runImportIfNeeded({ settingsPath, db: drizzleDb! });
    const agentImportResult = await runAgentImportIfNeeded({
      hotkeysPath: path.join(userDataDir, 'hotkeys.json'),
      settingsPath,
      db: drizzleDb!,
    });
    if (importResult === 'imported' || agentImportResult === 'imported') {
      settingsService.initializeConfigs();
    }
    settingsService.setProvidersService(providersService!);
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
    if (choice === 0) shell.openPath(resolveUserDataPath());
    isQuitting = true;
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
      click: () => quitApp(),
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
