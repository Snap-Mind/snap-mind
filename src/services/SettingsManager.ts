import { LoggerService } from './LoggerService';
import { HotKeysChangeHandler, SettingsChangeHandler } from '@/types';
import { Setting, Hotkey } from '@/types/setting';

export class SettingsManager {
  private loggerService: LoggerService;
  private settings: Setting;
  private hotkeys: Hotkey[];
  private _isInitialized: boolean;
  private initPromise: Promise<boolean> | null;

  public get isInitialized(): boolean {
    return this._isInitialized;
  }

  constructor(loggerService: LoggerService) {
    this.loggerService = loggerService;
    this.settings = {} as Setting;
    this.hotkeys = [] as Hotkey[];
    this._isInitialized = false;
    this.initPromise = null;
  }

  async initialize() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve) => {
      const loadSettings = async () => {
        try {
          const [loadedSettings, loadedHotkeys] = await Promise.all([
            window.electronAPI.getSettings(),
            window.electronAPI.getHotkeys(),
          ]);

          // Remove sensitive data from the cached copy
          if (loadedSettings.general && loadedSettings.general.azureApiKey) {
            loadedSettings.general.azureApiKey = '';
          }

          this.settings = loadedSettings;
          this.hotkeys = loadedHotkeys;
          this._isInitialized = true;
          this.loggerService.info('SettingsManager initialized successfully');
          resolve(true);
        } catch (error) {
          this.loggerService.error('Failed to initialize SettingsManager:', error);
          // Still mark as initialized to avoid repeated failed attempts
          this._isInitialized = true;
          resolve(false);
        }
      };

      loadSettings();
    });

    return this.initPromise;
  }

  getSettings() {
    if (!this._isInitialized) {
      this.loggerService.warn('SettingsManager.getSettings called before initialization');
    }
    return this.settings;
  }

  getHotkeys() {
    if (!this._isInitialized) {
      this.loggerService.warn('SettingsManager.getHotkeys called before initialization');
    }
    return this.hotkeys;
  }

  async updateSettings(newSettings) {
    try {
      const result = await window.electronAPI.updateSettings(newSettings);
      this.settings = { ...newSettings };

      // // Remove sensitive data from the cached copy
      // if (this.settings.general && this.settings.general.azureApiKey) {
      //   this.settings.general.azureApiKey = '';
      // }

      return result;
    } catch (error) {
      this.loggerService.error('Failed to update settings:', error);
      throw error;
    }
  }

  updateSetting: SettingsChangeHandler = async (path, value) => {
    try {
      const { setting: newSettings } = await window.electronAPI.updateSetting(path, value);

      this.settings = newSettings;
      return newSettings;
    } catch (error) {
      this.loggerService.error('Failed to update setting:', error);
      throw error;
    }
  };

  updateHotkey: HotkeysChangeHandler = async (path, value) => {
    try {
      const { hotkeys: updatedHotkeys } = await window.electronAPI.updateHotkey(path, value);

      this.hotkeys = updatedHotkeys;
      return updatedHotkeys;
    } catch (error) {
      this.loggerService.error('Failed to update hotkey:', error);
      throw error;
    }
  };

  replaceSettings(newSettings: Setting) {
    this.settings = newSettings;
    this._isInitialized = true;
    this.loggerService.info('SettingsManager.replaceSettings called, settings replaced');
  }
}
