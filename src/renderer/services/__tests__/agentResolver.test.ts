import { describe, it, expect } from 'vitest';
import { resolveAgent, agentErrorMessage, findBuiltinAgentId } from '../agentResolver';
import type { AgentDTO } from '@/types/agent-dto';
import type { ProviderDTO } from '@/types/provider-dto';

const model = {
  id: 10,
  modelId: 'gpt-4o',
  name: 'GPT-4o',
  type: 'chat',
  capabilities: [],
  description: null,
};

const openai: ProviderDTO = {
  id: 1,
  kind: 'openai',
  name: 'OpenAI',
  host: 'https://api.openai.com/v1',
  apiKey: 'sk-x',
  description: null,
  models: [model],
};

const ollama: ProviderDTO = {
  id: 2,
  kind: 'ollama',
  name: 'Ollama (Local)',
  host: 'http://localhost:11434/api/chat',
  apiKey: '',
  description: null,
  models: [{ ...model, id: 20, modelId: 'llama3' }],
};

function agent(over: Partial<AgentDTO> = {}): AgentDTO {
  return {
    id: 5,
    name: 'Translate',
    description: null,
    instructions: 'Translate:',
    providerId: 1,
    modelId: 10,
    isBuiltin: false,
    ...over,
  };
}

describe('resolveAgent', () => {
  it('resolves a bound agent', () => {
    const res = resolveAgent(5, [agent()], [openai]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.provider.id).toBe(1);
      expect(res.model.modelId).toBe('gpt-4o');
    }
  });

  it('reports no-agent for a null id or an unknown id', () => {
    expect(resolveAgent(null, [agent()], [openai])).toEqual({ ok: false, reason: 'no-agent' });
    expect(resolveAgent(999, [agent()], [openai])).toEqual({ ok: false, reason: 'no-agent' });
  });

  it('reports unbound when the agent has no provider or model', () => {
    const res = resolveAgent(5, [agent({ providerId: null, modelId: null })], [openai]);
    expect(res).toEqual({ ok: false, reason: 'unbound', agentName: 'Translate' });
  });

  it('reports missing-model when the bound rows no longer exist', () => {
    const res = resolveAgent(5, [agent({ providerId: 77, modelId: 88 })], [openai]);
    expect(res).toEqual({ ok: false, reason: 'missing-model', agentName: 'Translate' });
  });

  it('reports no-api-key for a keyless provider that needs one', () => {
    const res = resolveAgent(5, [agent()], [{ ...openai, apiKey: '' }]);
    expect(res).toEqual({
      ok: false,
      reason: 'no-api-key',
      agentName: 'Translate',
      providerName: 'OpenAI',
    });
  });

  it('exempts ollama from the api key check', () => {
    const res = resolveAgent(5, [agent({ providerId: 2, modelId: 20 })], [ollama]);
    expect(res.ok).toBe(true);
  });
});

describe('agentErrorMessage', () => {
  it('names the agent and the page that fixes it', () => {
    expect(agentErrorMessage({ ok: false, reason: 'no-agent' })).toMatch(/Settings > Hotkeys/);
    expect(agentErrorMessage({ ok: false, reason: 'unbound', agentName: 'Translate' })).toMatch(
      /Translate/
    );
    expect(
      agentErrorMessage({
        ok: false,
        reason: 'no-api-key',
        agentName: 'Translate',
        providerName: 'OpenAI',
      })
    ).toMatch(/OpenAI/);
  });
});

describe('findBuiltinAgentId', () => {
  it('returns the built-in agent id, or null when there is none', () => {
    expect(findBuiltinAgentId([agent(), agent({ id: 1, isBuiltin: true })])).toBe(1);
    expect(findBuiltinAgentId([agent()])).toBeNull();
  });
});
