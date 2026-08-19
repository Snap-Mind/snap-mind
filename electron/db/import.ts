import fs from 'node:fs';
import type { ProvidersService } from '../ProvidersService.js';

export interface ImportOptions {
  settingsPath: string;
  service: ProvidersService;
  hasProviders: boolean;
}

export async function runImportIfNeeded(
  opts: ImportOptions
): Promise<'seeded' | 'imported' | 'skipped'> {
  const { settingsPath, service, hasProviders } = opts;
  if (hasProviders) return 'skipped';

  let raw: any;
  try {
    raw = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return 'seeded';
  }

  const legacyProviders = raw?.providers;
  if (!Array.isArray(legacyProviders) || legacyProviders.length === 0) {
    return 'seeded';
  }

  fs.copyFileSync(settingsPath, settingsPath + '.pre-sqlite.bak');

  const { providerIdByKind, modelIdByOldKey } = await service.importFromJson(legacyProviders);

  const oldProvider: string | undefined = raw?.chat?.defaultProvider;
  const oldModel: string | undefined = raw?.chat?.defaultModel;
  const defaultProviderId =
    oldProvider != null ? (providerIdByKind[oldProvider] ?? null) : null;
  const defaultModelId =
    oldProvider != null && oldModel != null
      ? (modelIdByOldKey[`${oldProvider}|${oldModel}`] ?? null)
      : null;

  const next = { ...raw };
  delete next.providers;
  next.chat = { ...(next.chat ?? {}) };
  delete next.chat.defaultProvider;
  delete next.chat.defaultModel;
  next.chat.defaultProviderId = defaultProviderId;
  next.chat.defaultModelId = defaultModelId;
  next.builtinsSeeded = true;

  const tmp = settingsPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, settingsPath);

  return 'imported';
}
