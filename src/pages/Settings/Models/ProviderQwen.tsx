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
  return (
    <div className="overflow-y-auto p-1 flex flex-col gap-5">
      <h1 className="font-bold text-2xl">{settings.name}</h1>
      <Form className="w-full flex flex-col gap-5">
        <Input
          label="Host"
          labelPlacement="outside"
          placeholder="e.g. https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
          defaultValue={settings.host ? settings.host : ''}
          type="url"
          onValueChange={(value) => onSettingsChange(['providers', 5, 'host'], value)}
        />
        <PasswordInput
          label="API Key"
          labelPlacement="outside"
          placeholder="Enter your API key"
          defaultValue={settings.apiKey ? settings.apiKey : ''}
          onValueChange={(value) => onSettingsChange(['providers', 5, 'apiKey'], value)}
        />
      </Form>

      <div className="max-w-full flex flex-col gap-4">
        <div className="font-weight-bold">{t('settings.providers.models')}</div>
        <ModelTable
          providerConfig={settings}
          onModelsChange={(newModels) => onSettingsChange(['providers', 5, 'models'], newModels)}
        />
      </div>
    </div>
  );
}

export default ProviderQwen;
