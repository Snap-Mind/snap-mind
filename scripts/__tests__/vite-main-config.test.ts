import { describe, expect, it } from 'vitest';
import config from '../../vite.config.main';

describe('vite.config.main', () => {
  // Vite 8 (rolldown) defaults ES-module builds to the browser platform, where the
  // `require` shim for bundled CommonJS deps (electron-log, electron-updater, ...) throws
  // at startup. The node platform shims `require` with `createRequire(import.meta.url)`.
  it('bundles the main process for the node platform', () => {
    expect(config.build?.rollupOptions?.platform).toBe('node');
  });
});
