import { Hotkey, ModelSetting, Setting } from './setting';

export interface LoggerService {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, error?: Error | any, ...args: any[]) => void;
  getLogPath: () => Promise<string>;
  openLogFile: () => Promise<boolean>;
}

export interface SystemPermission {
  id: 'macAccessibility' | 'winAdministrator' | 'none';
  name: 'Accessibility' | 'Administrator' | 'none';
  isGranted: boolean;
}

interface ElectronAPI {
  // Chat popup events
  showChatPopup: (position: { x: number; y: number }) => void;
  onInitMessage: (callback: (message: any) => void) => void;
  sendToChatPopup: (channel: string, payload: any) => void;
  chatPopupReady: () => void;
  onChatPopupReady: (callback: () => void) => void;
  offChatPopupReady: () => void;
  closeChatPopup: () => void;

  // Hotkey management
  getHotkeys: () => Promise<any[]>;
  updateHotkeys: (newHotkeys: Hotkey[]) => Promise<{ hotkeys: Hotkey[]; success: boolean }>;
  updateHotkey: (
    path: (string | number)[],
    value: string | number | boolean | ModelSetting[]
  ) => Promise<{ hotkeys: Hotkey[]; success: boolean }>;

  // Settings management
  getSettings: () => Promise<any>;
  updateSettings: (newSettings: any) => Promise<any>;
  updateSetting: (
    path: (string | number)[],
    value: string | number | boolean | ModelSetting[]
  ) => Promise<{ setting: Setting; success: boolean }>;
  onSettingsUpdated: (callback: (updatedSettings: Setting) => void) => void;
  offSettingsUpdated: () => void;

  // Log management
  getLogPath: () => Promise<string>;
  openLogFile: () => Promise<boolean>;
  log: (level: string, message: string, ...args: any[]) => Promise<void>;

  // Manual text selection trigger
  triggerTextSelection: (text: string, prompt: string) => Promise<any>;

  // System permission
  checkPermission: () => Promise<SystemPermission[]>;
  onPermissionChanged: (callback: (permissions: SystemPermission[]) => void) => void;
  offPermissionChanged: () => void;
  // Open macOS System Settings > Accessibility
  openSystemAccessibility?: () => Promise<{ success: boolean; error?: string }>;
  // Open the installed application folder in the OS file explorer
  openInstallFolder?: () => Promise<{ success: boolean; error?: string }>;

  // General app events
  quitApp: () => void;
}

export type SettingsChangeHandler = (
  path: (string | number)[],
  value: string | number | boolean | ModelSetting[]
) => Promise<Setting>;

export type HotkeysChangeHandler = (
  path: (string | number)[],
  value: string | number | boolean | ModelSetting[]
) => Promise<Hotkey[]>;

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
