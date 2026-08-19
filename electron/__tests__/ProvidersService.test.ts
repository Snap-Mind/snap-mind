import { describe, it, expect } from 'vitest';
import { makeTestDb } from '../db/__tests__/testDb.js';
import { ProvidersService } from '../ProvidersService.js';
import { SafeStorageService } from '../SafeStorageService.js';

function newService() {
  const { db } = makeTestDb();
  return new ProvidersService(db);
}

describe('ProvidersService.list', () => {
  it('returns the 7 seeded providers ordered by sortOrder with unpacked config', async () => {
    const svc = newService();
    const list = await svc.list();
    expect(list.map((p) => p.kind)).toEqual([
      'openai',
      'azure-openai',
      'anthropic',
      'google',
      'deepseek',
      'qwen',
      'ollama',
    ]);
    const azure = list.find((p) => p.kind === 'azure-openai')!;
    expect(azure.apiVersion).toBe('');
    const google = list.find((p) => p.kind === 'google')!;
    expect(google.config).toEqual({ topK: 40 });
    expect(list.every((p) => p.models.length === 0)).toBe(true);
  });
});

describe('ProvidersService.create', () => {
  it('creates a provider with encrypted apiKey and packed config', async () => {
    const svc = newService();
    const created = await svc.create({
      kind: 'openai',
      name: 'My Proxy',
      host: 'https://proxy.example.com/v1',
      apiKey: 'sk-secret',
      apiVersion: '2024-02-01',
    });
    expect(created.id).toBeGreaterThan(0);
    expect(created.apiKey).toBe('sk-secret');
    expect(created.apiVersion).toBe('2024-02-01');
    expect(SafeStorageService.decrypt(svc.__rawProviderRow(created.id).apiKey!)).toBe('sk-secret');
  });
});

describe('ProvidersService.update', () => {
  it('patches provided fields and re-encrypts apiKey; leaves others intact', async () => {
    const svc = newService();
    const openai = (await svc.list()).find((p) => p.kind === 'openai')!;

    const updated = await svc.update(openai.id, { apiKey: 'sk-new', name: 'OpenAI Renamed' });
    expect(updated.name).toBe('OpenAI Renamed');
    expect(updated.apiKey).toBe('sk-new');
    expect(updated.host).toBe('https://api.openai.com/v1');
    expect(SafeStorageService.decrypt(svc.__rawProviderRow(openai.id).apiKey!)).toBe('sk-new');
  });

  it('merges config fields without dropping existing ones', async () => {
    const svc = newService();
    const google = (await svc.list()).find((p) => p.kind === 'google')!;
    const updated = await svc.update(google.id, { apiVersion: 'v9' });
    expect(updated.config).toEqual({ topK: 40 });
    expect(updated.apiVersion).toBe('v9');
  });

  it('throws for an unknown id', async () => {
    const svc = newService();
    await expect(svc.update(9999, { name: 'x' })).rejects.toThrow();
  });
});

describe('ProvidersService.delete', () => {
  it('removes the provider and cascades its models', async () => {
    const svc = newService();
    const openai = (await svc.list()).find((p) => p.kind === 'openai')!;
    await svc.upsertModel(openai.id, { modelId: 'gpt-4', name: 'GPT-4' });
    await svc.delete(openai.id);
    expect((await svc.list()).find((p) => p.id === openai.id)).toBeUndefined();
  });
});

describe('ProvidersService models', () => {
  it('inserts then updates a model on conflict', async () => {
    const svc = newService();
    const openai = (await svc.list()).find((p) => p.kind === 'openai')!;

    const m1 = await svc.upsertModel(openai.id, {
      modelId: 'gpt-4',
      name: 'GPT-4',
      capabilities: ['chat'],
    });
    expect(m1.capabilities).toEqual(['chat']);

    const m2 = await svc.upsertModel(openai.id, {
      modelId: 'gpt-4',
      name: 'GPT-4 Turbo',
      capabilities: ['chat', 'vision'],
    });
    expect(m2.id).toBe(m1.id);
    expect(m2.name).toBe('GPT-4 Turbo');
    expect(m2.capabilities).toEqual(['chat', 'vision']);

    const provider = (await svc.list()).find((p) => p.id === openai.id)!;
    expect(provider.models).toHaveLength(1);
  });

  it('deletes a model by numeric id', async () => {
    const svc = newService();
    const openai = (await svc.list()).find((p) => p.kind === 'openai')!;
    const m = await svc.upsertModel(openai.id, { modelId: 'gpt-4', name: 'GPT-4' });
    await svc.deleteModel(openai.id, m.id);
    const provider = (await svc.list()).find((p) => p.id === openai.id)!;
    expect(provider.models).toHaveLength(0);
  });
});

describe('ProvidersService.resolveDefault', () => {
  it('returns the given pair when it still exists', async () => {
    const svc = newService();
    const openai = (await svc.list()).find((p) => p.kind === 'openai')!;
    const m = await svc.upsertModel(openai.id, { modelId: 'gpt-4', name: 'GPT-4' });
    const resolved = await svc.resolveDefault(openai.id, m.id);
    expect(resolved).toEqual({ providerId: openai.id, modelId: m.id });
  });

  it('falls back to the first provider that has models', async () => {
    const svc = newService();
    const anthropic = (await svc.list()).find((p) => p.kind === 'anthropic')!;
    const m = await svc.upsertModel(anthropic.id, { modelId: 'claude', name: 'Claude' });
    const resolved = await svc.resolveDefault(null, null);
    expect(resolved).toEqual({ providerId: anthropic.id, modelId: m.id });
  });

  it('returns null when no provider has models', async () => {
    const svc = newService();
    expect(await svc.resolveDefault(123, 456)).toBeNull();
  });
});
