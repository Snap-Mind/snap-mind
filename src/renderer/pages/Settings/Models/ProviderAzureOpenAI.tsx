import { useState, useEffect } from 'react';
import { Form, Input } from '@heroui/react';
import ModelTable from '../../../components/ModelTable';
import PasswordInput from '../../../components/PasswordInput';
import { useTranslation } from 'react-i18next';
import type { ProviderDTO } from '@/types/provider-dto';
import { useProvidersStore } from '@/stores/useProvidersStore';

interface ProviderAzureOpenAIProps {
  provider: ProviderDTO;
}

function ProviderAzureOpenAI({ provider }: ProviderAzureOpenAIProps) {
  const { t } = useTranslation();
  const updateProvider = useProvidersStore((s) => s.updateProvider);
  const [host, setHost] = useState(provider.host ?? '');
  const [apiKey, setApiKey] = useState(provider.apiKey ?? '');
  const [apiVersion, setApiVersion] = useState(provider.apiVersion ?? '');

  useEffect(() => {
    setHost(provider.host ?? '');
    setApiKey(provider.apiKey ?? '');
    setApiVersion(provider.apiVersion ?? '');
  }, [provider.host, provider.apiKey, provider.apiVersion]);

  return (
    <div className="p-1 flex flex-col gap-5">
      <h1 className="font-bold text-2xl">{provider.name}</h1>
      <Form className="w-full flex flex-col gap-5">
        <Input
          label="Host"
          labelPlacement="outside"
          placeholder="e.g. https://{your-resource-name}.openai.azure.com"
          value={host}
          type="url"
          onValueChange={(value) => {
            setHost(value);
            void updateProvider(provider.id, { host: value });
          }}
        />
        <PasswordInput
          label="API Token"
          labelPlacement="outside"
          placeholder="Enter your API token"
          value={apiKey}
          onValueChange={(value) => {
            setApiKey(value);
            void updateProvider(provider.id, { apiKey: value });
          }}
        />
        <Input
          label="API Version"
          labelPlacement="outside"
          placeholder="2024-10-21"
          value={apiVersion}
          type="text"
          onValueChange={(value) => {
            setApiVersion(value);
            void updateProvider(provider.id, { apiVersion: value });
          }}
        />
      </Form>
      <div className="max-w-full flex flex-col gap-4">
        <div className="font-weight-bold">{t('settings.providers.models')}</div>
        <ModelTable provider={provider} />
      </div>
    </div>
  );
}
export default ProviderAzureOpenAI;
