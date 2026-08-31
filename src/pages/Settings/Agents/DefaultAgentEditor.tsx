import { useEffect, useState } from 'react';
import { Input, Select, SelectItem, Slider, Textarea } from '@heroui/react';
import { useTranslation } from 'react-i18next';

import BooleanInput from '@/components/BooleanInput';
import { useAgentsStore } from '@/stores/useAgentsStore';
import { useProvidersStore } from '@/stores/useProvidersStore';
import type { AgentDTO } from '@/types/agent-dto';

interface DefaultAgentEditorProps {
  agent: AgentDTO;
}

function selectionToId(keys: 'all' | Set<React.Key>): number | null {
  if (keys === 'all' || keys.size === 0) return null;
  return Number(Array.from(keys)[0]);
}

function DefaultAgentEditor({ agent }: DefaultAgentEditorProps) {
  const { t } = useTranslation();
  const providers = useProvidersStore((s) => s.providers);
  const updateAgent = useAgentsStore((s) => s.updateAgent);
  const [providerId, setProviderId] = useState<number | null>(agent.providerId);
  const [modelId, setModelId] = useState<number | null>(agent.modelId);

  useEffect(() => {
    setProviderId(agent.providerId);
    setModelId(agent.modelId);
  }, [agent.id, agent.providerId, agent.modelId]);

  const models = providers.find((p) => p.id === providerId)?.models ?? [];

  return (
    <div className="flex flex-col gap-5 p-1 pb-6">
      <h1 className="min-w-0 text-2xl font-bold">{agent.name}</h1>
      <Input
        label={t('settings.agents.name')}
        value={agent.name}
        isDisabled
        description={t('settings.agents.builtinNameLocked')}
      />
      <Input
        label={t('settings.agents.description')}
        value={agent.description ?? ''}
        isDisabled
      />
      <Textarea
        label={t('settings.agents.instructions')}
        minRows={4}
        value={agent.instructions}
        isDisabled
      />
      <Select
        label={t('settings.agents.provider')}
        isRequired
        selectedKeys={providerId != null ? [String(providerId)] : []}
        onSelectionChange={(keys) => {
          const nextProviderId = selectionToId(keys);
          setProviderId(nextProviderId);
          setModelId(null);
          void updateAgent(agent.id, { providerId: nextProviderId, modelId: null });
        }}
      >
        {providers.map((provider) => (
          <SelectItem key={String(provider.id)}>{provider.name}</SelectItem>
        ))}
      </Select>
      <Select
        label={t('settings.agents.model')}
        isRequired
        isDisabled={providerId == null}
        description={
          providerId != null && models.length === 0
            ? t('settings.agents.noModelsForProvider')
            : undefined
        }
        selectedKeys={modelId != null ? [String(modelId)] : []}
        onSelectionChange={(keys) => {
          const nextModelId = selectionToId(keys);
          setModelId(nextModelId);
          void updateAgent(agent.id, { modelId: nextModelId });
        }}
      >
        {models.map((model) => (
          <SelectItem key={String(model.id)}>{model.modelId}</SelectItem>
        ))}
      </Select>
      <Slider
        label={t('settings.chat.maxTokens')}
        className="max-w-full"
        size="sm"
        minValue={1}
        maxValue={16000}
        step={1}
        defaultValue={agent.maxTokens ?? 2048}
        onChangeEnd={(value) => void updateAgent(agent.id, { maxTokens: value as number })}
      />
      <Slider
        label={t('settings.chat.temperature')}
        className="max-w-full"
        size="sm"
        minValue={0}
        maxValue={1}
        step={0.01}
        defaultValue={agent.temperature ?? 0.7}
        onChangeEnd={(value) => void updateAgent(agent.id, { temperature: value as number })}
      />
      <Slider
        label={t('settings.chat.topP')}
        className="max-w-full"
        size="sm"
        minValue={0.1}
        maxValue={1}
        step={0.01}
        defaultValue={agent.topP ?? 0.95}
        onChangeEnd={(value) => void updateAgent(agent.id, { topP: value as number })}
      />
      <BooleanInput
        id="default-agent-reasoning"
        label={t('settings.chat.reasoning')}
        description={t('settings.chat.reasoningDescription')}
        isSelected={agent.reasoning ?? false}
        onValueChange={(checked) => void updateAgent(agent.id, { reasoning: checked })}
      />
      <BooleanInput
        id="default-agent-web-search"
        label={t('settings.chat.webSearch')}
        description={t('settings.chat.webSearchDescription')}
        isSelected={agent.webSearch ?? false}
        onValueChange={(checked) => void updateAgent(agent.id, { webSearch: checked })}
      />
    </div>
  );
}

export default DefaultAgentEditor;
