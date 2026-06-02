import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as childProcess from 'child_process';
import FoundryCliTokenService from '../FoundryCliTokenService';

const { execFileSpy } = vi.hoisted(() => ({ execFileSpy: vi.fn() }));

vi.mock('child_process', () => ({
  execFile: execFileSpy,
  default: { execFile: execFileSpy },
}));

describe('FoundryCliTokenService', () => {
  const execFileMock = vi.mocked(childProcess.execFile);
  let service: FoundryCliTokenService;

  beforeEach(() => {
    service = new FoundryCliTokenService();
    execFileMock.mockReset();
  });

  it('uses cached token when not near expiration', async () => {
    execFileMock.mockImplementationOnce((_cmd: any, _args: any, _options: any, callback: any) => {
      callback(
        null,
        JSON.stringify({
          accessToken: 'cached-token',
          expires_on: `${Math.floor(Date.now() / 1000) + 3600}`,
        }),
        ''
      );
      return {} as any;
    });

    const token1 = await service.getAccessToken('https://ai.azure.com/.default');
    const token2 = await service.getAccessToken('https://ai.azure.com/.default');

    expect(token1).toBe('cached-token');
    expect(token2).toBe('cached-token');
    expect(execFileMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes token when cached token is about to expire', async () => {
    execFileMock
      .mockImplementationOnce((_cmd: any, _args: any, _options: any, callback: any) => {
        callback(
          null,
          JSON.stringify({
            accessToken: 'soon-expired-token',
            expires_on: `${Math.floor(Date.now() / 1000) + 30}`,
          }),
          ''
        );
        return {} as any;
      })
      .mockImplementationOnce((_cmd: any, _args: any, _options: any, callback: any) => {
        callback(
          null,
          JSON.stringify({
            accessToken: 'refreshed-token',
            expires_on: `${Math.floor(Date.now() / 1000) + 3600}`,
          }),
          ''
        );
        return {} as any;
      });

    const token1 = await service.getAccessToken('https://ai.azure.com/.default');
    const token2 = await service.getAccessToken('https://ai.azure.com/.default');

    expect(token1).toBe('soon-expired-token');
    expect(token2).toBe('refreshed-token');
    expect(execFileMock).toHaveBeenCalledTimes(2);
  });

  it('retries once before surfacing final failure', async () => {
    execFileMock
      .mockImplementationOnce((_cmd: any, _args: any, _options: any, callback: any) => {
        callback(new Error('first attempt failed'), '', "Please run 'az login' to setup account.");
        return {} as any;
      })
      .mockImplementationOnce((_cmd: any, _args: any, _options: any, callback: any) => {
        callback(
          null,
          JSON.stringify({
            accessToken: 'recovered-token',
            expires_on: `${Math.floor(Date.now() / 1000) + 3600}`,
          }),
          ''
        );
        return {} as any;
      });

    const token = await service.getAccessToken('https://ai.azure.com/.default');
    expect(token).toBe('recovered-token');
    expect(execFileMock).toHaveBeenCalledTimes(2);
  });
});
