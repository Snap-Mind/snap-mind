import { BrowserWindow, ipcMain, nativeTheme } from 'electron';
import logService from './LogService';

type AppearanceMode = 'light' | 'dark' | 'auto';
type RendererTheme = 'light' | 'dark';

interface ThemeServiceOptions {
  getAppearanceMode: () => unknown;
}

class ThemeService {
  private getAppearanceModeFn: () => unknown;

  constructor(options: ThemeServiceOptions) {
    this.getAppearanceModeFn = options.getAppearanceMode;
  }

  private toThemeSource(mode: AppearanceMode): 'system' | 'light' | 'dark' {
    if (mode === 'light' || mode === 'dark') {
      return mode;
    }
    return 'system';
  }

  private toAppearanceMode(mode: unknown): AppearanceMode {
    if (mode === 'light' || mode === 'dark' || mode === 'auto') {
      return mode;
    }
    return 'auto';
  }

  private getCurrentAppearanceMode(): AppearanceMode {
    return this.toAppearanceMode(this.getAppearanceModeFn());
  }

  private getResolvedRendererTheme(mode: AppearanceMode): RendererTheme {
    if (mode === 'auto') {
      return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    }
    return mode;
  }

  getThemeState(mode?: AppearanceMode): { mode: AppearanceMode; theme: RendererTheme } {
    const currentMode = mode || this.getCurrentAppearanceMode();
    return {
      mode: currentMode,
      theme: this.getResolvedRendererTheme(currentMode),
    };
  }

  broadcastThemeChanged(mode?: AppearanceMode) {
    const payload = this.getThemeState(mode);
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('theme:changed', payload);
    });
  }

  applyNativeThemeFromSettings(themeMode: unknown) {
    const mode = this.toAppearanceMode(themeMode);
    const nextSource = this.toThemeSource(mode);
    if (nativeTheme.themeSource !== nextSource) {
      nativeTheme.themeSource = nextSource;
      logService.info('[main] Applied native theme source:', nextSource);
    }

    this.broadcastThemeChanged(mode);
  }

  registerIpcHandlers() {
    ipcMain.handle('theme:get', () => {
      return this.getThemeState();
    });
  }

  initialize() {
    this.applyNativeThemeFromSettings(this.getCurrentAppearanceMode());

    nativeTheme.on('updated', () => {
      if (nativeTheme.themeSource === 'system') {
        this.broadcastThemeChanged('auto');
      }
    });
  }
}

export default ThemeService;
