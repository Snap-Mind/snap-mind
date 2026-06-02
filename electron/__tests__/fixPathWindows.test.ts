import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { execSyncSpy } = vi.hoisted(() => ({ execSyncSpy: vi.fn() }));

vi.mock('child_process', () => ({
  execSync: execSyncSpy,
  default: { execSync: execSyncSpy },
}));

describe('fixPathWindows', () => {
  let originalPlatform: PropertyDescriptor | undefined;
  let originalPath: string | undefined;
  let originalLocalAppData: string | undefined;

  beforeEach(() => {
    vi.resetModules();
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    originalPath = process.env.PATH;
    originalLocalAppData = process.env.LOCALAPPDATA;
    execSyncSpy.mockReset();
  });

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
    process.env.PATH = originalPath;
    if (originalLocalAppData !== undefined) {
      process.env.LOCALAPPDATA = originalLocalAppData;
    }
  });

  function setPlatform(platform: string) {
    Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  }

  async function importFixPathWindows() {
    const mod = await import('../utils/fixPathWindows');
    return mod.default;
  }

  async function importReadRegistryPath() {
    const mod = await import('../utils/fixPathWindows');
    return mod.readRegistryPath;
  }

  it('is a no-op on non-Windows platforms', async () => {
    setPlatform('darwin');
    const fixPathWindows = await importFixPathWindows();
    const added = fixPathWindows();
    expect(added).toEqual([]);
    expect(execSyncSpy).not.toHaveBeenCalled();
  });

  it('merges registry paths missing from process.env.PATH', async () => {
    setPlatform('win32');
    process.env.PATH = 'C:\\existing\\bin';

    execSyncSpy
      .mockReturnValueOnce(
        '\r\n    Path    REG_EXPAND_SZ    C:\\existing\\bin;C:\\Windows\\system32\r\n\r\n'
      )
      .mockReturnValueOnce(
        '\r\n    Path    REG_EXPAND_SZ    C:\\Users\\me\\AppData\\Local\\Programs\\Azure CLI\\wbin\r\n\r\n'
      );

    const fixPathWindows = await importFixPathWindows();
    const added = fixPathWindows();

    expect(added).toEqual([
      'C:\\Windows\\system32',
      'C:\\Users\\me\\AppData\\Local\\Programs\\Azure CLI\\wbin',
    ]);
    expect(process.env.PATH).toBe(
      'C:\\existing\\bin;C:\\Windows\\system32;C:\\Users\\me\\AppData\\Local\\Programs\\Azure CLI\\wbin'
    );
  });

  it('deduplicates case-insensitively', async () => {
    setPlatform('win32');
    process.env.PATH = 'C:\\Windows\\System32';

    execSyncSpy.mockReturnValue('\r\n    Path    REG_SZ    c:\\windows\\system32\r\n\r\n');

    const fixPathWindows = await importFixPathWindows();
    const added = fixPathWindows();

    expect(added).toEqual([]);
    expect(process.env.PATH).toBe('C:\\Windows\\System32');
  });

  it('expands %VAR% references using process.env', async () => {
    setPlatform('win32');
    process.env.PATH = '';
    process.env.LOCALAPPDATA = 'C:\\Users\\me\\AppData\\Local';

    execSyncSpy
      .mockReturnValueOnce(
        '\r\n    Path    REG_EXPAND_SZ    %LOCALAPPDATA%\\Programs\\Azure CLI\\wbin\r\n\r\n'
      )
      .mockImplementationOnce(() => { throw new Error('not found'); });

    const fixPathWindows = await importFixPathWindows();
    const added = fixPathWindows();

    expect(added).toEqual(['C:\\Users\\me\\AppData\\Local\\Programs\\Azure CLI\\wbin']);
  });

  it('survives registry read failures gracefully', async () => {
    setPlatform('win32');
    process.env.PATH = 'C:\\existing';

    execSyncSpy.mockImplementation(() => { throw new Error('Access denied'); });

    const fixPathWindows = await importFixPathWindows();
    const added = fixPathWindows();

    expect(added).toEqual([]);
    expect(process.env.PATH).toBe('C:\\existing');
  });

  it('handles partial registry failure (one key works, one throws)', async () => {
    setPlatform('win32');
    process.env.PATH = '';

    execSyncSpy
      .mockImplementationOnce(() => { throw new Error('Access denied'); })
      .mockReturnValueOnce('\r\n    Path    REG_SZ    C:\\az\\wbin\r\n\r\n');

    const fixPathWindows = await importFixPathWindows();
    const added = fixPathWindows();

    expect(added).toEqual(['C:\\az\\wbin']);
  });

  it('parses REG_SZ values', async () => {
    execSyncSpy.mockReturnValue(
      '\r\n    Path    REG_SZ    C:\\Program Files\\Azure CLI\\wbin\r\n\r\n'
    );

    const readRegistryPath = await importReadRegistryPath();
    expect(readRegistryPath('HKCU\\Environment')).toBe('C:\\Program Files\\Azure CLI\\wbin');
  });

  it('parses REG_EXPAND_SZ values and expands variables', async () => {
    process.env.SystemRoot = 'C:\\Windows';
    execSyncSpy.mockReturnValue(
      '\r\n    Path    REG_EXPAND_SZ    %SystemRoot%\\system32;C:\\bin\r\n\r\n'
    );

    const readRegistryPath = await importReadRegistryPath();
    expect(
      readRegistryPath('HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment')
    ).toBe('C:\\Windows\\system32;C:\\bin');
  });

  it('returns empty string when pattern does not match', async () => {
    execSyncSpy.mockReturnValue('some unexpected output');

    const readRegistryPath = await importReadRegistryPath();
    expect(readRegistryPath('HKCU\\Environment')).toBe('');
  });
});
