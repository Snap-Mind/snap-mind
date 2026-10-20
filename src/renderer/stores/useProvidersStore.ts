import { create } from 'zustand';
import type {
  ProviderDTO,
  CreateProviderInput,
  UpdateProviderPatch,
  UpsertModelInput,
} from '@/types/provider-dto';

export interface ProvidersStoreState {
  providers: ProviderDTO[];
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  createProvider: (input: CreateProviderInput) => Promise<ProviderDTO>;
  updateProvider: (id: number, patch: UpdateProviderPatch) => Promise<ProviderDTO>;
  deleteProvider: (id: number) => Promise<void>;
  upsertModel: (providerId: number, model: UpsertModelInput) => Promise<void>;
  deleteModel: (providerId: number, modelId: number) => Promise<void>;
}

export const useProvidersStore = create<ProvidersStoreState>((set) => ({
  providers: [],
  isHydrated: false,

  hydrate: async () => {
    const list = await window.electronAPI.providers.list();
    set({ providers: list, isHydrated: true });
    window.electronAPI.providers.onChanged((next) => set({ providers: next }));
  },

  createProvider: async (input) => {
    return window.electronAPI.providers.create(input);
  },

  updateProvider: async (id, patch) => {
    return window.electronAPI.providers.update(id, patch);
  },

  deleteProvider: async (id) => {
    await window.electronAPI.providers.delete(id);
  },

  upsertModel: async (providerId, model) => {
    await window.electronAPI.models.upsert(providerId, model);
  },

  deleteModel: async (providerId, modelId) => {
    await window.electronAPI.models.delete(providerId, modelId);
  },
}));
