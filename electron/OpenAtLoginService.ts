import { app, ipcMain } from 'electron';

import logService from './LogService';

const WINDOWS_LOGIN_ARGS = ['--launch-at-login'];

export default class OpenAtLoginService {
  private isSupported() {
    return process.platform === 'darwin' || process.platform === 'win32';
  }

  isLoginLaunch() {
    if (process.platform === 'darwin') {
      return !!app.getLoginItemSettings().wasOpenedAtLogin;
    }

    if (process.platform === 'win32') {
      return process.argv.includes(WINDOWS_LOGIN_ARGS[0]);
    }

    return false;
  }

  private setOpenAtLogin(enabled: boolean) {
    if (process.platform === 'darwin') {
      app.setLoginItemSettings({
        openAtLogin: enabled,
      });
      return;
    }

    if (process.platform === 'win32') {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        path: process.execPath,
        args: WINDOWS_LOGIN_ARGS,
      });
    }
  }

  private getOpenAtLogin() {
    if (process.platform === 'win32') {
      return !!app.getLoginItemSettings({
        path: process.execPath,
        args: WINDOWS_LOGIN_ARGS,
      }).openAtLogin;
    }

    return !!app.getLoginItemSettings().openAtLogin;
  }

  registerIpcHandlers() {
    ipcMain.handle('app:get-open-at-login', () => {
      return {
        success: true,
        openAtLogin: this.getOpenAtLogin(),
        supported: this.isSupported(),
      };
    });

    ipcMain.handle('app:set-open-at-login', (_event, enabled) => {
      try {
        if (!this.isSupported()) {
          return {
            success: false,
            error: 'Unsupported platform',
            openAtLogin: false,
            supported: false,
          };
        }

        this.setOpenAtLogin(!!enabled);
        return {
          success: true,
          openAtLogin: this.getOpenAtLogin(),
          supported: true,
        };
      } catch (error) {
        logService.error('[open-at-login] Failed to set open at login:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          openAtLogin: this.getOpenAtLogin(),
          supported: true,
        };
      }
    });
  }
}
