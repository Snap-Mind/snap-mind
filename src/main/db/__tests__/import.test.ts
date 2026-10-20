import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { makeTestDb } from './testDb.js';
import { ProvidersService } from '../../services/ProvidersService.js';
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

    const result = await runImportIfNeeded({ settingsPath, db });
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
    expect(list).toHaveLength(7);
    const openai = list.find((p) => p.kind === 'openai')!;
    expect(openai.apiKey).toBe('sk-x');
    expect(openai.models).toHaveLength(1);
    expect(openai.models[0].modelId).toBe('gpt-4');
    expect(rewritten.chat.defaultProviderId).toBe(openai.id);
    expect(rewritten.chat.defaultModelId).toBe(openai.models[0].id);
  });

  it('merges legacy providers into seeded built-ins when the db is not empty', async () => {
    const { db } = makeTestDb();
    const svc = new ProvidersService(db);

    const result = await runImportIfNeeded({ settingsPath, db });
    expect(result).toBe('imported');
    expect(fs.existsSync(settingsPath + '.pre-sqlite.bak')).toBe(true);

    const openai = (await svc.list()).find((p) => p.kind === 'openai')!;
    expect(openai.models).toHaveLength(1);
  });

  it('returns "seeded" when settings.json has no legacy providers array', async () => {
    const { db } = makeTestDb();
    const emptySettingsPath = path.join(tmpDir, 'empty-settings.json');
    fs.writeFileSync(emptySettingsPath, JSON.stringify({ chat: {} }, null, 2));

    const result = await runImportIfNeeded({ settingsPath: emptySettingsPath, db });
    expect(result).toBe('seeded');
    expect(fs.existsSync(emptySettingsPath + '.pre-sqlite.bak')).toBe(false);
  });
});
