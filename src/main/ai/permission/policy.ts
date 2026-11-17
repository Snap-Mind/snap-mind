import { MODE_TABLE } from './modes.js';
import type { Mode, Risk, Decision } from './modes.js';

export function checkPermission(_toolName: string, risk: Risk, mode: Mode): Decision {
  return MODE_TABLE[mode][risk];
}
