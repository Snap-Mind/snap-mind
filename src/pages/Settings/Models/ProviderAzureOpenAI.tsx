import { Form, Input } from '@heroui/react';
import ModelTable from '../../../components/ModelTable';
import { SettingsChangeHandler } from '@/types';
import { AzureOpenAIConfig } from '@/types/providers';
import PasswordInput from '../../../components/PasswordInput';
import { useTranslation } from 'react-i18next';

interface ProviderAzureOpenAIProps {
  settings: AzureOpenAIConfig;
  onSettingsChange: SettingsChangeHandler;
}

function ProviderAzureOpenAI({ settings, onSettingsChange }: ProviderAzureOpenAIProps) {
  const { t } = useTranslation();
  return (
    <div className="p-1 flex flex-col gap-5">
      <h1 className="font-bold text-2xl">{settings.name}</h1>
      <Form className="w-full flex flex-col gap-5">
        <Input
          label="Host"
          labelPlacement="outside"
          placeholder="e.g. http://openai.com/chat/completion"
          defaultValue={settings.host ? settings.host : ''}
          type="url"
          onValueChange={(value) => onSettingsChange(['providers', 1, 'host'], value)}
        />
        <PasswordInput
          label="API Token"
          labelPlacement="outside"
          placeholder="Enter your API token"
          defaultValue={settings.apiKey ? settings.apiKey : ''}
          onValueChange={(value) => onSettingsChange(['providers', 1, 'apiKey'], value)}
        />
        <Input
          label="API Version"
          labelPlacement="outside"
          placeholder="2024-10-21"
          defaultValue={settings.apiVersion ? settings.apiVersion : ''}
          type="text"
          onValueChange={(value) => onSettingsChange(['providers', 1, 'apiVersion'], value)}
        />
      </Form>
      <div className="max-w-full flex flex-col gap-4">
        <div className="font-weight-bold">{t('settings.providers.models')}</div>
        <ModelTable
          models={settings.models}
          onModelsChange={(newModels) => onSettingsChange(['providers', 1, 'models'], newModels)}
        />
      </div>
    </div>
  );
}
export default ProviderAzureOpenAI;
