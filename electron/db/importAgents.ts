import fs from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import * as schema from './schema.js';
import { agents, hotkeys, providers, providerModels } from './schema.js';

type AppDb = BetterSQLite3Database<typeof schema>;

export interface AgentImportOptions {
  hotkeysPath: string;
  settingsPath: string;
  db: AppDb;
}

interface LegacyHotkey {
  key?: string;
  prompt?: string;
  enabled?: boolean;
}

interface Binding {
  providerId: number | null;
  modelId: number | null;
}

function readJson(filePath: string): Record<string, unknown> | unknown[] | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, filePath);
}

/** Map the legacy `settings.chat` sliders and toggles onto the agent `config_json` keys. */
function packLegacyChatConfig(chat: Record<string, unknown>): string | null {
  const cfg: Record<string, unknown> = {};
  if (typeof chat.temperature === 'number') cfg.temperature = chat.temperature;
  if (typeof chat.max_tokens === 'number') cfg.maxTokens = chat.max_tokens;
  if (typeof chat.top_p === 'number') cfg.topP = chat.top_p;
  if (typeof chat.reasoningEnabled === 'boolean') cfg.reasoning = chat.reasoningEnabled;
  if (typeof chat.webSearchEnabled === 'boolean') cfg.webSearch = chat.webSearchEnabled;
  return Object.keys(cfg).length === 0 ? null : JSON.stringify(cfg);
}

/** Only bind when both rows still exist and the model really belongs to the provider. */
function resolveLegacyBinding(db: AppDb, chat: Record<string, unknown> | undefined): Binding {
  const providerId = typeof chat?.defaultProviderId === 'number' ? chat.defaultProviderId : null;
  const modelId = typeof chat?.defaultModelId === 'number' ? chat.defaultModelId : null;
  if (providerId == null || modelId == null) return { providerId: null, modelId: null };

  const provider = db.select().from(providers).where(eq(providers.id, providerId)).get();
  const model = db.select().from(providerModels).where(eq(providerModels.id, modelId)).get();
  if (!provider || !model || model.providerId !== provider.id) {
    return { providerId: null, modelId: null };
  }
  return { providerId, modelId };
}

export async function runAgentImportIfNeeded(
  opts: AgentImportOptions
): Promise<'imported' | 'skipped'> {
  const { hotkeysPath, settingsPath, db } = opts;

  const hasLegacyHotkeys = fs.existsSync(hotkeysPath);
  const rawSettings = (readJson(settingsPath) ?? {}) as Record<string, unknown>;
  const legacyChat = rawSettings.chat as Record<string, unknown> | undefined;
  const hasLegacyChat = legacyChat !== undefined;

  if (!hasLegacyHotkeys && !hasLegacyChat) return 'skipped';

  const binding = resolveLegacyBinding(db, legacyChat);
  const now = Date.now();

  db.transaction((tx) => {
    const builtin = tx.select().from(agents).where(eq(agents.isBuiltin, 1)).get();
    if (builtin) {
      tx.update(agents)
        .set({
          providerId: binding.providerId,
          modelId: binding.modelId,
          configJson: legacyChat ? packLegacyChatConfig(legacyChat) : builtin.configJson,
          updatedAt: now,
        })
        .where(eq(agents.id, builtin.id))
        .run();
    }

    if (!hasLegacyHotkeys) return;

    const legacy = (readJson(hotkeysPath) ?? []) as LegacyHotkey[];
    if (!Array.isArray(legacy) || legacy.length === 0) return;

    tx.delete(hotkeys).run();

    let agentCounter = 0;
    let chatRowAssigned = false;

    legacy.forEach((entry, index) => {
      const prompt = typeof entry.prompt === 'string' ? entry.prompt.trim() : '';
      let mode: 'chat' | 'selection' = 'selection';
      let agentId: number | null = null;
      let enabled = entry.enabled === true ? 1 : 0;

      if (prompt.length > 0) {
        agentCounter += 1;
        const maxRow = tx
          .select({ max: sql<number>`COALESCE(MAX(${agents.sortOrder}), 0)` })
          .from(agents)
          .get();
        const [row] = tx
          .insert(agents)
          .values({
            name: `Agent ${agentCounter}`,
            description: null,
            instructions: prompt,
            providerId: binding.providerId,
            modelId: binding.modelId,
            configJson: null,
            isBuiltin: 0,
            sortOrder: (maxRow?.max ?? 0) + 10,
            createdAt: now,
            updatedAt: now,
          })
          .returning()
          .all();
        agentId = row.id;
      } else if (!chatRowAssigned) {
        chatRowAssigned = true;
        mode = 'chat';
        agentId = builtin?.id ?? null;
      } else {
        // A second prompt-less entry cannot run anything, so ship it unassigned and off.
        enabled = 0;
      }

      tx.insert(hotkeys)
        .values({
          accelerator: String(entry.key ?? ''),
          mode,
          agentId,
          enabled,
          sortOrder: 10 * (index + 1),
          createdAt: now,
          updatedAt: now,
        })
        .run();
    });
  });

  if (hasLegacyHotkeys) {
    fs.copyFileSync(hotkeysPath, hotkeysPath + '.pre-agents.bak');
    fs.rmSync(hotkeysPath);
  }

  if (hasLegacyChat) {
    const next = { ...rawSettings };
    delete next.chat;
    writeJsonAtomic(settingsPath, next);
  }

  return 'imported';
}
