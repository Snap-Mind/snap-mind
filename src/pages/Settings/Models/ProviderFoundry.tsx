import { useEffect, useState } from 'react';
import { Alert, Form, Input } from '@heroui/react';
import ModelTable from '../../../components/ModelTable';
import { SettingsChangeHandler } from '@/types';
import { FoundryConfig } from '@/types/providers';
import { Trans, useTranslation } from 'react-i18next';
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
      <Alert
        color="warning"
        variant="faded"
        hideIconWrapper
        description={
          <Trans
            i18nKey="settings.providers.foundry.authDescriptionRich"
            components={[
              <span className="font-semibold text-warning-700" />,
              <code className="px-1.5 py-0.5 rounded bg-warning-100 text-warning-800 font-mono text-xs" />,
            ]}
          />
        }
      />
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
          description={t('settings.providers.foundry.projectNameDescription')}
        />
        <Input
          label="Entra Scope"
          labelPlacement="outside"
          placeholder={DEFAULT_SCOPE}
          value={localSetting.entraScope ?? DEFAULT_SCOPE}
          type="text"
          onValueChange={(value) => updateSetting('entraScope', value || DEFAULT_SCOPE)}
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
