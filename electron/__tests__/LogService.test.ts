import { describe, expect, it } from 'vitest';
import { fileLogLevel } from '../LogService.js';

describe('fileLogLevel', () => {
  it('uses debug when unpackaged so AI logs reach disk', () => {
    expect(fileLogLevel(false)).toBe('debug');
  });
  it('keeps info when packaged', () => {
    expect(fileLogLevel(true)).toBe('info');
  });
});
