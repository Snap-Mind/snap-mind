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
    let targetPath = path.join(this.userDataPath, fileName);

    if (!fs.existsSync(targetPath)) {
      // Find default file in packaged resources
      let defaultPath = path.join(this.resourcesPath, defaultFileName);

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
    this.settings = this.processApiKeys(mergedSettings, false);

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
      logService.info('Failed to load default settings:', error);
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
      logService.info('No stored settings found, using defaults');
      return {};
    }
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
    const newSettings = { ...this.settings };
    let current = newSettings;

    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i];
      if (typeof key === 'number') {
        if (!Array.isArray(current)) {
          current = [];
        }
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      } else {
        if (!(key in current)) {
          current[key] = {};
        }
        current = current[key];
      }
    }

    const lastKey = path[path.length - 1];
    if (typeof lastKey === 'number' && Array.isArray(current)) {
      current[lastKey] = value;
    } else {
      current[lastKey] = value;
    }

    await this.saveSettings(newSettings);
    return this.settings;
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
}

export default SettingsService;
