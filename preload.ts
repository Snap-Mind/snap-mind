import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Settings management
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (newSettings) => ipcRenderer.invoke('settings:update', newSettings),
  updateSetting: (path, value) => ipcRenderer.invoke('settings:update-path', { path, value }),
  onSettingsUpdated: (callback) =>
    ipcRenderer.on('settings:updated', (_event, updatedSettings) => callback(updatedSettings)),
  offSettingsUpdated: () => ipcRenderer.removeAllListeners('settings:updated'),
  getNativeTheme: () => ipcRenderer.invoke('theme:get'),
  onNativeThemeChanged: (callback) =>
    ipcRenderer.on('theme:changed', (_event, payload) => callback(payload)),
  offNativeThemeChanged: () => ipcRenderer.removeAllListeners('theme:changed'),
  // Log management
  getLogPath: () => ipcRenderer.invoke('logs:get-path'),
  openLogFile: () => ipcRenderer.invoke('logs:open-file'),
  log: (level, message, ...args) => ipcRenderer.invoke('logs:log', level, message, ...args),
  // Manual text selection trigger (for testing)
  triggerTextSelection: (text, agentId) =>
    ipcRenderer.invoke('text-selection:trigger', text, agentId),
  // System permission
  checkPermission: () => ipcRenderer.invoke('permission:check'),
  // Open macOS System Settings > Accessibility
  openSystemAccessibility: () => ipcRenderer.invoke('system:open-accessibility'),
  // Open the folder where the app is installed (show in file explorer)
  openInstallFolder: () => ipcRenderer.invoke('system:open-install-folder'),
  onPermissionChanged: (callback) =>
    ipcRenderer.on('permission:changed', (_event, permissions) => callback(permissions)),
  offPermissionChanged: () => ipcRenderer.removeAllListeners('permission:changed'),
  // Open an external URL safely in the default browser
  openExternalUrl: (url) => ipcRenderer.invoke('shell:open-external', url),
  // General app events
  quitApp: () => ipcRenderer.send('app:quit'),
  // Auto update APIs
  onUpdateEvent: (callback) => {
    ipcRenderer.on('update:event', (_event, evt) => callback(evt));
  },
  offUpdateEvent: () => ipcRenderer.removeAllListeners('update:event'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdateNow: () => ipcRenderer.invoke('update:install'),
  getUpdateStatus: () => ipcRenderer.invoke('update:get-status'),
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  getOpenAtLogin: () => ipcRenderer.invoke('app:get-open-at-login'),
  setOpenAtLogin: (enabled) => ipcRenderer.invoke('app:set-open-at-login', enabled),

  chat: {
    onResetWithSeed: (callback: (_seed: { text?: string; agentId?: number | null }) => void) => {
      ipcRenderer.removeAllListeners('chat:reset-with-seed');
      ipcRenderer.on('chat:reset-with-seed', (_e, payload) => callback(payload));
    },
    offResetWithSeed: () => ipcRenderer.removeAllListeners('chat:reset-with-seed'),
    onAbort: (callback: () => void) => {
      ipcRenderer.removeAllListeners('chat:abort');
      ipcRenderer.on('chat:abort', () => callback());
    },
    offAbort: () => ipcRenderer.removeAllListeners('chat:abort'),
  },
  window: {
    hide: () => ipcRenderer.send('window:hide'),
  },
  nav: {
    onGo: (callback: (_path: string) => void) => {
      ipcRenderer.removeAllListeners('nav:go');
      ipcRenderer.on('nav:go', (_e, path) => callback(path));
    },
    offGo: () => ipcRenderer.removeAllListeners('nav:go'),
  },
  agents: {
    list: () => ipcRenderer.invoke('agents:list'),
    create: (input: unknown) => ipcRenderer.invoke('agents:create', input),
    update: (id: number, patch: unknown) => ipcRenderer.invoke('agents:update', id, patch),
    delete: (id: number) => ipcRenderer.invoke('agents:delete', id),
    onChanged: (callback: (_list: unknown) => void) => {
      ipcRenderer.removeAllListeners('agents:changed');
      ipcRenderer.on('agents:changed', (_e, list) => callback(list));
    },
    offChanged: () => ipcRenderer.removeAllListeners('agents:changed'),
  },
  hotkeys: {
    list: () => ipcRenderer.invoke('hotkeys:list'),
    update: (id: number, patch: unknown) => ipcRenderer.invoke('hotkeys:update', id, patch),
    onChanged: (callback: (_list: unknown) => void) => {
      ipcRenderer.removeAllListeners('hotkeys:changed');
      ipcRenderer.on('hotkeys:changed', (_e, list) => callback(list));
    },
    offChanged: () => ipcRenderer.removeAllListeners('hotkeys:changed'),
  },
  providers: {
    list: () => ipcRenderer.invoke('providers:list'),
    create: (input: unknown) => ipcRenderer.invoke('providers:create', input),
    update: (id: number, patch: unknown) => ipcRenderer.invoke('providers:update', id, patch),
    delete: (id: number) => ipcRenderer.invoke('providers:delete', id),
    onChanged: (callback: (_list: unknown) => void) => {
      ipcRenderer.removeAllListeners('providers:changed');
      ipcRenderer.on('providers:changed', (_e, list) => callback(list));
    },
    offChanged: () => ipcRenderer.removeAllListeners('providers:changed'),
  },
  models: {
    upsert: (providerId: number, model: unknown) =>
      ipcRenderer.invoke('models:upsert', providerId, model),
    delete: (providerId: number, modelId: number) =>
      ipcRenderer.invoke('models:delete', providerId, modelId),
  },
});
