import { useState, useEffect } from 'react';
import { Form, Input } from '@heroui/react';
import ModelTable from '../../../components/ModelTable';
import { SettingsChangeHandler } from '@/types';
import { QwenConfig } from '@/types/providers';
import PasswordInput from '../../../components/PasswordInput';
import { useTranslation } from 'react-i18next';

interface ProviderQwenProps {
  settings: QwenConfig;
  onSettingsChange: SettingsChangeHandler;
}

function ProviderQwen({ settings, onSettingsChange }: ProviderQwenProps) {
  const { t } = useTranslation();
  const [localSetting, setLocalSetting] = useState<QwenConfig>({ ...settings });

  useEffect(() => {
    setLocalSetting({ ...settings });
  }, [settings]);

  const handleHostChange = (value: string) => {
    setLocalSetting((prev) => ({ ...prev, host: value }));
    onSettingsChange(['providers', 5, 'host'], value);
  };
  const handleApiKeyChange = (value: string) => {
    setLocalSetting((prev) => ({ ...prev, apiKey: value }));
    onSettingsChange(['providers', 5, 'apiKey'], value);
  };
  const handleModelsChange = (newModels) => {
    setLocalSetting((prev) => ({ ...prev, models: newModels }));
    onSettingsChange(['providers', 5, 'models'], newModels);
  };

  return (
    <div className="overflow-y-auto p-1 flex flex-col gap-5">
      <h1 className="font-bold text-2xl">{localSetting.name}</h1>
      <Form className="w-full flex flex-col gap-5">
        <Input
          label="Host"
          labelPlacement="outside"
          placeholder="e.g. https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
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

export default ProviderQwen;
