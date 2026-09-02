import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from './testDb.js';
import * as schema from '../schema.js';
import { providers, providerModels } from '../schema.js';

describe('schema migrations', () => {
  it('seeds 7 built-in providers with no models', () => {
    const { db } = makeTestDb();
    const rows = db.select().from(providers).all();
    expect(rows).toHaveLength(7);
    expect(rows.map((r) => r.kind).sort()).toEqual([
      'anthropic',
      'azure-openai',
      'deepseek',
      'google',
      'ollama',
      'openai',
      'qwen',
    ]);
    expect(db.select().from(providerModels).all()).toHaveLength(0);
    expect(rows.every((r) => r.apiKey === '')).toBe(true);
  });

  it('creates tables and enforces the FK cascade', () => {
    const { db } = makeTestDb();
    const now = Date.now();

    const [p] = db
      .insert(providers)
      .values({ kind: 'custom', name: 'Custom', sortOrder: 80, createdAt: now, updatedAt: now })
      .returning()
      .all();

    db.insert(providerModels)
      .values({
        providerId: p.id,
        modelId: 'gpt-4',
        name: 'GPT-4',
        sortOrder: 10,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    expect(
      db.select().from(providerModels).where(eq(providerModels.modelId, 'gpt-4')).all()
    ).toHaveLength(1);

    db.delete(providers).where(eq(providers.id, p.id)).run();
    expect(
      db.select().from(providerModels).where(eq(providerModels.modelId, 'gpt-4')).all()
    ).toHaveLength(0);
  });

  it('enforces unique (provider_id, model_id)', () => {
    const { db } = makeTestDb();
    const now = Date.now();
    const [p] = db
      .insert(providers)
      .values({ kind: 'custom2', name: 'Custom2', sortOrder: 90, createdAt: now, updatedAt: now })
      .returning()
      .all();

    const insertModel = () =>
      db
        .insert(providerModels)
        .values({
          providerId: p.id,
          modelId: 'dup',
          name: 'Dup',
          sortOrder: 10,
          createdAt: now,
          updatedAt: now,
        })
        .run();

    insertModel();
    expect(() => insertModel()).toThrow();
  });
});

describe('agents table', () => {
  it('seeds exactly one built-in Default agent, unbound', () => {
    const { db } = makeTestDb();
    const rows = db.select().from(schema.agents).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Default');
    expect(rows[0].isBuiltin).toBe(1);
    expect(rows[0].instructions).toBe('');
    expect(rows[0].providerId).toBeNull();
    expect(rows[0].modelId).toBeNull();
  });

  it('nulls provider_id and model_id when the provider is deleted', () => {
    const { db } = makeTestDb();
    const openai = db
      .select()
      .from(schema.providers)
      .where(eq(schema.providers.kind, 'openai'))
      .get()!;
    const [model] = db
      .insert(schema.providerModels)
      .values({
        providerId: openai.id,
        modelId: 'gpt-4o',
        name: 'GPT-4o',
        sortOrder: 10,
        createdAt: 0,
        updatedAt: 0,
      })
      .returning()
      .all();

    db.update(schema.agents)
      .set({ providerId: openai.id, modelId: model.id })
      .where(eq(schema.agents.isBuiltin, 1))
      .run();

    db.delete(schema.providers).where(eq(schema.providers.id, openai.id)).run();

    const agent = db.select().from(schema.agents).get()!;
    expect(agent.providerId).toBeNull();
    expect(agent.modelId).toBeNull();
  });
});

describe('hotkeys table', () => {
  it('seeds four rows: one chat row bound to Default, three disabled selection rows', () => {
    const { db } = makeTestDb();
    const rows = db.select().from(schema.hotkeys).orderBy(schema.hotkeys.sortOrder).all();
    expect(rows.map((r) => r.accelerator)).toEqual([
      'CommandOrControl+`',
      'CommandOrControl+Shift+T',
      'CommandOrControl+Shift+E',
      'CommandOrControl+Shift+S',
    ]);
    expect(rows[0].mode).toBe('chat');
    expect(rows[0].enabled).toBe(1);
    expect(rows[0].agentId).not.toBeNull();
    expect(rows.slice(1).map((r) => r.mode)).toEqual(['selection', 'selection', 'selection']);
    expect(rows.slice(1).every((r) => r.agentId === null)).toBe(true);
    expect(rows.slice(1).every((r) => r.enabled === 0)).toBe(true);
  });

  it('nulls agent_id when the referenced agent is deleted', () => {
    const { db } = makeTestDb();
    const agent = db.select().from(schema.agents).get()!;
    db.delete(schema.agents).where(eq(schema.agents.id, agent.id)).run();
    const chatRow = db.select().from(schema.hotkeys).orderBy(schema.hotkeys.sortOrder).get()!;
    expect(chatRow.agentId).toBeNull();
  });
});
