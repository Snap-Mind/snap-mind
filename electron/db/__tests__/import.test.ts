import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeTestDb } from './testDb.js';
import { ProvidersService } from '../../ProvidersService.js';
import { runImportIfNeeded } from '../import.js';

let tmpDir: string;
let settingsPath: string;

const legacySettings = {
  general: { language: 'en' },
  chat: { defaultProvider: 'openai', defaultModel: 'gpt-4', temperature: 0.7 },
  providers: [
    {
      id: 'openai',
      name: 'OpenAI',
      apiKey: Buffer.from('enc:sk-x', 'utf8').toString('base64'),
      host: 'https://api.openai.com/v1',
      models: [{ id: 'gpt-4', name: 'GPT-4', type: 'chat', capabilities: ['chat'] }],
    },
    {
      id: 'foundry',
      name: 'Foundry',
      apiKey: '',
      host: 'https://f',
      projectName: 'p',
      entraScope: 's',
      models: [],
    },
  ],
};

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapmind-import-'));
  settingsPath = path.join(tmpDir, 'settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify(legacySettings, null, 2));
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('runImportIfNeeded', () => {
  it('imports providers, backs up, and rewrites settings.json', async () => {
    const { db } = makeTestDb();
    const svc = new ProvidersService(db);
    await svc.__truncateForTest();

    const result = await runImportIfNeeded({ settingsPath, service: svc, hasProviders: false });
    expect(result).toBe('imported');

    const bak = fs.readFileSync(settingsPath + '.pre-sqlite.bak', 'utf8');
    expect(JSON.parse(bak)).toEqual(legacySettings);

    const rewritten = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    expect(rewritten.providers).toBeUndefined();
    expect(rewritten.chat.defaultProvider).toBeUndefined();
    expect(rewritten.chat.defaultModel).toBeUndefined();
    expect(typeof rewritten.chat.defaultProviderId).toBe('number');
    expect(typeof rewritten.chat.defaultModelId).toBe('number');
    expect(rewritten.builtinsSeeded).toBe(true);

    const list = await svc.list();
    expect(list.map((p) => p.kind)).toEqual(['openai']);
    expect(rewritten.chat.defaultProviderId).toBe(list[0].id);
    expect(rewritten.chat.defaultModelId).toBe(list[0].models[0].id);
  });

  it('returns "skipped" when providers already exist in the db', async () => {
    const { db } = makeTestDb();
    const svc = new ProvidersService(db);
    const result = await runImportIfNeeded({ settingsPath, service: svc, hasProviders: true });
    expect(result).toBe('skipped');
    expect(fs.existsSync(settingsPath + '.pre-sqlite.bak')).toBe(false);
  });
});
