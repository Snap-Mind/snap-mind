const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Chat popup events
  showChatPopup: (position) => ipcRenderer.send('chat-popup:show', { position }),
  onInitMessage: (callback) => {
    ipcRenderer.removeAllListeners('chat-popup:init-message');
    ipcRenderer.on('chat-popup:init-message', (_event, message) => callback(message));
  },
  sendToChatPopup: (channel, payload) => {
    ipcRenderer.send('chat-popup:send-message', channel, payload);
  },
  chatPopupReady: () => ipcRenderer.send('chat-popup:ready'),
  onChatPopupReady: (callback) => ipcRenderer.on('chat-popup:ready', callback),
  offChatPopupReady: () => ipcRenderer.removeAllListeners('chat-popup:ready'),
  closeChatPopup: () => ipcRenderer.send('chat-popup:close'),

  // Hotkey management
  getHotkeys: () => ipcRenderer.invoke('hotkeys:get'),
  updateHotkeys: (newHotkeys) => ipcRenderer.invoke('hotkeys:update', newHotkeys),
  updateHotkey: (path, value) => ipcRenderer.invoke('hotkeys:update-path', { path, value }),
  // Settings management
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (newSettings) => ipcRenderer.invoke('settings:update', newSettings),
  updateSetting: (path, value) => ipcRenderer.invoke('settings:update-path', { path, value }),
  onSettingsUpdated: (callback) =>
    ipcRenderer.on('settings:updated', (_event, updatedSettings) => callback(updatedSettings)),
  offSettingsUpdated: () => ipcRenderer.removeAllListeners('settings:updated'),
  // Log management
  getLogPath: () => ipcRenderer.invoke('logs:get-path'),
  openLogFile: () => ipcRenderer.invoke('logs:open-file'),
  log: (level, message, ...args) => ipcRenderer.invoke('logs:log', level, message, ...args),
  // Manual text selection trigger (for testing)
  triggerTextSelection: (text, prompt) =>
    ipcRenderer.invoke('text-selection:trigger', text, prompt),
  // System permission
  checkPermission: () => ipcRenderer.invoke('permission:check'),
  // Open macOS System Settings > Accessibility
  openSystemAccessibility: () => ipcRenderer.invoke('system:open-accessibility'),
  onPermissionChanged: (callback) =>
    ipcRenderer.on('permission:changed', (_event, permissions) => callback(permissions)),
  offPermissionChanged: () =>
    ipcRenderer.removeAllListeners('permission:changed'),
  // General app events
  quitApp: () => ipcRenderer.send('app:quit'),
});
