import { Form, Input } from '@heroui/react';
import ModelTable from '../../../components/ModelTable';
import { SettingsChangeHandler } from '@/types';
import { GoogleConfig } from '@/types/providers';
import PasswordInput from '../../../components/PasswordInput';
import { useTranslation } from 'react-i18next';

interface ProviderGoogleProps {
  settings: GoogleConfig;
  onSettingsChange: SettingsChangeHandler;
}

function ProviderGoogle({ settings, onSettingsChange }: ProviderGoogleProps) {
  const { t } = useTranslation();
  return (
    <div className="overflow-y-auto p-1 flex flex-col gap-5">
      <h1 className="font-bold text-2xl">{settings.name}</h1>
      <Form className="w-full flex flex-col gap-5">
        <Input
          label="Host"
          labelPlacement="outside"
          placeholder="e.g. https://generativelanguage.googleapis.com/v1"
          defaultValue={settings.host ? settings.host : ''}
          type="url"
          onValueChange={(value) => onSettingsChange(['providers', 3, 'host'], value)}
        />
        <PasswordInput
          label="API Key"
          labelPlacement="outside"
          placeholder="Enter your API key"
          defaultValue={settings.apiKey ? settings.apiKey : ''}
          onValueChange={(value) => onSettingsChange(['providers', 3, 'apiKey'], value)}
        />
      </Form>

      <div className="max-w-full flex flex-col gap-4">
        <div className="font-weight-bold">{t('settings.providers.models')}</div>
        <ModelTable
          models={settings.models}
          onModelsChange={(newModels) => onSettingsChange(['providers', 3, 'models'], newModels)}
        />
      </div>
    </div>
  );
}

export default ProviderGoogle;
