import { Form, Input } from '@heroui/react';
import ModelTable from '../../../components/ModelTable';
import { SettingsChangeHandler } from '@/types';
import { AnthropicConfig } from '@/types/providers';
import PasswordInput from '../../../components/PasswordInput';
import { useTranslation } from 'react-i18next';

interface ProviderAnthropicProps {
  settings: AnthropicConfig;
  onSettingsChange: SettingsChangeHandler;
}

function ProviderAnthropic({ settings, onSettingsChange }: ProviderAnthropicProps) {
  const { t } = useTranslation();
  return (
    <div className=" overflow-y-auto p-1 flex flex-col gap-5">
      <h1 className="font-bold text-2xl">{settings.name}</h1>
      <Form className="w-full flex flex-col gap-5">
        <Input
          label="Host"
          labelPlacement="outside"
          placeholder="e.g. https://api.anthropic.com/v1/messages"
          defaultValue={settings.host ? settings.host : ''}
          type="url"
          onValueChange={(value) => onSettingsChange(['providers', 2, 'host'], value)}
        />
        <PasswordInput
          label="API Token"
          labelPlacement="outside"
          placeholder="Enter your API token"
          defaultValue={settings.apiKey ? settings.apiKey : ''}
          onValueChange={(value) => onSettingsChange(['providers', 2, 'apiKey'], value)}
        />
      </Form>

      <div className="max-w-full flex flex-col gap-4">
        <div className="font-weight-bold">{t('settings.providers.models')}</div>
        <ModelTable
          models={settings.models}
          onModelsChange={(newModels) => onSettingsChange(['providers', 2, 'models'], newModels)}
        />
      </div>
    </div>
  );
}

export default ProviderAnthropic;
