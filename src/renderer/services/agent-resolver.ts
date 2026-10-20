import type { AgentDTO } from '@/types/agent-dto';
import type { ModelDTO, ProviderDTO } from '@/types/provider-dto';

/** Provider kinds that work without a credential. */
const KEYLESS_PROVIDER_KINDS = new Set(['ollama']);

export type AgentResolution =
  | { ok: true; agent: AgentDTO; provider: ProviderDTO; model: ModelDTO }
  | { ok: false; reason: 'no-agent' }
  | { ok: false; reason: 'unbound'; agentName: string }
  | { ok: false; reason: 'missing-model'; agentName: string }
  | { ok: false; reason: 'no-api-key'; agentName: string; providerName: string };

export function resolveAgent(
  agentId: number | null | undefined,
  agents: AgentDTO[],
  providers: ProviderDTO[]
): AgentResolution {
  if (agentId == null) return { ok: false, reason: 'no-agent' };
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return { ok: false, reason: 'no-agent' };

  if (agent.providerId == null || agent.modelId == null) {
    return { ok: false, reason: 'unbound', agentName: agent.name };
  }

  const provider = providers.find((p) => p.id === agent.providerId);
  const model = provider?.models.find((m) => m.id === agent.modelId);
  if (!provider || !model) {
    return { ok: false, reason: 'missing-model', agentName: agent.name };
  }

  if (!KEYLESS_PROVIDER_KINDS.has(provider.kind) && !provider.apiKey) {
    return {
      ok: false,
      reason: 'no-api-key',
      agentName: agent.name,
      providerName: provider.name,
    };
  }

  return { ok: true, agent, provider, model };
}

export function agentErrorMessage(res: Extract<AgentResolution, { ok: false }>): string {
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

export function findBuiltinAgentId(agents: AgentDTO[]): number | null {
  return agents.find((a) => a.isBuiltin)?.id ?? null;
}
