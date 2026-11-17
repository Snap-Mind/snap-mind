import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../registry.js';
import type { ToolDef } from '../registry.js';

const translateDef: ToolDef = {
  name: 'translate',
  description: 'Translate text to a target language',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      targetLanguage: { type: 'string' },
    },
    required: ['text', 'targetLanguage'],
  },
  risk: 'safe',
  async execute(_input: unknown, _ctx) {
    return 'translated';
  },
};

describe('ToolRegistry', () => {
  it('register then list returns the def', () => {
    const r = new ToolRegistry();
    r.register(translateDef);
    const tools = r.list();
    expect(tools).toHaveLength(1);
    expect(tools[0]).toBe(translateDef);
  });

  it('get returns undefined for unknown name', () => {
    const r = new ToolRegistry();
    expect(r.get('unknown')).toBeUndefined();
  });

  it('get returns the def for a registered name', () => {
    const r = new ToolRegistry();
    r.register(translateDef);
    expect(r.get('translate')).toBe(translateDef);
  });

  it('rejects the reserved name invoke_agent', () => {
    const r = new ToolRegistry();
    expect(() => r.register({ ...translateDef, name: 'invoke_agent' })).toThrow(/reserved/);
  });

  it('rejects duplicate names', () => {
    const r = new ToolRegistry();
    r.register(translateDef);
    expect(() => r.register(translateDef)).toThrow(/already registered/);
  });
});
