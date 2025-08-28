import { Form, Input } from '@heroui/react';
import ModelTable from '../../../components/ModelTable';
import { SettingsChangeHandler } from '@/types';
import { OpenAIConfig } from '@/types/providers';
import PasswordInput from '../../../components/PasswordInput';

interface ProviderOpenAIProps {
  settings: OpenAIConfig;
  onSettingsChange: SettingsChangeHandler;
}

function ProviderOpenAI({ settings, onSettingsChange }: ProviderOpenAIProps) {
  return (
    <div className=" overflow-y-auto p-1 flex flex-col gap-5">
      <h1 className="font-bold text-2xl">{settings.name}</h1>
      <Form className="w-full flex flex-col gap-5">
        <Input
          label="Host"
          labelPlacement="outside"
          placeholder="e.g. http://openai.com/chat/completion"
          defaultValue={settings.host ? settings.host : ''}
          type="url"
          onValueChange={(value) => onSettingsChange(['providers', 0, 'host'], value)}
        />
        <PasswordInput
          label="API Token"
          labelPlacement="outside"
          placeholder="Enter your API token"
          defaultValue={settings.apiKey ? settings.apiKey : ''}
          onValueChange={(value) => onSettingsChange(['providers', 0, 'apiKey'], value)}
        />
      </Form>

      <div className="max-w-full flex flex-col gap-4">
        <div className="font-weight-bold">Models</div>
        <ModelTable
          models={settings.models}
          onModelsChange={(newModels) => onSettingsChange(['providers', 0, 'models'], newModels)}
        />
      </div>
    </div>
  );
}

export default ProviderOpenAI;
