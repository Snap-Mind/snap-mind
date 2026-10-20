import { create } from 'zustand';
import type { AgentDTO, CreateAgentInput, UpdateAgentPatch } from '@/types/agent-dto';

export interface AgentsStoreState {
  agents: AgentDTO[];
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  createAgent: (input: CreateAgentInput) => Promise<AgentDTO>;
  updateAgent: (id: number, patch: UpdateAgentPatch) => Promise<AgentDTO>;
  deleteAgent: (id: number) => Promise<void>;
}

export const useAgentsStore = create<AgentsStoreState>((set) => ({
  agents: [],
  isHydrated: false,

  hydrate: async () => {
    const list = await window.electronAPI.agents.list();
    set({ agents: list, isHydrated: true });
    window.electronAPI.agents.onChanged((next) => set({ agents: next }));
  },

  createAgent: async (input) => window.electronAPI.agents.create(input),
  updateAgent: async (id, patch) => window.electronAPI.agents.update(id, patch),
  deleteAgent: async (id) => {
    await window.electronAPI.agents.delete(id);
  },
}));
