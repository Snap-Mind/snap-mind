import { NativeThemeState } from '@/types';

type ThemeMode = 'light' | 'dark';
type ThemeChangeHandler = (theme: ThemeMode) => void;

export class ThemeService {
  private active: boolean;
  private onThemeChanged: ThemeChangeHandler;

  constructor() {
    this.active = false;
    this.onThemeChanged = null;
  }

  private emitTheme(theme: ThemeMode) {
    if (!this.active || !this.onThemeChanged) return;
    this.onThemeChanged(theme);
  }

  private handleNativeThemeChanged = (state: NativeThemeState) => {
    this.emitTheme(state.theme);
  };

  private async initTheme() {
    if (window.electronAPI?.getNativeTheme) {
      const state = await window.electronAPI.getNativeTheme();
      this.emitTheme(state.theme);
      return;
    }

    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.emitTheme(darkModeMediaQuery.matches ? 'dark' : 'light');
  }

  async initialize(onThemeChanged: ThemeChangeHandler) {
    this.active = true;
    this.onThemeChanged = onThemeChanged;

    await this.initTheme();

    if (window.electronAPI?.onNativeThemeChanged) {
      window.electronAPI.onNativeThemeChanged(this.handleNativeThemeChanged);
    }
  }

  dispose() {
    this.active = false;
    this.onThemeChanged = null;

    if (window.electronAPI?.offNativeThemeChanged) {
      window.electronAPI.offNativeThemeChanged();
    }
  }
}
