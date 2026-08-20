import type { ProviderDTO } from '@/types/provider-dto';
import type { Capability, ModelType } from '@/types/setting';
import type {
  AzureOpenAIConfig,
  BaseProviderConfig,
  GoogleConfig,
  ProviderType,
} from '@/types/providers';

export function providerDtoToBaseConfig(provider: ProviderDTO): BaseProviderConfig {
  const base: BaseProviderConfig = {
    id: provider.id,
    kind: provider.kind as ProviderType,
    name: provider.name,
    apiKey: provider.apiKey ?? '',
    host: provider.host ?? '',
    models: provider.models.map((m) => ({
      id: m.modelId,
      name: m.name,
      type: (m.type ?? 'chat') as ModelType,
      description: m.description ?? '',
      capabilities: m.capabilities as Capability[],
    })),
  };

  if (provider.apiVersion) {
    (base as AzureOpenAIConfig).apiVersion = provider.apiVersion;
  }
  if (provider.config) {
    (base as GoogleConfig).config = provider.config as GoogleConfig['config'];
  }

  return base;
}
