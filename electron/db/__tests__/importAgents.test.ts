import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from './testDb.js';
import * as schema from '../schema.js';
import { runAgentImportIfNeeded } from '../importAgents.js';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapmind-agents-'));
});

function paths() {
  return {
    hotkeysPath: path.join(dir, 'hotkeys.json'),
    settingsPath: path.join(dir, 'settings.json'),
  };
}

const LEGACY_HOTKEYS = [
  { id: 0, key: 'CommandOrControl+`', enabled: true },
  { id: 1, key: 'CommandOrControl+Shift+T', prompt: 'Translate to Chinese:', enabled: true },
  { id: 2, key: 'CommandOrControl+Shift+E', prompt: 'Explain this:', enabled: true },
  { id: 3, key: 'CommandOrControl+Shift+S', prompt: 'Summarize:', enabled: false },
];

function writeLegacy(chat: Record<string, unknown> | null) {
  const { hotkeysPath, settingsPath } = paths();
  fs.writeFileSync(hotkeysPath, JSON.stringify(LEGACY_HOTKEYS, null, 2));
  fs.writeFileSync(
    settingsPath,
    JSON.stringify({ general: { language: 'en' }, ...(chat ? { chat } : {}) }, null, 2)
  );
}

function seedProviderWithModel(db: ReturnType<typeof makeTestDb>['db']) {
  const provider = db.select().from(schema.providers).where(eq(schema.providers.kind, 'openai')).get()!;
  const [model] = db
    .insert(schema.providerModels)
    .values({
      providerId: provider.id,
      modelId: 'gpt-4o',
      name: 'GPT-4o',
      sortOrder: 10,
      createdAt: 0,
      updatedAt: 0,
    })
    .returning()
    .all();
  return { provider, model };
}

describe('runAgentImportIfNeeded', () => {
  it('imports one agent per prompt, named positionally, and wires the hotkey rows', async () => {
    const { db } = makeTestDb();
    writeLegacy(null);
    const { hotkeysPath, settingsPath } = paths();

    const result = await runAgentImportIfNeeded({ hotkeysPath, settingsPath, db });
    expect(result).toBe('imported');

    const agents = db.select().from(schema.agents).orderBy(schema.agents.sortOrder).all();
    expect(agents.map((a) => a.name)).toEqual(['Default', 'Agent 1', 'Agent 2', 'Agent 3']);
    expect(agents[1].instructions).toBe('Translate to Chinese:');
    expect(agents[3].instructions).toBe('Summarize:');
    expect(agents.slice(1).every((a) => a.isBuiltin === 0)).toBe(true);

    const rows = db.select().from(schema.hotkeys).orderBy(schema.hotkeys.sortOrder).all();
    expect(rows).toHaveLength(4);
    expect(rows[0].mode).toBe('chat');
    expect(rows[0].agentId).toBe(agents[0].id);
    expect(rows[1].mode).toBe('selection');
    expect(rows[1].agentId).toBe(agents[1].id);
    expect(rows[1].enabled).toBe(1);
    expect(rows[3].enabled).toBe(0);
  });

  it('backs up and removes hotkeys.json', async () => {
    const { db } = makeTestDb();
    writeLegacy(null);
    const { hotkeysPath, settingsPath } = paths();

    await runAgentImportIfNeeded({ hotkeysPath, settingsPath, db });

    expect(fs.existsSync(hotkeysPath)).toBe(false);
    expect(fs.existsSync(hotkeysPath + '.pre-agents.bak')).toBe(true);
  });

  it('folds settings.chat params into the Default agent and strips the section', async () => {
    const { db } = makeTestDb();
    writeLegacy({
      temperature: 0.3,
      max_tokens: 4096,
      top_p: 0.8,
      reasoningEnabled: true,
      webSearchEnabled: false,
      streamingEnabled: false,
    });
    const { hotkeysPath, settingsPath } = paths();

    await runAgentImportIfNeeded({ hotkeysPath, settingsPath, db });

    const builtin = db.select().from(schema.agents).where(eq(schema.agents.isBuiltin, 1)).get()!;
    expect(JSON.parse(builtin.configJson!)).toEqual({
      temperature: 0.3,
      maxTokens: 4096,
      topP: 0.8,
      reasoning: true,
      webSearch: false,
    });

    const rewritten = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    expect(rewritten.chat).toBeUndefined();
    expect(rewritten.general.language).toBe('en');
  });

  it('binds Default and the imported agents to the legacy default model when it resolves', async () => {
    const { db } = makeTestDb();
    const { provider, model } = seedProviderWithModel(db);
    writeLegacy({ defaultProviderId: provider.id, defaultModelId: model.id });
    const { hotkeysPath, settingsPath } = paths();

    await runAgentImportIfNeeded({ hotkeysPath, settingsPath, db });

    const all = db.select().from(schema.agents).all();
    expect(all.every((a) => a.providerId === provider.id)).toBe(true);
    expect(all.every((a) => a.modelId === model.id)).toBe(true);
  });

  it('leaves agents unbound when the legacy default no longer resolves', async () => {
    const { db } = makeTestDb();
    writeLegacy({ defaultProviderId: 42, defaultModelId: 99 });
    const { hotkeysPath, settingsPath } = paths();

    await runAgentImportIfNeeded({ hotkeysPath, settingsPath, db });

    const all = db.select().from(schema.agents).all();
    expect(all.every((a) => a.providerId === null)).toBe(true);
  });

  it('is idempotent: a second run skips and changes nothing', async () => {
    const { db } = makeTestDb();
    writeLegacy(null);
    const { hotkeysPath, settingsPath } = paths();

    await runAgentImportIfNeeded({ hotkeysPath, settingsPath, db });
    const before = db.select().from(schema.agents).all();

    const second = await runAgentImportIfNeeded({ hotkeysPath, settingsPath, db });
    expect(second).toBe('skipped');
    expect(db.select().from(schema.agents).all()).toEqual(before);
  });

  it('treats a second prompt-less entry as a disabled unassigned selection hotkey', async () => {
    const { db } = makeTestDb();
    const { hotkeysPath, settingsPath } = paths();
    fs.writeFileSync(
      hotkeysPath,
      JSON.stringify([
        { id: 0, key: 'CommandOrControl+`', enabled: true },
        { id: 1, key: 'CommandOrControl+Shift+T', prompt: '', enabled: true },
      ])
    );
    fs.writeFileSync(settingsPath, JSON.stringify({ general: {} }));

    await runAgentImportIfNeeded({ hotkeysPath, settingsPath, db });

    const rows = db.select().from(schema.hotkeys).orderBy(schema.hotkeys.sortOrder).all();
    expect(rows).toHaveLength(2);
    expect(rows[0].mode).toBe('chat');
    expect(rows[1].mode).toBe('selection');
    expect(rows[1].agentId).toBeNull();
    expect(rows[1].enabled).toBe(0);
  });
});
