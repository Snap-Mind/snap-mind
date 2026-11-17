import { asc, eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema.js';
import { agents } from '../db/schema.js';
import type { AgentRow } from '../db/schema.js';

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

const PARAM_KEYS = ['temperature', 'maxTokens', 'topP', 'reasoning', 'webSearch'] as const;
type AgentParams = Pick<AgentDTO, (typeof PARAM_KEYS)[number]>;

export const DEFAULT_AGENT_PARAMS: Required<AgentParams> = {
  temperature: 0.7,
  maxTokens: 2048,
  topP: 0.95,
  reasoning: false,
  webSearch: false,
};

export function defaultAgentConfigJson(): string {
  return JSON.stringify(DEFAULT_AGENT_PARAMS);
}

function unpackConfig(configJson: string | null): AgentParams {
  if (!configJson) return {};
  try {
    const raw = JSON.parse(configJson) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of PARAM_KEYS) {
      if (raw[key] !== undefined) out[key] = raw[key];
    }
    return out as AgentParams;
  } catch {
    return {};
  }
}

function packConfig(input: UpdateAgentPatch, existing: string | null): string | null {
  let base: Record<string, unknown> = {};
  if (existing) {
    try {
      base = JSON.parse(existing) as Record<string, unknown>;
    } catch {
      base = {};
    }
  }
  for (const key of PARAM_KEYS) {
    if (input[key] !== undefined) base[key] = input[key];
  }
  return Object.keys(base).length === 0 ? null : JSON.stringify(base);
}

function rowToDTO(row: AgentRow): AgentDTO {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    instructions: row.instructions,
    providerId: row.providerId,
    modelId: row.modelId,
    isBuiltin: row.isBuiltin === 1,
    ...unpackConfig(row.configJson),
  };
}

export class AgentsService {
  private db: BetterSQLite3Database<typeof schema>;

  constructor(db: BetterSQLite3Database<typeof schema>) {
    this.db = db;
  }

  async list(): Promise<AgentDTO[]> {
    return this.db
      .select()
      .from(agents)
      .orderBy(asc(agents.sortOrder), asc(agents.id))
      .all()
      .map(rowToDTO);
  }

  async create(input: CreateAgentInput): Promise<AgentDTO> {
    const now = Date.now();
    const maxRow = this.db
      .select({ max: sql<number>`COALESCE(MAX(${agents.sortOrder}), 0)` })
      .from(agents)
      .get();
    const [row] = this.db
      .insert(agents)
      .values({
        name: input.name,
        description: input.description ?? null,
        instructions: input.instructions ?? '',
        providerId: input.providerId ?? null,
        modelId: input.modelId ?? null,
        configJson: packConfig(input, defaultAgentConfigJson()),
        isBuiltin: 0,
        sortOrder: (maxRow?.max ?? 0) + 10,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .all();
    return rowToDTO(row);
  }

  async update(id: number, patch: UpdateAgentPatch): Promise<AgentDTO> {
    const existing = this.db.select().from(agents).where(eq(agents.id, id)).get();
    if (!existing) throw new Error(`Agent ${id} not found`);
    if (existing.isBuiltin === 1 && patch.name !== undefined && patch.name !== existing.name) {
      throw new Error('Cannot rename a built-in agent');
    }

    const values: Partial<AgentRow> = { updatedAt: Date.now() };
    if (patch.name !== undefined) values.name = patch.name;
    if (patch.description !== undefined) values.description = patch.description ?? null;
    if (patch.instructions !== undefined) values.instructions = patch.instructions;
    if (patch.providerId !== undefined) values.providerId = patch.providerId ?? null;
    if (patch.modelId !== undefined) values.modelId = patch.modelId ?? null;
    if (PARAM_KEYS.some((key) => patch[key] !== undefined)) {
      values.configJson = packConfig(patch, existing.configJson);
    }

    this.db.update(agents).set(values).where(eq(agents.id, id)).run();
    return rowToDTO(this.db.select().from(agents).where(eq(agents.id, id)).get()!);
  }

  async delete(id: number): Promise<void> {
    const existing = this.db.select().from(agents).where(eq(agents.id, id)).get();
    if (!existing) return;
    if (existing.isBuiltin === 1) throw new Error('Cannot delete a built-in agent');
    this.db.delete(agents).where(eq(agents.id, id)).run();
  }

  __rawAgentRow(id: number): AgentRow {
    return this.db.select().from(agents).where(eq(agents.id, id)).get()!;
  }
}
