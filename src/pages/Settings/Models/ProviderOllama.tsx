import { useState, useEffect } from 'react';
import { Form, Input } from '@heroui/react';
import ModelTable from '../../../components/ModelTable';
import { useTranslation } from 'react-i18next';
import type { ProviderDTO } from '@/types/provider-dto';
import { useProvidersStore } from '@/stores/useProvidersStore';

interface ProviderOllamaProps {
  provider: ProviderDTO;
}

function ProviderOllama({ provider }: ProviderOllamaProps) {
  const { t } = useTranslation();
  const updateProvider = useProvidersStore((s) => s.updateProvider);
  const [host, setHost] = useState(provider.host ?? '');

  useEffect(() => {
    setHost(provider.host ?? '');
  }, [provider.host]);

  return (
    <div className="overflow-y-auto p-1 flex flex-col gap-5">
      <h1 className="font-bold text-2xl">{provider.name}</h1>
      <Form className="w-full flex flex-col gap-5">
        <Input
          label="Host"
          labelPlacement="outside"
          placeholder="e.g. http://localhost:11434/api/chat"
          value={host}
          type="url"
          onValueChange={(value) => {
            setHost(value);
            void updateProvider(provider.id, { host: value });
          }}
        />
      </Form>

      <div className="max-w-full flex flex-col gap-4">
        <div className="font-weight-bold">{t('settings.providers.models')}</div>
        <ModelTable provider={provider} showSyncedButton={true} />
      </div>
    </div>
  );
}

export default ProviderOllama;
