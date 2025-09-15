import fs from 'fs';
import path from 'path';
import process from 'process';
import { app } from 'electron';

import { SafeStorageService } from './SafeStorageService.js';
import logService from './LogService.js';
import { mergeDeep } from './utils/mergeDeep.js';

const __rootdir = process.cwd();

class SettingsService {
  private userDataPath: string;
  private resourcesPath: string;
  private settingsPath: string;
  private hotkeysPath: string;
  private settings: any;
  private hotkeys: any[];
  private encryptedFields: string[];

  constructor() {
    this.userDataPath = app.isPackaged ? app.getPath('userData') : __rootdir;
    this.resourcesPath = app.isPackaged ? process.resourcesPath : __rootdir;
    this.settingsPath = path.join(this.userDataPath, 'settings.json');
    this.hotkeysPath = path.join(this.userDataPath, 'hotkeys.json');
    this.settings = {};
    this.hotkeys = [];

    this.encryptedFields = ['general.azureApiKey'];
  }

  /**
   * Ensure default config file exists
   * @param {string} fileName
   * @param {string} defaultFileName
   */
  ensureDefaultConfig(fileName, defaultFileName) {
    const targetPath = path.join(this.userDataPath, fileName);

    if (!fs.existsSync(targetPath)) {
      // Find default file in packaged resources
      const defaultPath = path.join(this.resourcesPath, defaultFileName);

      if (fs.existsSync(defaultPath)) {
        fs.copyFileSync(defaultPath, targetPath);
        logService.info(`Default ${fileName} copied to userData`);
      }
    }
  }

  /**
   * initialize config files
   */
  initializeConfigs() {
    if (app.isPackaged) {
      // Stabilize userData path and refresh cached paths
      this.stabilizeUserDataAndMigrate();
      this.refreshPaths();
    }

    this.ensureDefaultConfig('settings.json', 'settings.default.json');
    this.ensureDefaultConfig('hotkeys.json', 'hotkeys.default.json');

    // Load both default and user settings
    const defaultSettings = this.loadDefaultSettings();
    const userSettings = this.loadSettings();

    // Check if we need to set system language
    if (!userSettings.general?.language && !defaultSettings.general?.language) {
      const systemLocale = app.getSystemLocale();
      // Handle special cases for Chinese variants
      let systemLanguage;
      if (systemLocale.startsWith('zh')) {
        // zh-CN -> zh-Hans (Simplified Chinese)
        // zh-TW/zh-HK -> zh-Hant (Traditional Chinese)
        systemLanguage = systemLocale.includes('CN') ? 'zh-Hans' : 'zh-Hant';
      } else {
        // For other languages, just take the primary language part
        systemLanguage = systemLocale.split('-')[0];
      }
      if (!userSettings.general) userSettings.general = {};
      userSettings.general.language = systemLanguage;
      logService.info(`Setting default language to system locale: ${systemLanguage}`);
    }

    // Deep merge default settings with user settings
    // This will preserve all user settings while adding any missing fields from default settings
    const mergedSettings = mergeDeep(userSettings, defaultSettings);
    // Add app info to the settings
    mergedSettings.general.app = {
      version: app.getVersion(),
    };
    // Encrypt any API keys
    this.settings = this.processApiKeys(mergedSettings, false);

    // Load hotkeys
    this.loadHotkeys();
  }

  /**
   * Load default settings from file
   * @private
   */
  loadDefaultSettings() {
    try {
      const defaultSettingsPath = path.join(this.resourcesPath, 'settings.default.json');
      const data = fs.readFileSync(defaultSettingsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logService.error('Failed to load default settings:', error);
      return {};
    }
  }

  /**
   * Load settings from file
   * @private
   */
  loadSettings() {
    try {
      const data = fs.readFileSync(this.settingsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logService.error('No stored settings found, using defaults', error);
      return {};
    }
  }

  /**
   * Get all settings
   */
  getSettings() {
    return this.settings;
  }

  /**
   * Get setting by path
   * @param {string[]} path - Path to setting
   */
  getSetting(path) {
    let current = this.settings;
    for (const key of path) {
      if (current === undefined) return undefined;
      current = current[key];
    }
    return current;
  }

  /**
   * Update settings
   * @param {Object} newSettings
   */
  async updateSettings(newSettings) {
    await this.saveSettings(newSettings);
    return this.settings;
  }

  /**
   * Update specific setting by path
   * @param {string[]} path - Path to setting
   * @param {any} value - New value
   */
  async updateSetting(path, value) {
    const newSettings = this.updateObjectByPath(this.settings, path, value);
    await this.saveSettings(newSettings);
    return this.settings;
  }

  /**
   * Save settings to file
   * @private
   */
  async saveSettings(newSettings) {
    try {
      const secureSettings = this.processApiKeys(newSettings, true);
      fs.writeFileSync(this.settingsPath, JSON.stringify(secureSettings, null, 2));
      this.settings = newSettings;
      logService.info('Settings saved successfully');
    } catch (error) {
      logService.error('Failed to save settings:', error);
      throw error;
    }
  }

  /**
   * Load hotkeys from file
   * @private
   */
  loadHotkeys() {
    try {
      const stored = fs.readFileSync(this.hotkeysPath, 'utf8');
      this.hotkeys = JSON.parse(stored);
    } catch {
      logService.info('No stored hotkeys found, using defaults');
    }
  }

  /**
   * Get all hotkeys
   */
  getHotkeys() {
    return this.hotkeys;
  }

  /**
   * Update hotkeys
   * @param {Array} newHotkeys
   */
  async updateHotkeys(newHotkeys) {
    await this.saveHotkeys(newHotkeys);
    return this.hotkeys;
  }

  /**
   * Update a single hotkey field by path. Reuses the same update logic as updateSetting.
   * @param {Array<string|number>} path
   * @param {any} value
   */
  async updateHotkey(path, value) {
    const newHotkeys = this.updateObjectByPath(this.hotkeys, path, value);
    await this.saveHotkeys(newHotkeys);
    return this.hotkeys;
  }

  /**
   * Save hotkeys to file
   * @private
   */
  saveHotkeys(newHotkeys) {
    try {
      fs.writeFileSync(this.hotkeysPath, JSON.stringify(newHotkeys, null, 2));
      this.hotkeys = newHotkeys;
      logService.info('Hotkeys saved successfully');
    } catch (error) {
      logService.error('Failed to save hotkeys:', error);
    }
  }

  processApiKeys(settings, encrypt = true) {
    const processed = JSON.parse(JSON.stringify(settings));

    if (processed.providers && Array.isArray(processed.providers)) {
      processed.providers.forEach((provider) => {
        if (provider.apiKey) {
          provider.apiKey = encrypt
            ? SafeStorageService.encrypt(provider.apiKey)
            : SafeStorageService.decrypt(provider.apiKey);
        }
      });
    }

    return processed;
  }

  processSecureFields(settings, encrypt = true) {
    const processed = JSON.parse(JSON.stringify(settings));

    this.encryptedFields.forEach((fieldPath) => {
      const parts = fieldPath.split('.');
      let current = processed;

      // Navigate to the parent object
      for (let i = 0; i < parts.length - 1; i++) {
        if (current[parts[i]] === undefined) break;
        current = current[parts[i]];
      }

      const lastPart = parts[parts.length - 1];
      if (!current || current[lastPart] === undefined) {
        return;
      }

      if (encrypt) {
        current[lastPart] = SafeStorageService.encrypt(current[lastPart]);
      } else {
        current[lastPart] = SafeStorageService.decrypt(current[lastPart]);
      }
    });

    return processed;
  }

  /**
   * Get the log directory path
   * @returns {string} The path to the log directory
   */
  getLogPath() {
    return logService.getLogPath();
  }

  /**
   * Get the current log file
   * @returns {string} The path to the current log file
   */
  getCurrentLogFile() {
    return logService.getCurrentLogFile();
  }

  /**
   * Generic immutable updater for objects/arrays by path.
   * path is an array of keys (string) or indices (number).
   * Returns a new object/array with the value applied.
   */
  updateObjectByPath(original: any, path: Array<string | number>, value: any): any {
    // Pure function: never mutate `original`, always return a new object/array structure
    if (!Array.isArray(path)) throw new Error('path must be an array');

    // Empty path replaces the whole object
    if (path.length === 0) return value;
    const setAt = (obj: any, index: number): any => {
      const key = path[index];
      const isLast = index === path.length - 1;

      // compute the value for this key: either the provided value (last) or recurse
      const nextValue = isLast ? value : setAt(obj && obj[key], index + 1);

      if (typeof key === 'number') {
        const arr = Array.isArray(obj) ? obj.slice() : [];
        const idx = key;
        while (arr.length <= idx) arr.push(undefined);
        arr[idx] = nextValue;
        return arr;
      }

      const base = obj && typeof obj === 'object' && !Array.isArray(obj) ? { ...obj } : {};
      base[key] = nextValue;
      return base;
    };

    return setAt(original, 0);
  }

  /**
   * Ensure userData path is stable across renames and migrate legacy files if needed.
   * Must be called before reading/writing settings/hotkeys.
   */
  private stabilizeUserDataAndMigrate() {
    try {
      const desiredFolderName = 'SnapMind';
      const appDataBase = app.getPath('appData');
      const desiredUserData = path.join(appDataBase, desiredFolderName);
      const currentUserData = app.getPath('userData');

      if (currentUserData === desiredUserData) {
        return; // already stable
      }

      const candidates = [
        path.join(appDataBase, 'snap-mind'),
        path.join(appDataBase, 'Snapmind'),
        path.join(appDataBase, 'snapmind'),
      ].filter((p) => p !== desiredUserData);

      const exists = (p: string) => {
        try {
          return fs.existsSync(p);
        } catch {
          return false;
        }
      };
      const ensureDir = (p: string) => {
        try {
          fs.mkdirSync(p, { recursive: true });
        } catch (e: any) {
          // If the path exists and is a directory, mkdirSync with recursive
          // should be a no-op, but handle and log unexpected errors to aid debugging.
          if (e && e.code && (e.code === 'EEXIST' || e.code === 'EISDIR')) {
            // harmless — directory already exists
            return;
          }
          logService.warn('[settings] Failed to ensure directory', p, e);
        }
      };
      const copyIfExists = (fromDir: string, file: string, toDir: string) => {
        const src = path.join(fromDir, file);
        const dst = path.join(toDir, file);
        try {
          if (exists(src) && !exists(dst)) {
            fs.copyFileSync(src, dst);
            logService.info(`[settings] Migrated ${file} from`, fromDir, 'to', toDir);
          }
        } catch (e) {
          logService.warn('[settings] Failed to migrate', file, 'from', src, 'to', dst, e);
        }
      };

      ensureDir(desiredUserData);
      const targetMissingSettings = !exists(path.join(desiredUserData, 'settings.json'));
      const targetMissingHotkeys = !exists(path.join(desiredUserData, 'hotkeys.json'));
      if (targetMissingSettings || targetMissingHotkeys) {
        for (const c of candidates) {
          if (exists(c)) {
            if (targetMissingSettings) copyIfExists(c, 'settings.json', desiredUserData);
            if (targetMissingHotkeys) copyIfExists(c, 'hotkeys.json', desiredUserData);
            break;
          }
        }
      }

      app.setPath('userData', desiredUserData);
      logService.info('[settings] userData path set to', desiredUserData);
    } catch (e) {
      logService.warn('[settings] Failed to stabilize userData path; using default', e);
    }
  }

  /** Refresh cached file paths from current app userData path */
  private refreshPaths() {
    this.userDataPath = app.getPath('userData');
    this.settingsPath = path.join(this.userDataPath, 'settings.json');
    this.hotkeysPath = path.join(this.userDataPath, 'hotkeys.json');
  }
}

export default SettingsService;
