import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../../db/__tests__/testDb.js';
import { AgentsService } from '../AgentsService.js';
import * as schema from '../../db/schema.js';
import { providerModels } from '../../db/schema.js';

function newServiceWithDb() {
  const { db } = makeTestDb();
  return { svc: new AgentsService(db), db };
}

function newService() {
  const { db } = makeTestDb();
  db.insert(providerModels)
    .values({
      id: 2,
      providerId: 1,
      modelId: 'test-model',
      name: 'Test Model',
      sortOrder: 10,
      createdAt: 0,
      updatedAt: 0,
    })
    .run();
  return new AgentsService(db);
}

describe('AgentsService.list', () => {
  it('returns the seeded Default agent with isBuiltin true and no params', async () => {
    const svc = newService();
    const list = await svc.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Default');
    expect(list[0].isBuiltin).toBe(true);
    expect(list[0].instructions).toBe('');
    expect(list[0].providerId).toBeNull();
    expect(list[0].temperature).toBeUndefined();
  });
});

describe('AgentsService.create', () => {
  it('creates an agent, unpacks its params, and appends it after the seed', async () => {
    const svc = newService();
    const created = await svc.create({
      name: 'Translate',
      instructions: 'Translate to Chinese:',
      temperature: 0.2,
      webSearch: true,
    });
    expect(created.id).toBeGreaterThan(0);
    expect(created.name).toBe('Translate');
    expect(created.instructions).toBe('Translate to Chinese:');
    expect(created.temperature).toBe(0.2);
    expect(created.webSearch).toBe(true);
    expect(created.isBuiltin).toBe(false);

    const list = await svc.list();
    expect(list.map((a) => a.name)).toEqual(['Default', 'Translate']);
  });

  it('defaults instructions to an empty string and stores default config when no params are given', async () => {
    const svc = newService();
    const created = await svc.create({ name: 'Bare' });
    expect(created.instructions).toBe('');
    expect(created.temperature).toBe(0.7);
    expect(created.maxTokens).toBe(2048);
    expect(created.topP).toBe(0.95);
    expect(created.reasoning).toBe(false);
    expect(created.webSearch).toBe(false);
    expect(svc.__rawAgentRow(created.id).configJson).toBe(
      JSON.stringify({
        temperature: 0.7,
        maxTokens: 2048,
        topP: 0.95,
        reasoning: false,
        webSearch: false,
      })
    );
  });
});

describe('AgentsService.update', () => {
  it('patches given fields and leaves the rest intact', async () => {
    const svc = newService();
    const agent = await svc.create({ name: 'Explain', instructions: 'Explain:' });

    const updated = await svc.update(agent.id, { providerId: 1, modelId: 2, temperature: 0.9 });
    expect(updated.providerId).toBe(1);
    expect(updated.modelId).toBe(2);
    expect(updated.temperature).toBe(0.9);
    expect(updated.instructions).toBe('Explain:');
    expect(updated.name).toBe('Explain');
  });

  it('merges config_json instead of replacing it', async () => {
    const svc = newService();
    const agent = await svc.create({ name: 'Merge', temperature: 0.2, maxTokens: 100 });

    const updated = await svc.update(agent.id, { webSearch: true });
    expect(updated.temperature).toBe(0.2);
    expect(updated.maxTokens).toBe(100);
    expect(updated.webSearch).toBe(true);
  });

  it('allows editing a built-in agent but refuses to rename it', async () => {
    const svc = newService();
    const builtin = (await svc.list())[0];

    const updated = await svc.update(builtin.id, { instructions: 'Be terse.', topP: 0.5 });
    expect(updated.instructions).toBe('Be terse.');
    expect(updated.topP).toBe(0.5);

    await expect(svc.update(builtin.id, { name: 'Renamed' })).rejects.toThrow(/built-in/i);
  });

  it('throws for an unknown id', async () => {
    const svc = newService();
    await expect(svc.update(9999, { name: 'Nope' })).rejects.toThrow(/not found/i);
  });
});

describe('AgentsService.delete', () => {
  it('deletes an ordinary agent and unassigns the hotkeys that referenced it', async () => {
    const { svc, db } = newServiceWithDb();
    const agent = await svc.create({ name: 'Doomed' });

    const selectionRow = db
      .select()
      .from(schema.hotkeys)
      .where(eq(schema.hotkeys.mode, 'selection'))
      .get()!;
    db.update(schema.hotkeys)
      .set({ agentId: agent.id })
      .where(eq(schema.hotkeys.id, selectionRow.id))
      .run();

    await svc.delete(agent.id);

    expect(await svc.list()).toHaveLength(1);
    const after = db
      .select()
      .from(schema.hotkeys)
      .where(eq(schema.hotkeys.id, selectionRow.id))
      .get()!;
    expect(after.agentId).toBeNull();
  });

  it('refuses to delete the built-in agent', async () => {
    const { svc } = newServiceWithDb();
    const builtin = (await svc.list())[0];
    await expect(svc.delete(builtin.id)).rejects.toThrow(/built-in/i);
    expect(await svc.list()).toHaveLength(1);
  });
});
