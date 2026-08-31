import { describe, expect, it } from 'vitest';

import type { AgentDTO } from '@/types/agent-dto';
import {
  agentFormIsDirty,
  defaultAgentFormIsDirty,
  validateAgentForm,
  validateDefaultAgentForm,
  type AgentFormValues,
} from '../agentFormValidation';

const t = (key: string) => key;

const baseAgent: AgentDTO = {
  id: 1,
  name: 'Translate',
  description: 'Translates text',
  instructions: 'Translate to Chinese.',
  providerId: 2,
  modelId: 3,
  maxTokens: 2048,
  temperature: 0.7,
  topP: 0.95,
  reasoning: false,
  webSearch: false,
  isBuiltin: false,
};

const baseValues: AgentFormValues = {
  name: 'Translate',
  description: 'Translates text',
  instructions: 'Translate to Chinese.',
  providerId: 2,
  modelId: 3,
  maxTokens: 2048,
  temperature: 0.7,
  topP: 0.95,
  reasoning: false,
  webSearch: false,
};

describe('validateAgentForm', () => {
  it('returns no errors when required fields are filled', () => {
    expect(validateAgentForm(baseValues, t)).toEqual({});
  });

  it('requires a non-empty name', () => {
    expect(validateAgentForm({ ...baseValues, name: '   ' }, t)).toEqual({
      name: 'settings.agents.nameRequired',
    });
  });

  it('requires provider and model', () => {
    expect(
      validateAgentForm({ ...baseValues, providerId: null, modelId: null }, t)
    ).toEqual({
      providerId: 'settings.agents.providerRequired',
      modelId: 'settings.agents.modelRequired',
    });
  });

  it('requires model to exist for the selected provider', () => {
    expect(validateAgentForm(baseValues, t, { modelIds: [99] })).toEqual({
      modelId: 'settings.agents.modelRequired',
    });
  });
});

describe('validateDefaultAgentForm', () => {
  it('requires provider and model only', () => {
    expect(validateDefaultAgentForm({ providerId: null, modelId: null }, t)).toEqual({
      providerId: 'settings.agents.providerRequired',
      modelId: 'settings.agents.modelRequired',
    });
  });
});

describe('agentFormIsDirty', () => {
  it('returns false when values match the saved agent', () => {
    expect(agentFormIsDirty(baseValues, baseAgent)).toBe(false);
  });

  it('returns true when a text field changed', () => {
    expect(agentFormIsDirty({ ...baseValues, name: 'Renamed' }, baseAgent)).toBe(true);
  });

  it('returns true when a param changed', () => {
    expect(agentFormIsDirty({ ...baseValues, maxTokens: 4096 }, baseAgent)).toBe(true);
  });
});

describe('defaultAgentFormIsDirty', () => {
  it('returns true when provider changed', () => {
    expect(
      defaultAgentFormIsDirty({ ...baseValues, providerId: 99 }, baseAgent)
    ).toBe(true);
  });
});
