import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../../db/__tests__/testDb.js';
import { HotkeysService } from '../HotkeysService.js';

function newService() {
  const { db } = makeTestDb();
  return new HotkeysService(db);
}

describe('HotkeysService.list', () => {
  it('returns the four seeded rows in sort order with booleans mapped', async () => {
    const svc = newService();
    const list = await svc.list();
    expect(list).toHaveLength(4);
    expect(list[0].mode).toBe('chat');
    expect(list[0].enabled).toBe(true);
    expect(list[0].agentId).not.toBeNull();
    expect(list[1].mode).toBe('selection');
    expect(list[1].enabled).toBe(false);
    expect(list[1].agentId).toBeNull();
  });
});

describe('HotkeysService.update', () => {
  it('patches accelerator, agentId, and enabled', async () => {
    const svc = newService();
    const target = (await svc.list())[1];

    const updated = await svc.update(target.id, {
      accelerator: 'CommandOrControl+Shift+Y',
      agentId: 1,
      enabled: true,
    });
    expect(updated.accelerator).toBe('CommandOrControl+Shift+Y');
    expect(updated.agentId).toBe(1);
    expect(updated.enabled).toBe(true);
    expect(updated.mode).toBe('selection');
  });

  it('clears the binding when agentId is null', async () => {
    const svc = newService();
    const chatRow = (await svc.list())[0];
    const updated = await svc.update(chatRow.id, { agentId: null });
    expect(updated.agentId).toBeNull();
  });

  it('throws for an unknown id', async () => {
    const svc = newService();
    await expect(svc.update(9999, { enabled: true })).rejects.toThrow(/not found/i);
  });
});
