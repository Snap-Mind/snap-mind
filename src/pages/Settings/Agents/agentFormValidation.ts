import type { AgentDTO } from '@/types/agent-dto';

export type AgentFormField = 'name' | 'providerId' | 'modelId';

export type AgentFormErrors = Partial<Record<AgentFormField, string>>;

export interface AgentFormValues {
  name: string;
  description: string;
  instructions: string;
  providerId: number | null;
  modelId: number | null;
  maxTokens: number;
  temperature: number;
  topP: number;
  reasoning: boolean;
  webSearch: boolean;
}

type Translate = (key: string) => string;

export interface ValidateAgentFormOptions {
  modelIds?: number[];
}

function isValidModelId(modelId: number | null, modelIds?: number[]): boolean {
  if (modelId == null || Number.isNaN(modelId)) return false;
  if (modelIds == null) return true;
  return modelIds.includes(modelId);
}

export function validateAgentForm(
  values: AgentFormValues,
  t: Translate,
  options?: ValidateAgentFormOptions
): AgentFormErrors {
  const errors: AgentFormErrors = {};
  if (!values.name.trim()) {
    errors.name = t('settings.agents.nameRequired');
  }
  if (values.providerId == null || Number.isNaN(values.providerId)) {
    errors.providerId = t('settings.agents.providerRequired');
  }
  if (!isValidModelId(values.modelId, options?.modelIds)) {
    errors.modelId = t('settings.agents.modelRequired');
  }
  return errors;
}

export function validateDefaultAgentForm(
  values: Pick<AgentFormValues, 'providerId' | 'modelId'>,
  t: Translate,
  options?: ValidateAgentFormOptions
): AgentFormErrors {
  const errors: AgentFormErrors = {};
  if (values.providerId == null || Number.isNaN(values.providerId)) {
    errors.providerId = t('settings.agents.providerRequired');
  }
  if (!isValidModelId(values.modelId, options?.modelIds)) {
    errors.modelId = t('settings.agents.modelRequired');
  }
  return errors;
}

function agentParamsMatch(values: AgentFormValues, agent: AgentDTO): boolean {
  return (
    values.maxTokens === (agent.maxTokens ?? 2048) &&
    values.temperature === (agent.temperature ?? 0.7) &&
    values.topP === (agent.topP ?? 0.95) &&
    values.reasoning === (agent.reasoning ?? false) &&
    values.webSearch === (agent.webSearch ?? false)
  );
}

export function agentFormIsDirty(values: AgentFormValues, agent: AgentDTO): boolean {
  return (
    values.name.trim() !== agent.name ||
    (values.description.trim() || null) !== (agent.description ?? null) ||
    values.instructions !== agent.instructions ||
    values.providerId !== agent.providerId ||
    values.modelId !== agent.modelId ||
    !agentParamsMatch(values, agent)
  );
}

export function defaultAgentFormIsDirty(
  values: Omit<AgentFormValues, 'name' | 'description' | 'instructions'>,
  agent: AgentDTO
): boolean {
  return (
    values.providerId !== agent.providerId ||
    values.modelId !== agent.modelId ||
    !agentParamsMatch(
      {
        name: agent.name,
        description: agent.description ?? '',
        instructions: agent.instructions,
        ...values,
      },
      agent
    )
  );
}

export function agentFormToPatch(values: AgentFormValues) {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    instructions: values.instructions,
    providerId: values.providerId,
    modelId: values.modelId,
    maxTokens: values.maxTokens,
    temperature: values.temperature,
    topP: values.topP,
    reasoning: values.reasoning,
    webSearch: values.webSearch,
  };
}

export function defaultAgentFormToPatch(
  values: Omit<AgentFormValues, 'name' | 'description' | 'instructions'>
) {
  return {
    providerId: values.providerId,
    modelId: values.modelId,
    maxTokens: values.maxTokens,
    temperature: values.temperature,
    topP: values.topP,
    reasoning: values.reasoning,
    webSearch: values.webSearch,
  };
}
