export type ModelCapability = 'chat' | 'reasoning' | 'vision' | 'tools' | 'image';

export interface ModelDTO {
  id: number;
  modelId: string;
  name: string;
  type: string | null;
  capabilities: ModelCapability[];
  description: string | null;
}

export interface ProviderDTO {
  id: number;
  kind: string;
  name: string;
  host: string | null;
  apiKey: string | null;
  description: string | null;
  apiVersion?: string;
  projectName?: string;
  entraScope?: string;
  config?: Record<string, unknown>;
  models: ModelDTO[];
}

export interface CreateProviderInput {
  kind: string;
  name: string;
  host?: string | null;
  apiKey?: string | null;
  description?: string | null;
  apiVersion?: string;
  projectName?: string;
  entraScope?: string;
  config?: Record<string, unknown>;
}

export type UpdateProviderPatch = Partial<CreateProviderInput>;

export interface UpsertModelInput {
  modelId: string;
  name: string;
  type?: string | null;
  capabilities?: ModelCapability[];
  description?: string | null;
}
