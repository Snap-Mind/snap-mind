import { platform } from 'os';
import { systemPreferences, dialog, shell, app } from 'electron';
import { execSync, execFile } from 'child_process';
import path, { join } from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

class SystemPermissionService {
  private platform: string;
  private resourcePath: string;

  constructor() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    this.platform = platform();
    this.resourcePath = this.isDev() ? path.join(__dirname, '..', '..') : process.resourcesPath;
  }

  isDev() {
    return !app.isPackaged;
  }

  async checkPermissions() {
    switch (this.platform) {
      case 'darwin':
        return this.checkMacOSPermissions();
      case 'win32':
        return this.checkWindowsPermissions();
      default:
        return {
          isGranted: true,
          missingPermissions: [],
        };
    }
  }

  async checkMacOSPermissions() {
    const accessibilityGranted = systemPreferences.isTrustedAccessibilityClient(false);

    const missingPermissions = [];
    if (!accessibilityGranted) {
      missingPermissions.push('accessibility');
    }

    return {
      isGranted: accessibilityGranted,
      missingPermissions,
    };
  }

  async checkWindowsPermissions() {
    // Check for admin rights and UI automation access
    const isAdmin = await this.checkWindowsAdminRights();

    const missingPermissions = [];
    if (!isAdmin) missingPermissions.push('administrator');

    return {
      isGranted: isAdmin,
      missingPermissions,
      hasManifest: true, // Indicate that we have an app manifest
    };
  }

  async checkWindowsAdminRights() {
    try {
      execSync('net session', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  async requestPermissions(permissions) {
    if (this.platform === 'darwin') {
      return this.requestMacOSPermissions(permissions);
    } else if (this.platform === 'win32') {
      return this.requestWindowsPermissions(permissions);
    }
    return true;
  }

  async requestMacOSPermissions(permissions) {
    if (permissions.includes('accessibility')) {
      const response = await dialog.showMessageBox({
        type: 'info',
        title: 'Accessibility Permission Required',
        message: 'This app requires accessibility permission to read selected text.',
        detail:
          'Please open System Settings > Privacy & Security > Accessibility and enable permission for this app.',
        buttons: ['Open System Settings', 'Cancel'],
        defaultId: 0,
      });

      // Open System Settings if user clicked "Open System Settings"
      if (response.response === 0) {
        shell.openExternal(
          'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
        );
      }
    }
    return true;
  }

  async requestWindowsPermissions(permissions) {
    if (permissions.includes('administrator')) {
      await this.showWindowsAdminInstructions();
    }

    if (permissions.includes('uiAutomation')) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'UI Automation Access Required',
        message: 'This app needs permission to access text from other applications.',
        detail:
          'The app has a manifest requesting these permissions, but they may have been denied. Please ensure the app is properly installed and running with elevated privileges.',
        buttons: ['OK'],
        defaultId: 0,
      });
    }

    return true;
  }

  async showWindowsAdminInstructions() {
    return dialog.showMessageBox({
      type: 'info',
      title: 'Administrator Rights Required',
      message: 'This app requires administrator rights to access UI Automation features.',
      detail:
        'The app should have requested elevated permissions at startup. If you declined, please close and restart the app, then accept the elevation prompt when it appears.',
      buttons: ['OK'],
      defaultId: 0,
    });
  }

  async showPermissionDialog(missingPermissions) {
    const permissionList = missingPermissions.join(', ');

    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Permissions Required',
      message: `This app requires the following permissions to function properly: ${permissionList}`,
      detail: 'Would you like to grant these permissions now?',
      buttons: ['Grant Permissions', 'Quit'],
      defaultId: 0,
      cancelId: 1,
    });

    return result.response === 0;
  }
}

export default SystemPermissionService;
