import { useState, useEffect } from 'react';
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
  const [localSetting, setLocalSetting] = useState<GoogleConfig>({ ...settings });

  useEffect(() => {
    setLocalSetting({ ...settings });
  }, [settings]);

  const handleHostChange = (value: string) => {
    setLocalSetting((prev) => ({ ...prev, host: value }));
    onSettingsChange(['providers', 3, 'host'], value);
  };
  const handleApiKeyChange = (value: string) => {
    setLocalSetting((prev) => ({ ...prev, apiKey: value }));
    onSettingsChange(['providers', 3, 'apiKey'], value);
  };
  const handleModelsChange = (newModels) => {
    setLocalSetting((prev) => ({ ...prev, models: newModels }));
    onSettingsChange(['providers', 3, 'models'], newModels);
  };

  return (
    <div className="overflow-y-auto p-1 flex flex-col gap-5">
      <h1 className="font-bold text-2xl">{localSetting.name}</h1>
      <Form className="w-full flex flex-col gap-5">
        <Input
          label="Host"
          labelPlacement="outside"
          placeholder="e.g. https://generativelanguage.googleapis.com/v1beta"
          value={localSetting.host ?? ''}
          type="url"
          onValueChange={handleHostChange}
        />
        <PasswordInput
          label="API Key"
          labelPlacement="outside"
          placeholder="Enter your API key"
          value={localSetting.apiKey ?? ''}
          onValueChange={handleApiKeyChange}
        />
      </Form>
      <div className="max-w-full flex flex-col gap-4">
        <div className="font-weight-bold">{t('settings.providers.models')}</div>
        <ModelTable
          providerConfig={localSetting}
          onModelsChange={handleModelsChange}
          showSyncedButton={true}
        />
      </div>
    </div>
  );
}

export default ProviderGoogle;
