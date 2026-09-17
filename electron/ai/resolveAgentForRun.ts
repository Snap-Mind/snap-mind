import type { AgentDTO } from '../../src/types/agent-dto.js';
import type { ModelDTO, ProviderDTO } from '../../src/types/provider-dto.js';
import type { AiSendErrorCode } from './AIService.js';

const KEYLESS_PROVIDER_KINDS = new Set(['ollama']);

export type ResolveForRunResult =
  | { ok: true; agent: AgentDTO; provider: ProviderDTO; model: ModelDTO }
  | { ok: false; code: AiSendErrorCode; message: string };

export function agentErrorMessage(res: {
  reason: 'no-agent' | 'unbound' | 'missing-model' | 'no-api-key';
  agentName?: string;
  providerName?: string;
}): string {
  switch (res.reason) {
    case 'no-agent':
      return 'This shortcut has no agent. Assign one in Settings > Hotkeys.';
    case 'unbound':
      return `Agent "${res.agentName}" has no model. Choose one in Settings > Agents.`;
    case 'missing-model':
      return `Agent "${res.agentName}" points at a model that no longer exists. Choose a new one in Settings > Agents.`;
    case 'no-api-key':
      return `Agent "${res.agentName}" uses ${res.providerName}, which has no API key. Add one in Settings > Models.`;
  }
}

export function resolveAgentForRun(
  agentId: number,
  agents: AgentDTO[],
  providers: ProviderDTO[]
): ResolveForRunResult {
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) {
    return {
      ok: false,
      code: 'no-agent',
      message: agentErrorMessage({ reason: 'no-agent' }),
    };
  }

  if (agent.providerId == null || agent.modelId == null) {
    return {
      ok: false,
      code: 'unbound',
      message: agentErrorMessage({ reason: 'unbound', agentName: agent.name }),
    };
  }

  const provider = providers.find((p) => p.id === agent.providerId);
  const model = provider?.models.find((m) => m.id === agent.modelId);
  if (!provider || !model) {
    return {
      ok: false,
      code: 'missing-model',
      message: agentErrorMessage({ reason: 'missing-model', agentName: agent.name }),
    };
  }

  if (!KEYLESS_PROVIDER_KINDS.has(provider.kind) && !provider.apiKey) {
    return {
      ok: false,
      code: 'no-api-key',
      message: agentErrorMessage({
        reason: 'no-api-key',
        agentName: agent.name,
        providerName: provider.name,
      }),
    };
  }

  return { ok: true, agent, provider, model };
}
