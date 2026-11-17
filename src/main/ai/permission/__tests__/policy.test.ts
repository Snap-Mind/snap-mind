import { describe, it, expect } from 'vitest';
import { checkPermission } from '../policy.js';
import { PERMISSION_MODE } from '../modes.js';
import type { Mode, Risk, Decision } from '../modes.js';

describe('PermissionPolicy', () => {
  it('PERMISSION_MODE is default', () => {
    expect(PERMISSION_MODE).toBe('default');
  });

  it.each<[Mode, Risk, Decision]>([
    // default mode
    ['default', 'safe', 'allow'],
    ['default', 'moderate', 'ask'],
    ['default', 'dangerous', 'ask'],
    // acceptEdits mode
    ['acceptEdits', 'safe', 'allow'],
    ['acceptEdits', 'moderate', 'allow'],
    ['acceptEdits', 'dangerous', 'ask'],
    // plan mode
    ['plan', 'safe', 'allow'],
    ['plan', 'moderate', 'deny'],
    ['plan', 'dangerous', 'deny'],
    // bypassPermissions mode
    ['bypassPermissions', 'safe', 'allow'],
    ['bypassPermissions', 'moderate', 'allow'],
    ['bypassPermissions', 'dangerous', 'allow'],
    // dontAsk mode
    ['dontAsk', 'safe', 'allow'],
    ['dontAsk', 'moderate', 'deny'],
    ['dontAsk', 'dangerous', 'deny'],
  ])('checkPermission(%s, %s) returns %s', (mode, risk, expected) => {
    const result = checkPermission('test_tool', risk, mode);
    expect(result).toBe(expected);
  });
});
