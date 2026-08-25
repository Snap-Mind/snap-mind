import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../db/__tests__/testDb.js';
import { AgentsService } from '../AgentsService.js';

function newService() {
  const { db } = makeTestDb();
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

  it('defaults instructions to an empty string and stores no config when no params are given', async () => {
    const svc = newService();
    const created = await svc.create({ name: 'Bare' });
    expect(created.instructions).toBe('');
    expect(created.temperature).toBeUndefined();
    expect(created.reasoning).toBeUndefined();
  });
});
