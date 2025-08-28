import { safeStorage } from 'electron';
import { Buffer } from 'buffer';
import logService from './LogService.js';

export class SafeStorageService {
  /**
   * Encrypt a string value
   * @param {string} value
   * @returns {string} Base64 encoded encrypted value
   */
  static encrypt(value) {
    if (!value) return value;
    if (typeof value !== 'string') {
      value = String(value);
    }
    const encrypted = safeStorage.encryptString(value);
    return encrypted.toString('base64');
  }

  /**
   * Decrypt a base64 encoded encrypted value
   * @param {string} encryptedValue
   * @returns {string} Decrypted value
   */
  static decrypt(encryptedValue) {
    if (!encryptedValue) return encryptedValue;
    try {
      const buffer = Buffer.from(encryptedValue, 'base64');
      return safeStorage.decryptString(buffer);
    } catch (error) {
      logService.error('Decryption failed:', error);
      return null;
    }
  }

  /**
   * Check if encryption is available
   * @returns {boolean}
   */
  static isEncryptionAvailable() {
    return safeStorage.isEncryptionAvailable();
  }
}
