import { describe, expect, it, vi } from 'vitest';

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(
    (_bin: string, _args: string[], cb: (err: any, stdout: string, stderr: string) => void) => {
      cb(null, JSON.stringify({ success: true, selectedText: 'HELLO' }), '');
    }
  ),
}));

vi.mock('child_process', () => ({
  execFile: execFileMock,
  default: { execFile: execFileMock },
}));

vi.mock('electron', () => ({
  app: {
    requestSingleInstanceLock: vi.fn(() => true),
    quit: vi.fn(),
    on: vi.fn(),
    whenReady: vi.fn(() => new Promise(() => {})),
    isPackaged: false,
    getPath: vi.fn(() => '/mock/userData'),
    getVersion: vi.fn(() => '0.0.0'),
    setActivationPolicy: vi.fn(),
    isQuitting: false,
    dock: { setMenu: vi.fn() },
  },
  BrowserWindow: Object.assign(
    vi.fn().mockImplementation(function () {
      return {
        loadURL: vi.fn().mockResolvedValue(undefined),
        loadFile: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        webContents: { send: vi.fn(), setWindowOpenHandler: vi.fn(), id: 1 },
        setTitle: vi.fn(),
        isMinimized: vi.fn(() => false),
        isVisible: vi.fn(() => false),
        show: vi.fn(),
        focus: vi.fn(),
        restore: vi.fn(),
        hide: vi.fn(),
        setAlwaysOnTop: vi.fn(),
        isDestroyed: vi.fn(() => false),
        destroy: vi.fn(),
      };
    }),
    { getAllWindows: vi.fn(() => []) }
  ),
  globalShortcut: { register: vi.fn(), unregisterAll: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  Tray: vi.fn().mockImplementation(function () {
    return { setContextMenu: vi.fn(), on: vi.fn(), setImage: vi.fn() };
  }),
  Menu: { buildFromTemplate: vi.fn(() => ({})) },
  nativeImage: {
    createFromPath: vi.fn(() => ({ setTemplateImage: vi.fn(), isEmpty: vi.fn(() => false) })),
  },
  nativeTheme: { shouldUseDarkColors: false, on: vi.fn() },
  screen: {
    getPrimaryDisplay: vi.fn(() => ({ workAreaSize: { width: 1920, height: 1080 } })),
  },
  shell: { openExternal: vi.fn(), openPath: vi.fn(), showItemInFolder: vi.fn() },
}));

vi.mock('electron-updater', () => ({
  autoUpdater: {
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    quitAndInstall: vi.fn(),
  },
}));

// Import the helper AFTER mocks so the module picks up mocked dependencies.
import { runSelectionHelper } from '../../main';

describe('runSelectionHelper', () => {
  it('resolves { text, prompt } when helper reports success', async () => {
    const seed = await runSelectionHelper('translate:');
    expect(seed).toEqual({ text: 'HELLO', prompt: 'translate:' });
  });
});
