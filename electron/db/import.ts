import fs from 'node:fs';
import { and, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import * as schema from './schema.js';
import { providers, providerModels } from './schema.js';

type AppDb = BetterSQLite3Database<typeof schema>;

export interface ImportOptions {
  settingsPath: string;
  db: AppDb;
}

interface LegacyImportMaps {
  providerIdByKind: Record<string, number>;
  modelIdByOldKey: Record<string, number>;
}

function pickLegacyConfigFields(p: Record<string, unknown>): string | null {
  const cfg: Record<string, unknown> = {};
  if (p.apiVersion !== undefined) cfg.apiVersion = p.apiVersion;
  if (p.projectName !== undefined) cfg.projectName = p.projectName;
  if (p.entraScope !== undefined) cfg.entraScope = p.entraScope;
  if (p.config !== undefined) cfg.config = p.config;
  return Object.keys(cfg).length === 0 ? null : JSON.stringify(cfg);
}

/** One-shot v0.6 migration: merge legacy settings.json providers into SQLite. */
function importLegacyProviders(
  db: AppDb,
  providersFromSettings: unknown[]
): LegacyImportMaps & { imported: number; skipped: string[] } {
  const now = Date.now();
  const skipped: string[] = [];
  const providerIdByKind: Record<string, number> = {};
  const modelIdByOldKey: Record<string, number> = {};
  let imported = 0;

  db.transaction((tx) => {
    (providersFromSettings as any[]).forEach((p, index) => {
      if (!p || typeof p !== 'object') return;
      if (p.id === 'foundry') {
        skipped.push('foundry');
        return;
      }

      const kind = String(p.id);
      const configJson = pickLegacyConfigFields(p);
      const existing = tx.select().from(providers).where(eq(providers.kind, kind)).get();

      let providerId: number;
      if (existing) {
        tx.update(providers)
          .set({
            name: String(p.name ?? p.id),
            host: p.host ?? null,
            apiKey: p.apiKey ?? null,
            description: p.description ?? null,
            configJson,
            updatedAt: now,
          })
          .where(eq(providers.id, existing.id))
          .run();
        providerId = existing.id;
      } else {
        const [row] = tx
          .insert(providers)
          .values({
            kind,
            name: String(p.name ?? p.id),
            host: p.host ?? null,
            apiKey: p.apiKey ?? null,
            description: p.description ?? null,
            configJson,
            sortOrder: 10 * (index + 1),
            createdAt: now,
            updatedAt: now,
          })
          .returning()
          .all();
        providerId = row.id;
        imported += 1;
      }
      providerIdByKind[kind] = providerId;

      const models = Array.isArray(p.models) ? p.models : [];
      models.forEach((m: any, mIndex: number) => {
        const modelId = String(m.id);
        const modelValues = {
          name: String(m.name ?? m.id),
          type: m.type ?? null,
          capabilitiesJson: JSON.stringify(m.capabilities ?? []),
          description: m.description ?? null,
          sortOrder: 10 * (mIndex + 1),
          updatedAt: now,
        };
        const existingModel = tx
          .select()
          .from(providerModels)
          .where(and(eq(providerModels.providerId, providerId), eq(providerModels.modelId, modelId)))
          .get();

        if (existingModel) {
          tx.update(providerModels)
            .set(modelValues)
            .where(eq(providerModels.id, existingModel.id))
            .run();
          modelIdByOldKey[`${kind}|${modelId}`] = existingModel.id;
        } else {
          const [mrow] = tx
            .insert(providerModels)
            .values({
              providerId,
              modelId,
              ...modelValues,
              createdAt: now,
            })
            .returning()
            .all();
          modelIdByOldKey[`${kind}|${modelId}`] = mrow.id;
        }
      });
    });
  });

  return { imported, skipped, providerIdByKind, modelIdByOldKey };
}

function rewriteSettingsAfterImport(
  settingsPath: string,
  raw: Record<string, unknown>,
  maps: LegacyImportMaps
): void {
  const oldProvider = (raw.chat as Record<string, unknown> | undefined)?.defaultProvider as
    | string
    | undefined;
  const oldModel = (raw.chat as Record<string, unknown> | undefined)?.defaultModel as
    | string
    | undefined;
  const defaultProviderId =
    oldProvider != null ? (maps.providerIdByKind[oldProvider] ?? null) : null;
  const defaultModelId =
    oldProvider != null && oldModel != null
      ? (maps.modelIdByOldKey[`${oldProvider}|${oldModel}`] ?? null)
      : null;

  const next = { ...raw };
  delete next.providers;
  next.chat = { ...(next.chat as Record<string, unknown> | undefined) };
  delete (next.chat as Record<string, unknown>).defaultProvider;
  delete (next.chat as Record<string, unknown>).defaultModel;
  (next.chat as Record<string, unknown>).defaultProviderId = defaultProviderId;
  (next.chat as Record<string, unknown>).defaultModelId = defaultModelId;
  next.builtinsSeeded = true;

  const tmp = settingsPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, settingsPath);
}

export async function runImportIfNeeded(
  opts: ImportOptions
): Promise<'seeded' | 'imported' | 'skipped'> {
  const { settingsPath, db } = opts;

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return 'seeded';
  }

  const legacyProviders = raw.providers;
  if (!Array.isArray(legacyProviders) || legacyProviders.length === 0) {
    return 'seeded';
  }

  fs.copyFileSync(settingsPath, settingsPath + '.pre-sqlite.bak');

  const maps = importLegacyProviders(db, legacyProviders);
  rewriteSettingsAfterImport(settingsPath, raw, maps);

  return 'imported';
}
