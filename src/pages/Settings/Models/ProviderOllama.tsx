import { Button, Form, Input } from '@heroui/react';
import ModelTable from '../../../components/ModelTable';
import { SettingsChangeHandler } from '@/types';
import { OllamaConfig } from '@/types/providers';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useLogService } from '../../../hooks/useLogService';
import ProviderFactory from '@/services/providers/ProviderFactory';
import Icon from '@/components/Icon';

interface ProviderOllamaProps {
  settings: OllamaConfig;
  onSettingsChange: SettingsChangeHandler;
}

function ProviderOllama({ settings, onSettingsChange }: ProviderOllamaProps) {
  const { t } = useTranslation();
  const [discovering, setDiscovering] = useState(false);
  const logger = useLogService();
  // In default config, ollama is appended after qwen (index 6 if zero-based)
  const idx = 6;

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const provider = ProviderFactory.createProvider('ollama', settings);
      const models = await provider.listModels();
      if (Array.isArray(models) && models.length > 0) {
        onSettingsChange(['providers', idx, 'models'], models);
      }
    } catch (e) {
      logger.error('[Ollama] auto discover failed:', e);
    } finally {
      setDiscovering(false);
    }
  };

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
          models={settings.models}
          onModelsChange={(newModels) => onSettingsChange(['providers', idx, 'models'], newModels)}
          extraActions={
            <Button isIconOnly isLoading={discovering} isDisabled={discovering} onPress={handleDiscover}>
              <Icon icon="cloud" />
            </Button>
          }
        />
      </div>
    </div>
  );
}

export default ProviderOllama;
