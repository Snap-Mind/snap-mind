import { and, asc, eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './db/schema.js';
import { providers, providerModels } from './db/schema.js';
import type { ModelCapability, ProviderModelRow, ProviderRow } from './db/schema.js';
import { SafeStorageService } from './SafeStorageService.js';

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

function unpackConfig(
  configJson: string | null
): Pick<ProviderDTO, 'apiVersion' | 'projectName' | 'entraScope' | 'config'> {
  if (!configJson) return {};
  try {
    const raw = JSON.parse(configJson) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    if (raw.apiVersion !== undefined) out.apiVersion = raw.apiVersion;
    if (raw.projectName !== undefined) out.projectName = raw.projectName;
    if (raw.entraScope !== undefined) out.entraScope = raw.entraScope;
    if (raw.config !== undefined) out.config = raw.config;
    return out as Pick<ProviderDTO, 'apiVersion' | 'projectName' | 'entraScope' | 'config'>;
  } catch {
    return {};
  }
}

function packConfig(input: Partial<CreateProviderInput>): string | null {
  const cfg: Record<string, unknown> = {};
  if (input.apiVersion !== undefined) cfg.apiVersion = input.apiVersion;
  if (input.projectName !== undefined) cfg.projectName = input.projectName;
  if (input.entraScope !== undefined) cfg.entraScope = input.entraScope;
  if (input.config !== undefined) cfg.config = input.config;
  return Object.keys(cfg).length === 0 ? null : JSON.stringify(cfg);
}

function rowToModelDTO(row: ProviderModelRow): ModelDTO {
  let capabilities: ModelCapability[] = [];
  if (row.capabilitiesJson) {
    try {
      capabilities = JSON.parse(row.capabilitiesJson) as ModelCapability[];
    } catch {
      capabilities = [];
    }
  }
  return {
    id: row.id,
    modelId: row.modelId,
    name: row.name,
    type: row.type,
    capabilities,
    description: row.description,
  };
}

export class ProvidersService {
  private db: BetterSQLite3Database<typeof schema>;

  constructor(db: BetterSQLite3Database<typeof schema>) {
    this.db = db;
  }

  async list(): Promise<ProviderDTO[]> {
    const providerRows = this.db
      .select()
      .from(providers)
      .orderBy(asc(providers.sortOrder), asc(providers.id))
      .all();
    const modelRows = this.db
      .select()
      .from(providerModels)
      .orderBy(asc(providerModels.sortOrder), asc(providerModels.id))
      .all();
    const modelsByProvider = new Map<number, ModelDTO[]>();
    for (const m of modelRows) {
      const arr = modelsByProvider.get(m.providerId) ?? [];
      arr.push(rowToModelDTO(m));
      modelsByProvider.set(m.providerId, arr);
    }
    return providerRows.map((r: ProviderRow) => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      host: r.host,
      apiKey: r.apiKey ? SafeStorageService.decrypt(r.apiKey) : r.apiKey,
      description: r.description,
      ...unpackConfig(r.configJson),
      models: modelsByProvider.get(r.id) ?? [],
    }));
  }

  async create(input: CreateProviderInput): Promise<ProviderDTO> {
    const now = Date.now();
    const maxRow = this.db
      .select({ max: sql<number>`COALESCE(MAX(${providers.sortOrder}), 0)` })
      .from(providers)
      .get();
    const nextSort = (maxRow?.max ?? 0) + 10;
    const [row] = this.db
      .insert(providers)
      .values({
        kind: input.kind,
        name: input.name,
        host: input.host ?? null,
        apiKey: input.apiKey ? SafeStorageService.encrypt(input.apiKey) : (input.apiKey ?? null),
        description: input.description ?? null,
        configJson: packConfig(input),
        sortOrder: nextSort,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .all();
    return (await this.list()).find((p) => p.id === row.id)!;
  }

  private mergedConfigJson(existing: string | null, patch: UpdateProviderPatch): string | null {
    let base: Record<string, unknown> = {};
    if (existing) {
      try {
        base = JSON.parse(existing) as Record<string, unknown>;
      } catch {
        base = {};
      }
    }
    if (patch.apiVersion !== undefined) base.apiVersion = patch.apiVersion;
    if (patch.projectName !== undefined) base.projectName = patch.projectName;
    if (patch.entraScope !== undefined) base.entraScope = patch.entraScope;
    if (patch.config !== undefined) base.config = patch.config;
    return Object.keys(base).length === 0 ? null : JSON.stringify(base);
  }

  async update(id: number, patch: UpdateProviderPatch): Promise<ProviderDTO> {
    const existing = this.db.select().from(providers).where(eq(providers.id, id)).get();
    if (!existing) throw new Error(`Provider ${id} not found`);

    const values: Partial<ProviderRow> = { updatedAt: Date.now() };
    if (patch.kind !== undefined) values.kind = patch.kind;
    if (patch.name !== undefined) values.name = patch.name;
    if (patch.host !== undefined) values.host = patch.host ?? null;
    if (patch.description !== undefined) values.description = patch.description ?? null;
    if (patch.apiKey !== undefined) {
      values.apiKey = patch.apiKey ? SafeStorageService.encrypt(patch.apiKey) : patch.apiKey;
    }
    const configTouched =
      patch.apiVersion !== undefined ||
      patch.projectName !== undefined ||
      patch.entraScope !== undefined ||
      patch.config !== undefined;
    if (configTouched) {
      values.configJson = this.mergedConfigJson(existing.configJson, patch);
    }

    this.db.update(providers).set(values).where(eq(providers.id, id)).run();
    return (await this.list()).find((p) => p.id === id)!;
  }

  async delete(id: number): Promise<void> {
    this.db.delete(providers).where(eq(providers.id, id)).run();
  }

  async upsertModel(providerId: number, model: UpsertModelInput): Promise<ModelDTO> {
    const now = Date.now();
    const existing = this.db
      .select()
      .from(providerModels)
      .where(and(eq(providerModels.providerId, providerId), eq(providerModels.modelId, model.modelId)))
      .get();

    const capabilitiesJson = JSON.stringify(model.capabilities ?? []);

    if (existing) {
      this.db
        .update(providerModels)
        .set({
          name: model.name,
          type: model.type ?? null,
          capabilitiesJson,
          description: model.description ?? null,
          updatedAt: now,
        })
        .where(eq(providerModels.id, existing.id))
        .run();
      return rowToModelDTO(
        this.db.select().from(providerModels).where(eq(providerModels.id, existing.id)).get()!
      );
    }

    const maxRow = this.db
      .select({ max: sql<number>`COALESCE(MAX(${providerModels.sortOrder}), 0)` })
      .from(providerModels)
      .where(eq(providerModels.providerId, providerId))
      .get();
    const nextSort = (maxRow?.max ?? 0) + 10;

    const [row] = this.db
      .insert(providerModels)
      .values({
        providerId,
        modelId: model.modelId,
        name: model.name,
        type: model.type ?? null,
        capabilitiesJson,
        description: model.description ?? null,
        sortOrder: nextSort,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .all();
    return rowToModelDTO(row);
  }

  async deleteModel(_providerId: number, modelId: number): Promise<void> {
    this.db.delete(providerModels).where(eq(providerModels.id, modelId)).run();
  }

  async resolveDefault(
    defaultProviderId: number | null,
    defaultModelId: number | null
  ): Promise<{ providerId: number; modelId: number } | null> {
    const list = await this.list();

    if (defaultProviderId != null && defaultModelId != null) {
      const p = list.find((x) => x.id === defaultProviderId);
      const m = p?.models.find((x) => x.id === defaultModelId);
      if (p && m) return { providerId: p.id, modelId: m.id };
    }

    const withModels = list.find((p) => p.models.length > 0);
    if (withModels) return { providerId: withModels.id, modelId: withModels.models[0].id };

    return null;
  }

  async __truncateForTest(): Promise<void> {
    this.db.delete(providerModels).run();
    this.db.delete(providers).run();
  }

  async importFromJson(providersFromSettings: unknown[]): Promise<{
    imported: number;
    skipped: string[];
    providerIdByKind: Record<string, number>;
    modelIdByOldKey: Record<string, number>;
  }> {
    const now = Date.now();
    const skipped: string[] = [];
    const providerIdByKind: Record<string, number> = {};
    const modelIdByOldKey: Record<string, number> = {};
    let imported = 0;

    this.db.transaction((tx) => {
      (providersFromSettings as any[]).forEach((p, index) => {
        if (!p || typeof p !== 'object') return;
        if (p.id === 'foundry') {
          skipped.push('foundry');
          return;
        }
        const [row] = tx
          .insert(providers)
          .values({
            kind: String(p.id),
            name: String(p.name ?? p.id),
            host: p.host ?? null,
            apiKey: p.apiKey ?? null,
            description: p.description ?? null,
            configJson: packConfig({
              apiVersion: p.apiVersion,
              projectName: p.projectName,
              entraScope: p.entraScope,
              config: p.config,
            }),
            sortOrder: 10 * (index + 1),
            createdAt: now,
            updatedAt: now,
          })
          .returning()
          .all();
        providerIdByKind[String(p.id)] = row.id;
        imported += 1;

        const models = Array.isArray(p.models) ? p.models : [];
        models.forEach((m: any, mIndex: number) => {
          const [mrow] = tx
            .insert(providerModels)
            .values({
              providerId: row.id,
              modelId: String(m.id),
              name: String(m.name ?? m.id),
              type: m.type ?? null,
              capabilitiesJson: JSON.stringify(m.capabilities ?? []),
              description: m.description ?? null,
              sortOrder: 10 * (mIndex + 1),
              createdAt: now,
              updatedAt: now,
            })
            .returning()
            .all();
          modelIdByOldKey[`${p.id}|${m.id}`] = mrow.id;
        });
      });
    });

    return { imported, skipped, providerIdByKind, modelIdByOldKey };
  }

  __rawProviderRow(id: number): ProviderRow {
    return this.db.select().from(providers).where(eq(providers.id, id)).get()!;
  }
}
