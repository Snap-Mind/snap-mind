import { useState, useEffect } from 'react';
import { Form, Input } from '@heroui/react';
import ModelTable from '../../../components/ModelTable';
import { SettingsChangeHandler } from '@/types';
import { OpenAIConfig } from '@/types/providers';
import PasswordInput from '../../../components/PasswordInput';
import { useTranslation } from 'react-i18next';
import { ModelSetting } from '@/types/setting';

interface ProviderOpenAIProps {
  settings: OpenAIConfig;
  onSettingsChange: SettingsChangeHandler;
}

function ProviderOpenAI({ settings, onSettingsChange }: ProviderOpenAIProps) {
  const { t } = useTranslation();
  const [localSetting, setLocalSetting] = useState<OpenAIConfig>({ ...settings });

  useEffect(() => {
    setLocalSetting({ ...settings });
  }, [settings]);

  const handleHostChange = (value: string) => {
    setLocalSetting((prev) => ({ ...prev, host: value }));
    onSettingsChange(['providers', 0, 'host'], value);
  };
  const handleTokenChange = (value: string) => {
    setLocalSetting((prev) => ({ ...prev, apiKey: value }));
    onSettingsChange(['providers', 0, 'apiKey'], value);
  };
  const handleModelsChange = (newModels: Array<ModelSetting>) => {
    setLocalSetting((prev) => ({ ...prev, models: newModels }));
    onSettingsChange(['providers', 0, 'models'], newModels);
  };

  return (
    <div className=" overflow-y-auto p-1 flex flex-col gap-5">
      <h1 className="font-bold text-2xl">{localSetting.name}</h1>
      <Form className="w-full flex flex-col gap-5">
        <Input
          label="Host"
          labelPlacement="outside"
          placeholder="e.g. https://api.openai.com/v1"
          value={localSetting.host ?? ''}
          type="url"
          onValueChange={handleHostChange}
        />
        <PasswordInput
          label="API Token"
          labelPlacement="outside"
          placeholder="Enter your API token"
          value={localSetting.apiKey ?? ''}
          onValueChange={handleTokenChange}
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

export default ProviderOpenAI;
