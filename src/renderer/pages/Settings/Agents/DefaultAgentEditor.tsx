import { useCallback, useState, type FormEvent } from 'react';
import { Divider, Input, Select, SelectItem, Slider, Textarea, addToast } from '@heroui/react';
import { useTranslation } from 'react-i18next';

import AgentEditorHeader from './AgentEditorHeader';
import BooleanInput from '@/components/BooleanInput';
import { useAgentsStore } from '@/stores/useAgentsStore';
import { useProvidersStore } from '@/stores/useProvidersStore';
import type { AgentDTO } from '@/types/agent-dto';
import {
  defaultAgentFormIsDirty,
  defaultAgentFormToPatch,
  validateDefaultAgentForm,
  type AgentFormErrors,
  type AgentFormField,
  type AgentFormValues,
} from './agentFormValidation';

interface DefaultAgentEditorProps {
  agent: AgentDTO;
}

function selectionToId(keys: 'all' | Set<React.Key>): number | null {
  if (keys === 'all' || keys.size === 0) return null;
  return Number(Array.from(keys)[0]);
}

type DefaultAgentFormValues = Omit<AgentFormValues, 'name' | 'description' | 'instructions'>;

function agentToDefaultFormValues(agent: AgentDTO): DefaultAgentFormValues {
  return {
    providerId: agent.providerId,
    modelId: agent.modelId,
    maxTokens: agent.maxTokens ?? 2048,
    temperature: agent.temperature ?? 0.7,
    topP: agent.topP ?? 0.95,
    reasoning: agent.reasoning ?? false,
    webSearch: agent.webSearch ?? false,
  };
}

function DefaultAgentEditor({ agent }: DefaultAgentEditorProps) {
  const { t } = useTranslation();
  const providers = useProvidersStore((s) => s.providers);
  const updateAgent = useAgentsStore((s) => s.updateAgent);
  const [formValues, setFormValues] = useState<DefaultAgentFormValues>(() =>
    agentToDefaultFormValues(agent)
  );
  const [errors, setErrors] = useState<AgentFormErrors>({});

  const models = providers.find((p) => p.id === formValues.providerId)?.models ?? [];
  const modelIds = models.map((model) => model.id);

  const patchField = <K extends keyof DefaultAgentFormValues>(
    field: K,
    value: DefaultAgentFormValues[K]
  ) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const clearError = (field: AgentFormField) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const submitForm = useCallback(() => {
    const nextErrors = validateDefaultAgentForm(formValues, t, { modelIds });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!defaultAgentFormIsDirty(formValues, agent)) return;

    void (async () => {
      try {
        await updateAgent(agent.id, defaultAgentFormToPatch(formValues));
        addToast({
          title: t('settings.agents.saved'),
          color: 'success',
          timeout: 1000,
        });
      } catch {
        addToast({
          title: t('settings.agents.saveFailed'),
          color: 'danger',
          timeout: 3000,
        });
      }
    })();
  }, [agent, formValues, modelIds, t, updateAgent]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitForm();
  };

  return (
    <div className="flex flex-col pb-6">
      <div className="sticky top-0 z-30 -mx-3 bg-background px-3 pt-0">
        <AgentEditorHeader title={agent.name} onSave={submitForm} />
        <Divider className="my-4" />
      </div>
      <form className="relative z-0 flex flex-col gap-5" noValidate onSubmit={handleSubmit}>
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
          selectedKeys={formValues.providerId != null ? [String(formValues.providerId)] : []}
          onSelectionChange={(keys) => {
            patchField('providerId', selectionToId(keys));
            patchField('modelId', null);
            clearError('providerId');
            clearError('modelId');
          }}
          isInvalid={!!errors.providerId}
          errorMessage={errors.providerId}
        >
          {providers.map((provider) => (
            <SelectItem key={String(provider.id)}>{provider.name}</SelectItem>
          ))}
        </Select>
        <Select
          label={t('settings.agents.model')}
          isRequired
          isDisabled={formValues.providerId == null}
          description={
            errors.modelId
              ? undefined
              : formValues.providerId != null && models.length === 0
                ? t('settings.agents.noModelsForProvider')
                : undefined
          }
          selectedKeys={formValues.modelId != null ? [String(formValues.modelId)] : []}
          onSelectionChange={(keys) => {
            patchField('modelId', selectionToId(keys));
            clearError('modelId');
          }}
          isInvalid={!!errors.modelId}
          errorMessage={errors.modelId}
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
          value={formValues.maxTokens}
          onChange={(value) => patchField('maxTokens', value as number)}
        />
        <Slider
          label={t('settings.chat.temperature')}
          className="max-w-full"
          size="sm"
          minValue={0}
          maxValue={1}
          step={0.01}
          value={formValues.temperature}
          onChange={(value) => patchField('temperature', value as number)}
        />
        <Slider
          label={t('settings.chat.topP')}
          className="max-w-full"
          size="sm"
          minValue={0.1}
          maxValue={1}
          step={0.01}
          value={formValues.topP}
          onChange={(value) => patchField('topP', value as number)}
        />
        <BooleanInput
          id={`agent-${agent.id}-reasoning`}
          label={t('settings.chat.reasoning')}
          description={t('settings.chat.reasoningDescription')}
          isSelected={formValues.reasoning}
          onValueChange={(checked) => patchField('reasoning', checked)}
        />
        <BooleanInput
          id={`agent-${agent.id}-web-search`}
          label={t('settings.chat.webSearch')}
          description={t('settings.chat.webSearchDescription')}
          isSelected={formValues.webSearch}
          onValueChange={(checked) => patchField('webSearch', checked)}
        />
      </form>
    </div>
  );
}

export default DefaultAgentEditor;
