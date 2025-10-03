import { useState } from 'react';
import { Routes, Route } from 'react-router';
import { Divider, Listbox, ListboxItem } from '@heroui/react';

import ProviderOpenAI from './ProviderOpenAI';
import ProviderAzureOpenAI from './ProviderAzureOpenAI';
import ProviderAnthropic from './ProviderAnthropic';
import ProviderGoogle from './ProviderGoogle';
import ProviderDeepSeek from './ProviderDeepSeek';
import ProviderQwen from './ProviderQwen';
import ProviderOllama from './ProviderOllama';
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
    } else if (provider.id == 'deepseek') {
      newProvider = { ...provider, path: '/settings/models/deepseek' };
    } else if (provider.id == 'qwen') {
      newProvider = { ...provider, path: '/settings/models/qwen' };
    } else if (provider.id == 'ollama') {
      newProvider = { ...provider, path: '/settings/models/ollama' };
    } else {
      newProvider = provider;
    }

    return newProvider;
  });

  const activeStyle = (provider) => {
    return activeProvider != null && provider.id === activeProvider.id ? 'bg-default' : '';
  };

  const renderIcon = (provider) => {
    switch (provider.id) {
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
                  startContent={renderIcon(provider)}
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
          <Route
            path="deepseek"
            element={
              <ProviderDeepSeek
                settings={settings.find((s) => s.id === 'deepseek')}
                onSettingsChange={onSettingsChange}
              ></ProviderDeepSeek>
            }
          ></Route>
          <Route
            path="qwen"
            element={
              <ProviderQwen
                settings={settings.find((s) => s.id === 'qwen')}
                onSettingsChange={onSettingsChange}
              ></ProviderQwen>
            }
          ></Route>
          <Route
            path="ollama"
            element={
              <ProviderOllama
                settings={settings.find((s) => s.id === 'ollama')}
                onSettingsChange={onSettingsChange}
              ></ProviderOllama>
            }
          ></Route>
        </Routes>
      </div>
    </div>
  );
}

export default SettingsModel;
