import { app } from 'electron';
import process from 'node:process';

/** Dev: project root (same as SettingsService). Packaged: Electron userData. */
export function resolveUserDataPath(): string {
  return app.isPackaged ? app.getPath('userData') : process.cwd();
}
