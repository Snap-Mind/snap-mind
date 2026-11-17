export type Risk = 'safe' | 'moderate' | 'dangerous';
export type Mode = 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions' | 'dontAsk';
export type Decision = 'allow' | 'deny' | 'ask';

export const MODE_TABLE: Record<Mode, Record<Risk, Decision>> = {
  default: {
    safe: 'allow',
    moderate: 'ask',
    dangerous: 'ask',
  },
  acceptEdits: {
    safe: 'allow',
    moderate: 'allow',
    dangerous: 'ask',
  },
  plan: {
    safe: 'allow',
    moderate: 'deny',
    dangerous: 'deny',
  },
  bypassPermissions: {
    safe: 'allow',
    moderate: 'allow',
    dangerous: 'allow',
  },
  dontAsk: {
    safe: 'allow',
    moderate: 'deny',
    dangerous: 'deny',
  },
};

export const PERMISSION_MODE: Mode = 'default';
