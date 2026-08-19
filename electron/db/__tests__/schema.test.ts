import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from './testDb.js';
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

    expect(db.select().from(providerModels).where(eq(providerModels.modelId, 'gpt-4')).all()).toHaveLength(1);

    db.delete(providers).where(eq(providers.id, p.id)).run();
    expect(db.select().from(providerModels).where(eq(providerModels.modelId, 'gpt-4')).all()).toHaveLength(0);
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
