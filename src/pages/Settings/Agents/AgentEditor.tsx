import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Slider,
  Textarea,
  useDisclosure,
} from '@heroui/react';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import BooleanInput from '@/components/BooleanInput';
import { useAgentsStore } from '@/stores/useAgentsStore';
import { useProvidersStore } from '@/stores/useProvidersStore';
import type { AgentDTO } from '@/types/agent-dto';

interface AgentEditorProps {
  agent: AgentDTO;
}

function selectionToId(keys: 'all' | Set<React.Key>): number | null {
  if (keys === 'all' || keys.size === 0) return null;
  return Number(Array.from(keys)[0]);
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
    onOpenChange: onDeleteOpenChange,
  } = useDisclosure();

  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description ?? '');
  const [instructions, setInstructions] = useState(agent.instructions);
  const [providerId, setProviderId] = useState<number | null>(agent.providerId);
  const [modelId, setModelId] = useState<number | null>(agent.modelId);
  const [isSaving, setIsSaving] = useState(false);

  // Re-seed local form state only when the user selects a different agent row.
  useEffect(() => {
    setName(agent.name);
    setDescription(agent.description ?? '');
    setInstructions(agent.instructions);
    setProviderId(agent.providerId);
    setModelId(agent.modelId);
  }, [agent.id]);

  const models = providers.find((p) => p.id === providerId)?.models ?? [];
  const canSave = name.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    try {
      await updateAgent(agent.id, {
        ...(agent.isBuiltin ? {} : { name: name.trim() }),
        description: description.trim() || null,
        instructions,
        providerId,
        modelId,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async (onClose: () => void) => {
    await deleteAgent(agent.id);
    onClose();
    navigate('/settings/agents');
  };

  return (
    <div className="p-1 flex flex-col gap-5 pb-6">
      <div className="flex items-start justify-between">
        <h1 className="font-bold text-2xl">{name}</h1>
        {!agent.isBuiltin && (
          <Button
            isIconOnly
            size="sm"
            variant="light"
            color="danger"
            onPress={onDeleteOpen}
            aria-label={t('settings.agents.deleteAgent')}
          >
            <Icon icon="trash-2" size={16} />
          </Button>
        )}
      </div>
      <Input
        label={t('settings.agents.name')}
        value={name}
        isReadOnly={agent.isBuiltin}
        description={agent.isBuiltin ? t('settings.agents.builtinNameLocked') : undefined}
        onValueChange={setName}
      />
      <Input
        label={t('settings.agents.description')}
        value={description}
        onValueChange={setDescription}
      />
      <Textarea
        label={t('settings.agents.instructions')}
        placeholder={t('settings.agents.instructionsPlaceholder')}
        minRows={4}
        value={instructions}
        onValueChange={setInstructions}
      />
      <Select
        label={t('settings.agents.provider')}
        isRequired
        selectedKeys={providerId != null ? [String(providerId)] : []}
        onSelectionChange={(keys) => {
          setProviderId(selectionToId(keys));
          setModelId(null);
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
        onSelectionChange={(keys) => setModelId(selectionToId(keys))}
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
        id="agent-reasoning"
        label={t('settings.chat.reasoning')}
        description={t('settings.chat.reasoningDescription')}
        isSelected={agent.reasoning ?? false}
        onValueChange={(checked) => void updateAgent(agent.id, { reasoning: checked })}
      />
      <BooleanInput
        id="agent-web-search"
        label={t('settings.chat.webSearch')}
        description={t('settings.chat.webSearchDescription')}
        isSelected={agent.webSearch ?? false}
        onValueChange={(checked) => void updateAgent(agent.id, { webSearch: checked })}
      />
      <Button color="primary" isDisabled={!canSave} isLoading={isSaving} onPress={handleSave}>
        {t('common.save')}
      </Button>

      <Modal isOpen={isDeleteOpen} onOpenChange={onDeleteOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {t('settings.agents.deleteAgent')}
              </ModalHeader>
              <ModalBody>
                <div
                  dangerouslySetInnerHTML={{
                    __html: t('settings.agents.deleteAgentConfirm', { agentName: agent.name }),
                  }}
                />
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="light" onPress={onClose}>
                  {t('common.cancel')}
                </Button>
                <Button color="danger" onPress={() => void handleDeleteConfirm(onClose)}>
                  {t('common.delete')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

export default AgentEditor;
