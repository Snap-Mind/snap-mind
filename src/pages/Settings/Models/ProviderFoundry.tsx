import { useEffect, useState } from 'react';
import { Form, Input } from '@heroui/react';
import ModelTable from '../../../components/ModelTable';
import { SettingsChangeHandler } from '@/types';
import { FoundryConfig } from '@/types/providers';
import { useTranslation } from 'react-i18next';
import { ModelSetting } from '@/types/setting';

interface ProviderFoundryProps {
  settings: FoundryConfig;
  providerIndex: number;
  onSettingsChange: SettingsChangeHandler;
}

const DEFAULT_SCOPE = 'https://ai.azure.com/.default';

function ProviderFoundry({ settings, providerIndex, onSettingsChange }: ProviderFoundryProps) {
  const { t } = useTranslation();
  const [localSetting, setLocalSetting] = useState<FoundryConfig>({ ...settings });

  useEffect(() => {
    setLocalSetting({ ...settings });
  }, [settings]);

  const updateSetting = <K extends keyof FoundryConfig>(key: K, value: FoundryConfig[K]) => {
    if (providerIndex < 0) return;
    setLocalSetting((prev) => ({ ...prev, [key]: value }));
    onSettingsChange(
      ['providers', providerIndex, key as string],
      value as string | number | boolean | ModelSetting[]
    );
  };

  const handleModelsChange = (newModels: Array<ModelSetting>) => {
    updateSetting('models', newModels);
  };

  return (
    <div className="overflow-y-auto p-1 flex flex-col gap-5">
      <h1 className="font-bold text-2xl">{localSetting.name}</h1>
      <Form className="w-full flex flex-col gap-5">
        <Input
          label="Foundry Resource Endpoint"
          labelPlacement="outside"
          placeholder="e.g. https://{resource}.services.ai.azure.com"
          value={localSetting.host ?? ''}
          type="url"
          onValueChange={(value) => updateSetting('host', value)}
        />
        <Input
          label="Project Name"
          labelPlacement="outside"
          placeholder="e.g. my-foundry-project"
          value={localSetting.projectName ?? ''}
          type="text"
          onValueChange={(value) => updateSetting('projectName', value)}
          description="Required when endpoint does not already include /api/projects/{project-name}"
        />
        <Input
          label="Entra Scope"
          labelPlacement="outside"
          placeholder={DEFAULT_SCOPE}
          value={localSetting.entraScope ?? DEFAULT_SCOPE}
          type="text"
          onValueChange={(value) => updateSetting('entraScope', value || DEFAULT_SCOPE)}
          description="Authentication is fixed to Entra ID (Azure CLI token)."
        />
      </Form>

      <div className="max-w-full flex flex-col gap-4">
        <div className="font-weight-bold">{t('settings.providers.models')}</div>
        <ModelTable
          providerConfig={localSetting}
          onModelsChange={handleModelsChange}
          showSyncedButton={false}
        />
      </div>
    </div>
  );
}

export default ProviderFoundry;
