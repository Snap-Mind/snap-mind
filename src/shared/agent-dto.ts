export interface AgentDTO {
  id: number;
  name: string;
  description: string | null;
  instructions: string;
  providerId: number | null;
  modelId: number | null;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  reasoning?: boolean;
  webSearch?: boolean;
  isBuiltin: boolean;
}

export interface CreateAgentInput {
  name: string;
  description?: string | null;
  instructions?: string;
  providerId?: number | null;
  modelId?: number | null;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  reasoning?: boolean;
  webSearch?: boolean;
}

export type UpdateAgentPatch = Partial<CreateAgentInput>;
