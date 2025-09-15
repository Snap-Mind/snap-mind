import { useState } from 'react';
import { Routes, Route } from 'react-router';
import { Divider, Listbox, ListboxItem } from '@heroui/react';

import ProviderOpenAI from './ProviderOpenAI';
import ProviderAzureOpenAI from './ProviderAzureOpenAI';
import ProviderAnthropic from './ProviderAnthropic';
import ProviderGoogle from './ProviderGoogle';
import Icon from '@/components/Icon';

import { ProviderSetting } from '@/types/setting';
import { SettingsChangeHandler } from '@/types';
import { AzureOpenAIConfig } from '@/types/providers';
import { useTranslation } from 'react-i18next';

interface SettingsModelProps {
  settings: ProviderSetting[];
  onSettingsChange: SettingsChangeHandler;
}

function SettingsModel({ settings, onSettingsChange }: SettingsModelProps) {
  const { t } = useTranslation();
  const [activeProvider, setActiveProvider] = useState<ProviderSetting | null>(null);
  const providers = settings.map((provider) => {
    let newProvider = null;

    if (provider.id === 'openai') {
      newProvider = { ...provider, path: '/settings/models/openai' };
    } else if (provider.id == 'azure-openai') {
      newProvider = { ...provider, path: '/settings/models/azure-openai' };
    } else if (provider.id == 'anthropic') {
      newProvider = { ...provider, path: '/settings/models/anthropic' };
    } else if (provider.id == 'google') {
      newProvider = { ...provider, path: '/settings/models/google' };
    } else {
      newProvider = provider;
    }

    return newProvider;
  });

  const activeStyle = (provider) => {
    return activeProvider != null && provider.id === activeProvider.id ? 'bg-default' : '';
  };

  return (
    <div className="setting-container grid grid-cols-[250px_1px_1fr] grid-rows-1 h-[100vh]">
      <div className="setting-category bg-background">
        <div className="container grid grid-cols-1 grid-rows-[65px_1fr] h-full px-3 py-3">
          <div className="header">
            <h1 className="font-bold text-2xl">{t('settings.providers.title')}</h1>
            <Divider className="my-4" />
          </div>
          <div className="body overflow-y-auto">
            <Listbox aria-label="Actions">
              {providers.map((provider) => (
                <ListboxItem
                  className={activeStyle(provider)}
                  key={provider.id}
                  href={provider?.path ? provider.path : ''}
                  startContent={<Icon icon="bot" className="inline-block ml-2" size={18} />}
                  onClick={() => setActiveProvider(provider)}
                >
                  {provider.name}
                </ListboxItem>
              ))}
            </Listbox>
          </div>
        </div>
      </div>
      <Divider orientation="vertical" />
      <div className="setting-details h-[100vh] overflow-y-auto bg-background px-3 py-3">
        <Routes>
          <Route
            path="openai"
            element={
              <ProviderOpenAI
                settings={settings.find((s) => s.id === 'openai')}
                onSettingsChange={onSettingsChange}
              ></ProviderOpenAI>
            }
          ></Route>
          <Route
            path="azure-openai"
            element={
              <ProviderAzureOpenAI
                settings={settings.find((s) => s.id === 'azure-openai') as AzureOpenAIConfig}
                onSettingsChange={onSettingsChange}
              ></ProviderAzureOpenAI>
            }
          ></Route>
          <Route
            path="anthropic"
            element={
              <ProviderAnthropic
                settings={settings.find((s) => s.id === 'anthropic')}
                onSettingsChange={onSettingsChange}
              ></ProviderAnthropic>
            }
          ></Route>
          <Route
            path="google"
            element={
              <ProviderGoogle
                settings={settings.find((s) => s.id === 'google')}
                onSettingsChange={onSettingsChange}
              ></ProviderGoogle>
            }
          ></Route>
        </Routes>
      </div>
    </div>
  );
}

export default SettingsModel;
