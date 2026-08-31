import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import {
  Divider,
  Input,
  Select,
  SelectItem,
  Slider,
  Textarea,
  addToast,
  useDisclosure,
} from '@heroui/react';
import { useTranslation } from 'react-i18next';

import AppModal from '@/components/AppModal';
import AgentEditorHeader from './AgentEditorHeader';
import BooleanInput from '@/components/BooleanInput';
import { useAgentsStore } from '@/stores/useAgentsStore';
import { useProvidersStore } from '@/stores/useProvidersStore';
import type { AgentDTO } from '@/types/agent-dto';
import {
  agentFormIsDirty,
  agentFormToPatch,
  validateAgentForm,
  type AgentFormErrors,
  type AgentFormField,
  type AgentFormValues,
} from './agentFormValidation';

interface AgentEditorProps {
  agent: AgentDTO;
}

function selectionToId(keys: 'all' | Set<React.Key>): number | null {
  if (keys === 'all' || keys.size === 0) return null;
  return Number(Array.from(keys)[0]);
}

function agentToFormValues(agent: AgentDTO): AgentFormValues {
  return {
    name: agent.name,
    description: agent.description ?? '',
    instructions: agent.instructions,
    providerId: agent.providerId,
    modelId: agent.modelId,
    maxTokens: agent.maxTokens ?? 2048,
    temperature: agent.temperature ?? 0.7,
    topP: agent.topP ?? 0.95,
    reasoning: agent.reasoning ?? false,
    webSearch: agent.webSearch ?? false,
  };
}

function AgentEditor({ agent }: AgentEditorProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const providers = useProvidersStore((s) => s.providers);
  const updateAgent = useAgentsStore((s) => s.updateAgent);
  const deleteAgent = useAgentsStore((s) => s.deleteAgent);
  const {
    isOpen: isDeleteOpen,
    onOpen: onDeleteOpen,
    onClose: onDeleteClose,
    onOpenChange: onDeleteOpenChange,
  } = useDisclosure();

  const [formValues, setFormValues] = useState<AgentFormValues>(() => agentToFormValues(agent));
  const [errors, setErrors] = useState<AgentFormErrors>({});

  useEffect(() => {
    setFormValues(agentToFormValues(agent));
    setErrors({});
    onDeleteClose();
  }, [agent.id, onDeleteClose]);

  const models = providers.find((p) => p.id === formValues.providerId)?.models ?? [];
  const modelIds = models.map((model) => model.id);

  const submitForm = useCallback(() => {
    const nextErrors = validateAgentForm(formValues, t, { modelIds });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!agentFormIsDirty(formValues, agent)) return;

    void (async () => {
      try {
        await updateAgent(agent.id, agentFormToPatch(formValues));
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

  const patchField = <K extends keyof AgentFormValues>(field: K, value: AgentFormValues[K]) => {
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

  const handleDeleteConfirm = async () => {
    await deleteAgent(agent.id);
    onDeleteClose();
    const remaining = useAgentsStore.getState().agents;
    navigate(remaining[0] ? `/settings/agents/${remaining[0].id}` : '/settings/agents');
  };

  return (
    <div className="flex flex-col pb-6">
      <div className="sticky top-0 z-30 -mx-3 bg-background px-3 pt-0">
        <AgentEditorHeader
          title={formValues.name}
          saveLabel={t('common.save')}
          onSave={submitForm}
          deleteLabel={t('settings.agents.deleteAgent')}
          onDelete={onDeleteOpen}
        />
        <Divider className="my-4" />
      </div>
      <form className="relative z-0 flex flex-col gap-5" noValidate onSubmit={handleSubmit}>
        <Input
          name="name"
          label={t('settings.agents.name')}
          isRequired
          value={formValues.name}
          onValueChange={(value) => {
            patchField('name', value);
            clearError('name');
          }}
          isInvalid={!!errors.name}
          errorMessage={errors.name}
        />
        <Input
          name="description"
          label={t('settings.agents.description')}
          value={formValues.description}
          onValueChange={(value) => patchField('description', value)}
        />
        <Textarea
          name="instructions"
          label={t('settings.agents.instructions')}
          placeholder={t('settings.agents.instructionsPlaceholder')}
          minRows={4}
          value={formValues.instructions}
          onValueChange={(value) => patchField('instructions', value)}
        />
        <Select
          name="providerId"
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
          name="modelId"
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

      <AppModal
        isOpen={isDeleteOpen}
        onOpenChange={onDeleteOpenChange}
        title={t('settings.agents.deleteAgent')}
        confirmLabel={t('common.delete')}
        confirmColor="danger"
        onConfirm={handleDeleteConfirm}
      >
        <div
          dangerouslySetInnerHTML={{
            __html: t('settings.agents.deleteAgentConfirm', { agentName: agent.name }),
          }}
        />
      </AppModal>
    </div>
  );
}

export default AgentEditor;
