import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  screen,
  shell,
} from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';
import { execFile } from 'child_process';

import TextSelectionService from './electron/TextSelectionService';
import SettingsService from './electron/SettingsService';
import SystemPermissionService from './electron/SystemPermissionService';
import logService from './electron/LogService';
import AutoUpdateService from './electron/AutoUpdateService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const resourcesPath = isDev() ? path.join(__dirname, '..') : process.resourcesPath;

// ---- SINGLE INSTANCE LOCK ----
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, _argv, _workingDirectory) => {
    // Show or focus the settings window when a second instance is launched
    const win = settingsWindow || createSettingsWindow();
    if (win.isVisible()) {
      win.focus();
    } else {
      win.show();
      win.focus();
    }
  });
}

const settingsService = new SettingsService();
let autoUpdateService: AutoUpdateService | null = null;

let tray = null;
let chatPopupWindow = null;
let settingsWindow = null;
// let mainWindow = null;

function isDev() {
  return !app.isPackaged;
}

// reserve for future use
// function createWindow() {
//   mainWindow = new BrowserWindow({
//     width: 400,
//     height: 600,
//     show: false, // Do not show on startup
//     webPreferences: {
//       preload: path.join(__dirname, 'preload.js'),
//       nodeIntegration: false,
//       contextIsolation: true
//     }
//   });
//   if (isDev()) {
//     mainWindow.loadURL('http://localhost:5173').catch((err) => {
//       console.error('[main] Failed to load main window URL:', err);
//     });
//     console.log('[main] mainWindow loaded in development mode');
//   } else {
//     mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html')).catch((err) => {
//       console.error('[main] Failed to load main window file:', err);
//     });
//     console.log('[main] mainWindow loaded in production mode');
//   }
//   mainWindow.on('show', () => {
//     console.log('[main] mainWindow show event fired');
//   });
//   mainWindow.on('hide', () => {
//     console.log('[main] mainWindow hide event fired');
//   });
// }

function createChatPopupWindow(position, initialMessages) {
  chatPopupWindow = new BrowserWindow({
    width: 500,
    height: 700,
    x: position.x,
    y: position.y,
    frame: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
    focusable: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: isDev(),
    },
  });
  if (isDev()) {
    chatPopupWindow.loadURL('http://localhost:5173/#/chatpopup').catch((err) => {
      logService.error('Failed to load chat popup window URL:', err);
    });
    logService.info('chatPopupWindow loaded in development mode');
  } else {
    chatPopupWindow
      .loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash: '/chatpopup' })
      .catch((err) => {
        logService.error('Failed to load chat popup window file:', err);
      });
    logService.info('chatPopupWindow loaded in production mode');
  }
  chatPopupWindow.on('show', () => {
    updateActivationPolicy();
  });

  chatPopupWindow.on('hide', () => {
    updateActivationPolicy();
  });

  chatPopupWindow.on('closed', () => {
    chatPopupWindow = null;
    updateActivationPolicy();
  });

  chatPopupWindow.handleChatPopupReady = () => {
    if (initialMessages != null) {
      chatPopupWindow.webContents.send('chat-popup:init-message', initialMessages);
    }
    chatPopupWindow.handleChatPopupReady = null;
  };

  chatPopupWindow.show();
  chatPopupWindow.focus();

  if (process.platform === 'win32') {
    chatPopupWindow.setAlwaysOnTop(true);
    // Optional: Reset alwaysOnTop after a short delay if you don't want it permanently on top
    setTimeout(() => {
      if (chatPopupWindow && !chatPopupWindow.isDestroyed()) {
        chatPopupWindow.setAlwaysOnTop(false);
      }
    }, 1000);
  }
}

function createSettingsWindow() {
  if (settingsWindow) return settingsWindow;
  settingsWindow = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 600,
    minHeight: 450,
    frame: true,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    show: false,
    transparent: false,
    title: 'Settings',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: isDev(),
    },
  });
  if (isDev()) {
    settingsWindow.loadURL('http://localhost:5173/#/settings/general').catch((err) => {
      logService.error('Failed to load settings window URL:', err);
    });
    logService.info('settingsWindow loaded in development mode');
  } else {
    settingsWindow
      .loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { hash: '/settings/general' })
      .catch((err) => {
        logService.error('Failed to load settings window file:', err);
      });
    logService.info('settingsWindow loaded in production mode');
  }
  // Remove the blur event listener that auto-hides the window
  // Allow normal window behavior - user can close it normally
  settingsWindow.on('show', () => {
    updateActivationPolicy();
  });

  settingsWindow.on('hide', () => {
    updateActivationPolicy();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
    updateActivationPolicy();
  });

  settingsWindow.webContents.setWindowOpenHandler(() => {
    // disallow any new windows open in the settings window
    return { action: 'deny' };
  });

  return settingsWindow;
}

// Function to register hotkeys
function registerHotkeys() {
  // Unregister all existing hotkeys first
  globalShortcut.unregisterAll();

  settingsService.getHotkeys().forEach((hotkey, index) => {
    if (hotkey.enabled && hotkey.key) {
      try {
        globalShortcut.register(hotkey.key, () => {
          logService.info(`Hotkey pressed: ${hotkey.key}`);
          if (hotkey.id === 0) {
            const position = getPopupPosition();
            showChatPopup(position, undefined);
          } else {
            executeHotkey(hotkey.prompt);
          }
        });
        logService.info(`Registered hotkey ${index + 1}: ${hotkey.key}`);
      } catch (error) {
        logService.error(`Failed to register hotkey ${hotkey.key}:`, error);
      }
    }
  });
}

// Function to execute hotkey action
function executeHotkey(prompt) {
  let helperPath;

  if (process.platform === 'win32') {
    // Windows helper path
    helperPath = path.join(resourcesPath, 'helper', 'SelectedTextWin.exe');
  } else {
    // Mac helper path
    helperPath = path.join(resourcesPath, 'helper', 'selectedtext');
  }

  const clipboardEnabled = settingsService.getSettings().general.clipboardEnabled.toString();

  execFile(helperPath, [clipboardEnabled], (error, stdout, stderr) => {
    if (error) {
      logService.error('Error running selectedtext:', error);
      return;
    }
    if (stderr) {
      logService.warn('selectedtext stderr:', stderr);
    }

    // Parse JSON output from helper
    try {
      const result = JSON.parse(stdout.trim());
      logService.debug('Helper output as JSON:', result);

      if (result.success && result.selectedText) {
        logService.debug('Selected text from helper:', result.selectedText);
        // Use text selection service instead of directly sending to settings window
        textSelectionService.handleTextSelection(
          result.selectedText,
          prompt,
          'hotkey',
          settingsService.getSettings().chat?.defaultProvider
        );
      } else {
        logService.warn('No selected text found:', result.error || 'Unknown error');
      }
    } catch (parseError) {
      logService.error('Failed to parse helper JSON output:', parseError);
      logService.debug('Raw stdout:', stdout);
    }
  });
}

function getPopupPosition() {
  // Get screen dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  return {
    x: Math.floor(width / 2) - 250,
    y: Math.floor(height / 2) - 350,
  };
}

function showChatPopup(position, initialMessages) {
  if (chatPopupWindow && !chatPopupWindow.isDestroyed()) {
    chatPopupWindow.once('closed', () => {
      chatPopupWindow = null;
      createChatPopupWindow(position, initialMessages);
    });
    chatPopupWindow.close();
    return;
  }
  createChatPopupWindow(position, initialMessages);
}

function updateActivationPolicy() {
  if (process.platform === 'darwin' && app.setActivationPolicy) {
    const hasVisibleWindows = BrowserWindow.getAllWindows().some((win) => win.isVisible());
    app.setActivationPolicy(hasVisibleWindows ? 'regular' : 'accessory');
  }
}

function listenToSystemAccessibilityPermissionChange() {
  if (process.platform !== 'darwin') return;
  // Helper to broadcast permission change to all windows
  const broadcastPermissionChange = (permission: {
    id: string;
    name: string;
    isGranted: boolean;
  }) => {
    if (settingsWindow) {
      settingsWindow.webContents.send('permission:changed', [permission]);
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

// Create text selection service instance with callbacks
const textSelectionService = new TextSelectionService({
  showChatPopup: showChatPopup,
  getPopupPosition: getPopupPosition,
});
// IPC for chat popup
ipcMain.on('chat-popup:show', (event, { position }) => {
  showChatPopup(position, []);
});
ipcMain.on('chat-popup:send-message', (event, channel, payload) => {
  if (chatPopupWindow) chatPopupWindow.webContents.send(channel, payload);
});
ipcMain.on('chat-popup:ready', () => {
  if (chatPopupWindow && chatPopupWindow.handleChatPopupReady != null) {
    chatPopupWindow.handleChatPopupReady();
  }
});
ipcMain.on('chat-popup:close', () => {
  if (chatPopupWindow) chatPopupWindow.close();
});

// Add IPC for quit from renderer
ipcMain.on('app:quit', () => {
  // Destroy all windows
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

ipcMain.handle('settings:update', async (event, newSettings) => {
  try {
    const beta = !!newSettings?.general?.autoUpdate?.betaChannel;
    if (autoUpdateService) {
      autoUpdateService.updatePrereleaseFlag(beta);
    }

    const updated = await settingsService.updateSettings(newSettings);
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

// IPC handler to trigger text selection (for testing or manual triggers)
ipcMain.handle('text-selection:trigger', (event, text, prompt) => {
  textSelectionService.handleTextSelection(
    text,
    prompt,
    'manual',
    settingsService.getSettings().chat?.defaultProvider
  );
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

app.on('window-all-closed', function () {
  // do nothing, so app stays active in tray
});

app.whenReady().then(() => {
  // Set activation policy for true menu bar app on macOS (must be first!)
  if (process.platform === 'darwin' && app.setActivationPolicy) {
    app.setActivationPolicy('accessory');
  }

  // Log system info at startup
  logService.logSystemInfo();

  settingsService.initializeConfigs();

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

  createSettingsWindow();

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
    const trayIconPath = isDev()
      ? path.join(__dirname, '..', 'electron/assets/mind_tray_windows.ico')
      : path.join(__dirname, 'electron/assets/mind_tray_windows.ico');
    trayIcon = nativeImage.createFromPath(trayIconPath);
    tray = new Tray(trayIcon);
    logService.info('Tray icon created (Windows):', trayIconPath);
    // Add double-click handler to open settings window
    tray.on('double-click', () => {
      const win = settingsWindow || createSettingsWindow();
      if (win.isVisible()) {
        win.focus();
      } else {
        win.show();
        win.focus();
      }
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
      label: 'Settings  ',
      click: () => {
        const win = settingsWindow || createSettingsWindow();
        if (win.isVisible()) {
          win.focus(); // Just focus if already visible
        } else {
          win.show();
          win.focus();
        }
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Quit  ',
      click: () => {
        // Destroy all windows
        BrowserWindow.getAllWindows().forEach((win) => win.destroy());
        app.quit();
        app.exit(0); // Force exit for tray apps on macOS
      },
    },
  ]);

  // Set the context menu
  tray.setContextMenu(contextMenu);

  // Register hotkeys
  registerHotkeys();

  // Listen for changes to Accessibility/trust state
  listenToSystemAccessibilityPermissionChange();
});
