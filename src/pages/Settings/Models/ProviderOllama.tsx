import { Form, Input } from '@heroui/react';
import ModelTable from '../../../components/ModelTable';
import { SettingsChangeHandler } from '@/types';
import { OllamaConfig } from '@/types/providers';
import { useTranslation } from 'react-i18next';

interface ProviderOllamaProps {
  settings: OllamaConfig;
  onSettingsChange: SettingsChangeHandler;
}

function ProviderOllama({ settings, onSettingsChange }: ProviderOllamaProps) {
  const { t } = useTranslation();
  // In default config, ollama is appended after qwen (index 6 if zero-based)
  const idx = 6;

  return (
    <div className="overflow-y-auto p-1 flex flex-col gap-5">
      <h1 className="font-bold text-2xl">{settings.name}</h1>
      <Form className="w-full flex flex-col gap-5">
        <Input
          label="Host"
          labelPlacement="outside"
          placeholder="e.g. http://localhost:11434/api/chat"
          defaultValue={settings.host ? settings.host : ''}
          type="url"
          onValueChange={(value) => onSettingsChange(['providers', idx, 'host'], value)}
        />
      </Form>

      <div className="max-w-full flex flex-col gap-4">
        <div className="font-weight-bold">{t('settings.providers.models')}</div>
        <ModelTable
          providerConfig={settings}
          onModelsChange={(newModels) => onSettingsChange(['providers', idx, 'models'], newModels)}
          showSyncedButton={true}
        />
      </div>
    </div>
  );
}

export default ProviderOllama;
