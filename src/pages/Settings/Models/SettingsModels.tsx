import { useState } from 'react';
import { Routes, Route } from 'react-router';
import { Listbox, ListboxItem } from '@heroui/react';

import ProviderOpenAI from './ProviderOpenAI';
import ProviderAzureOpenAI from './ProviderAzureOpenAI';
import ProviderAnthropic from './ProviderAnthropic';
import ProviderGoogle from './ProviderGoogle';
import ProviderDeepSeek from './ProviderDeepSeek';
import ProviderQwen from './ProviderQwen';
import ProviderOllama from './ProviderOllama';
import Icon from '@/components/Icon';
import SettingsSplitLayout from '../SettingsSplitLayout';

import type { ProviderDTO } from '@/types/provider-dto';
import { useProvidersStore } from '@/stores/useProvidersStore';
import { useTranslation } from 'react-i18next';

type ProviderNavItem = ProviderDTO & { path?: string };

function SettingsModel() {
  const { t } = useTranslation();
  const providers = useProvidersStore((s) => s.providers);
  const [activeProvider, setActiveProvider] = useState<ProviderNavItem | null>(null);
  const providerOrder: Record<string, number> = {
    openai: 1,
    'azure-openai': 2,
    anthropic: 3,
    google: 4,
    deepseek: 5,
    qwen: 6,
    ollama: 7,
  };

  const navProviders: ProviderNavItem[] = providers
    .map((provider) => {
      const paths: Record<string, string> = {
        openai: '/settings/models/openai',
        'azure-openai': '/settings/models/azure-openai',
        anthropic: '/settings/models/anthropic',
        google: '/settings/models/google',
        deepseek: '/settings/models/deepseek',
        qwen: '/settings/models/qwen',
        ollama: '/settings/models/ollama',
      };
      return { ...provider, path: paths[provider.kind] };
    })
    .sort((a, b) => {
      const orderA = providerOrder[a.kind] ?? 999;
      const orderB = providerOrder[b.kind] ?? 999;
      return orderA - orderB;
    });

  const activeStyle = (provider: ProviderNavItem) => {
    return activeProvider != null && provider.id === activeProvider.id ? 'bg-default' : '';
  };

  const renderIcon = (provider: ProviderNavItem) => {
    switch (provider.kind) {
      case 'openai':
        return <Icon icon="openai" className="inline-block ml-2" size={18} />;
      case 'azure-openai':
        return <Icon icon="azure-openai" className="inline-block ml-2" size={18} />;
      case 'anthropic':
        return <Icon icon="anthropic" className="inline-block ml-2" size={18} />;
      case 'google':
        return <Icon icon="google" className="inline-block ml-2" size={18} />;
      case 'deepseek':
        return <Icon icon="deepseek" className="inline-block ml-2" size={18} />;
      case 'qwen':
        return <Icon icon="qwen" className="inline-block ml-2" size={18} />;
      case 'ollama':
        return <Icon icon="ollama" className="inline-block ml-2" size={18} />;
      default:
        return <Icon icon="bot" className="inline-block ml-2" size={18} />;
    }
  };

  const findByKind = (kind: string) => providers.find((p) => p.kind === kind);

  return (
    <SettingsSplitLayout
      title={t('settings.providers.title')}
      list={
        <Listbox aria-label="Actions">
          {navProviders.map((provider) => (
            <ListboxItem
              className={activeStyle(provider)}
              key={provider.id}
              href={provider.path ?? ''}
              startContent={renderIcon(provider)}
              onClick={() => setActiveProvider(provider)}
              textValue={provider.name}
            >
              {provider.name}
            </ListboxItem>
          ))}
        </Listbox>
      }
      details={
        <Routes>
          <Route path="openai" element={<ProviderOpenAI provider={findByKind('openai')!} />} />
          <Route
            path="azure-openai"
            element={<ProviderAzureOpenAI provider={findByKind('azure-openai')!} />}
          />
          <Route path="anthropic" element={<ProviderAnthropic provider={findByKind('anthropic')!} />} />
          <Route path="google" element={<ProviderGoogle provider={findByKind('google')!} />} />
          <Route path="deepseek" element={<ProviderDeepSeek provider={findByKind('deepseek')!} />} />
          <Route path="qwen" element={<ProviderQwen provider={findByKind('qwen')!} />} />
          <Route path="ollama" element={<ProviderOllama provider={findByKind('ollama')!} />} />
        </Routes>
      }
    />
  );
}

export default SettingsModel;
