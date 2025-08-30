import { Hotkey, ModelSetting, Setting } from './setting';

export interface LoggerService {
  debug: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, error?: Error | any, ...args: any[]) => void;
  getLogPath: () => Promise<string>;
  openLogFile: () => Promise<boolean>;
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

  // General app events
  quitApp: () => void;
}

export type SettingsChangeHandler = (
  path: (string | number)[],
  value: string | number | boolean | ModelSetting[]
) => Promise<Setting>;
export type HotKeysChangeHandler = (newHotkeys: Hotkey[]) => Promise<Hotkey[]>;

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
