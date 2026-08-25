import { UpdateEvent } from './autoUpdate';
import { ModelSetting, Setting } from './setting';
import type { AgentDTO, CreateAgentInput, UpdateAgentPatch } from './agent-dto';
import type { HotkeyDTO, UpdateHotkeyPatch } from './hotkey-dto';
import type {
  ProviderDTO,
  CreateProviderInput,
  UpdateProviderPatch,
  UpsertModelInput,
  ModelDTO,
} from './provider-dto';

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

export interface NativeThemeState {
  mode: 'light' | 'dark' | 'auto';
  theme: 'light' | 'dark';
}

interface ElectronAPI {
  chat?: {
    onResetWithSeed: (callback: (seed: { text?: string; agentId?: number | null }) => void) => void;
    offResetWithSeed: () => void;
    onAbort: (callback: () => void) => void;
    offAbort: () => void;
  };
  window?: {
    hide: () => void;
  };
  nav?: {
    onGo: (callback: (path: string) => void) => void;
    offGo: () => void;
  };

  // Settings management
  getSettings: () => Promise<any>;
  updateSettings: (newSettings: any) => Promise<any>;
  updateSetting: (
    path: (string | number)[],
    value: string | number | boolean | ModelSetting[]
  ) => Promise<{ setting: Setting; success: boolean }>;
  onSettingsUpdated: (callback: (updatedSettings: Setting) => void) => void;
  offSettingsUpdated: () => void;
  getNativeTheme: () => Promise<NativeThemeState>;
  onNativeThemeChanged: (callback: (state: NativeThemeState) => void) => void;
  offNativeThemeChanged: () => void;

  // Log management
  getLogPath: () => Promise<string>;
  openLogFile: () => Promise<boolean>;
  log: (level: string, message: string, ...args: any[]) => Promise<void>;

  // Manual text selection trigger
  triggerTextSelection: (text: string, agentId: number | null) => Promise<any>;

  // System permission
  checkPermission: () => Promise<SystemPermission[]>;
  onPermissionChanged: (callback: (permissions: SystemPermission[]) => void) => void;
  offPermissionChanged: () => void;
  // Open macOS System Settings > Accessibility
  openSystemAccessibility?: () => Promise<{ success: boolean; error?: string }>;
  // Open the installed application folder in the OS file explorer
  openInstallFolder?: () => Promise<{ success: boolean; error?: string }>;

  // Open external URL in default browser (http/https only)
  openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
  // General app events
  quitApp: () => void;

  // Auto update APIs
  onUpdateEvent: (callback: (evt: UpdateEvent) => void) => void;
  offUpdateEvent: () => void;
  checkForUpdates: () => Promise<{ started: boolean; reason?: string }>;
  installUpdateNow: () => Promise<boolean>;
  getUpdateStatus: () => Promise<UpdateEvent | { type: 'idle' }>;
  getAppVersion: () => Promise<string>;
  getOpenAtLogin: () => Promise<{ success: boolean; openAtLogin: boolean; supported: boolean }>;
  setOpenAtLogin: (enabled: boolean) => Promise<{
    success: boolean;
    openAtLogin: boolean;
    supported: boolean;
    error?: string;
  }>;

  agents: {
    list: () => Promise<AgentDTO[]>;
    create: (input: CreateAgentInput) => Promise<AgentDTO>;
    update: (id: number, patch: UpdateAgentPatch) => Promise<AgentDTO>;
    delete: (id: number) => Promise<void>;
    onChanged: (callback: (list: AgentDTO[]) => void) => void;
    offChanged: () => void;
  };
  hotkeys: {
    list: () => Promise<HotkeyDTO[]>;
    update: (id: number, patch: UpdateHotkeyPatch) => Promise<HotkeyDTO>;
    onChanged: (callback: (list: HotkeyDTO[]) => void) => void;
    offChanged: () => void;
  };
  providers: {
    list: () => Promise<ProviderDTO[]>;
    create: (input: CreateProviderInput) => Promise<ProviderDTO>;
    update: (id: number, patch: UpdateProviderPatch) => Promise<ProviderDTO>;
    delete: (id: number) => Promise<void>;
    onChanged: (callback: (list: ProviderDTO[]) => void) => void;
    offChanged: () => void;
  };
  models: {
    upsert: (providerId: number, model: UpsertModelInput) => Promise<ModelDTO>;
    delete: (providerId: number, modelId: number) => Promise<void>;
  };
}

export type SettingsChangeHandler = (
  path: (string | number)[],
  value: string | number | boolean | ModelSetting[]
) => Promise<Setting>;

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
