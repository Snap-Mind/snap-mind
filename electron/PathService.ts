import { app } from 'electron';
import fixPath from 'fix-path';
import fixPathWindows from './utils/fixPathWindows';
import logService from './LogService';

class PathService {
  private logger = logService.scope('PathService');

  fix(): void {
    if (!app.isPackaged) return;

    if (process.platform === 'darwin') {
      fixPath();
      this.logger.info(`PATH restored from login shell: ${process.env.PATH}`);
    } else if (process.platform === 'win32') {
      const added = fixPathWindows();
      if (added.length > 0) {
        this.logger.info(`PATH augmented with ${added.length} registry entries`);
      }
    }
  }
}

export default new PathService();
