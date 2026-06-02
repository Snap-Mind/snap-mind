import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fixPathSpy, fixPathWindowsSpy } = vi.hoisted(() => ({
  fixPathSpy: vi.fn(),
  fixPathWindowsSpy: vi.fn(() => []),
}));

vi.mock('fix-path', () => ({ default: fixPathSpy }));
vi.mock('../utils/fixPathWindows', () => ({ default: fixPathWindowsSpy }));
vi.mock('electron', () => ({ app: { isPackaged: true } }));
vi.mock('../LogService', () => ({ default: { scope: () => ({ info: vi.fn() }) } }));

describe('PathService', () => {
  let originalPlatform: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.resetModules();
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    fixPathSpy.mockReset();
    fixPathWindowsSpy.mockReset().mockReturnValue([]);
  });

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
  });

  function setPlatform(platform: string) {
    Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  }

  async function importService() {
    const mod = await import('../PathService');
    return mod.default;
  }

  it('calls fix-path on macOS', async () => {
    setPlatform('darwin');
    const service = await importService();
    service.fix();
    expect(fixPathSpy).toHaveBeenCalledOnce();
    expect(fixPathWindowsSpy).not.toHaveBeenCalled();
  });

  it('calls fixPathWindows on Windows', async () => {
    setPlatform('win32');
    fixPathWindowsSpy.mockReturnValue(['C:\\new\\path']);
    const service = await importService();
    service.fix();
    expect(fixPathWindowsSpy).toHaveBeenCalledOnce();
    expect(fixPathSpy).not.toHaveBeenCalled();
  });

  it('is a no-op on unsupported platforms', async () => {
    setPlatform('linux');
    const service = await importService();
    service.fix();
    expect(fixPathSpy).not.toHaveBeenCalled();
    expect(fixPathWindowsSpy).not.toHaveBeenCalled();
  });
});
