import { useCallback, useState, useRef, useEffect } from 'react';
import {
  Button,
  ButtonGroup,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Tooltip,
} from '@heroui/react';
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@heroui/table';
import { semanticColors } from '@heroui/theme';
import { useTheme } from '@heroui/use-theme';

import Icon from './Icon';
import { ModelCreateForm } from './ModelCreateForm';
import { Capability, ModelSetting } from '@/types/setting';
import { ModelEditForm } from './ModelEditForm';
import { useTranslation } from 'react-i18next';
import ProviderFactory from '@/services/providers/ProviderFactory';
import { useLogService } from '@/hooks/useLogService';
import type { ModelCapability, ModelDTO, ProviderDTO } from '@/types/provider-dto';
import { useProvidersStore } from '@/stores/useProvidersStore';
import { providerDtoToBaseConfig } from '@/utils/providerMapper';

interface Column {
  name: string;
  uid: string;
}

interface ModelTableProps {
  provider: ProviderDTO;
  showSyncedButton?: boolean;
}

const initialFormData: ModelSetting = {
  id: '',
  name: '',
  type: 'chat',
  capabilities: ['chat'],
  description: '',
};

function modelDtoToForm(model: ModelDTO): ModelSetting {
  return {
    id: model.modelId,
    name: model.name,
    type: (model.type ?? 'chat') as ModelSetting['type'],
    capabilities: model.capabilities as Capability[],
    description: model.description ?? '',
  };
}

function ModelTable({ provider, showSyncedButton = false }: ModelTableProps) {
  const { t } = useTranslation();
  const logger = useLogService();
  const upsertModel = useProvidersStore((s) => s.upsertModel);
  const deleteModel = useProvidersStore((s) => s.deleteModel);
  const [discovering, setDiscovering] = useState(false);
  const { theme } = useTheme();
  const columns: Column[] = [
    { name: t('settings.providers.name'), uid: 'name' },
    { name: t('settings.providers.actions'), uid: 'actions' },
  ];
  const {
    isOpen: isAddModelOpen,
    onOpen: onAddModelOpen,
    onOpenChange: onAddModelOpenChange,
  } = useDisclosure();
  const {
    isOpen: isEditModelOpen,
    onOpen: onEditModelOpen,
    onOpenChange: onEditModelOpenChange,
  } = useDisclosure();
  const {
    isOpen: isDeleteModelOpen,
    onOpen: onDeleteModelOpen,
    onOpenChange: onDeleteModelOpenChange,
  } = useDisclosure();
  const [localModels, setLocalModels] = useState<ModelDTO[]>([...provider.models]);
  const [addFormData, setAddFormData] = useState<ModelSetting>(initialFormData);
  const [editFormData, setEditFormData] = useState<ModelSetting>();
  const [searchQuery, setSearchQuery] = useState('');
  const addFormRef = useRef<HTMLFormElement>(null);
  const editFormRef = useRef<HTMLFormElement>(null);
  const [deleteModelPk, setDeleteModelPk] = useState<number | null>(null);
  const [deleteModelName, setDeleteModelName] = useState<string>('');
  const [addModelErrors, setAddModelErrors] = useState<Partial<Record<keyof ModelSetting, string>>>(
    {}
  );
  const [editModelErrors, setEditModelErrors] = useState<
    Partial<Record<keyof ModelSetting, string>>
  >({});

  useEffect(() => {
    setLocalModels([...provider.models]);
  }, [provider.models]);

  const handleAddModel = async () => {
    if (addFormRef.current && addFormRef.current.checkValidity()) {
      const errors: Partial<Record<keyof ModelSetting, string>> = {};
      const isDuplicate = localModels.some((model) => model.modelId === addFormData.id);
      if (isDuplicate) {
        errors.id = 'Model id already exists. Please use a unique id.';
        setAddModelErrors(errors);
        return;
      }
      setAddModelErrors({});
      await upsertModel(provider.id, {
        modelId: addFormData.id,
        name: addFormData.name,
        type: addFormData.type,
        capabilities: addFormData.capabilities as ModelCapability[],
        description: addFormData.description,
      });
      setAddFormData(initialFormData);
      onAddModelOpenChange();
    } else {
      addFormRef.current?.reportValidity();
    }
  };

  const handleEditModel = async () => {
    if (editFormRef.current && editFormRef.current.checkValidity() && editFormData) {
      setEditModelErrors({});
      await upsertModel(provider.id, {
        modelId: editFormData.id,
        name: editFormData.name,
        type: editFormData.type,
        capabilities: editFormData.capabilities as ModelCapability[],
        description: editFormData.description,
      });
      setEditFormData(undefined);
      onEditModelOpenChange();
    } else {
      editFormRef.current?.reportValidity();
    }
  };

  const handleDeleteModelRequest = useCallback(
    (pk: number, name: string) => {
      setDeleteModelPk(pk);
      setDeleteModelName(name);
      onDeleteModelOpen();
    },
    [onDeleteModelOpen]
  );

  const handleDeleteModelConfirm = useCallback(async () => {
    if (deleteModelPk != null) {
      await deleteModel(provider.id, deleteModelPk);
      setDeleteModelPk(null);
      setDeleteModelName('');
      onDeleteModelOpenChange();
    }
  }, [deleteModelPk, deleteModel, provider.id, onDeleteModelOpenChange]);

  const handleDeleteModelCancel = useCallback((onClose: () => void) => {
    setDeleteModelPk(null);
    setDeleteModelName('');
    onClose();
  }, []);

  const openEditModel = useCallback(
    (model: ModelDTO) => {
      setEditFormData(modelDtoToForm(model));
      onEditModelOpen();
    },
    [onEditModelOpen]
  );

  const handleAddModelCancel = (onClose: () => void) => {
    setAddFormData(initialFormData);
    setAddModelErrors({});
    onClose();
  };

  const handleEditModelCancel = (onClose: () => void) => {
    setEditFormData(undefined);
    setEditModelErrors({});
    onClose();
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const adapter = ProviderFactory.createProvider(providerDtoToBaseConfig(provider));
      const syncedModels = await adapter.listModels();
      if (Array.isArray(syncedModels) && syncedModels.length > 0) {
        for (const model of syncedModels) {
          await upsertModel(provider.id, {
            modelId: model.id,
            name: model.name,
            type: model.type,
            capabilities: model.capabilities as ModelCapability[],
            description: model.description,
          });
        }
      }
    } catch (e) {
      logger.error(`[${provider.kind}] auto discover failed:`, e);
    } finally {
      setDiscovering(false);
    }
  };

  const handleCleanModels = async () => {
    setDiscovering(true);
    try {
      for (const model of localModels) {
        await deleteModel(provider.id, model.id);
      }
    } catch (e) {
      logger.error(`[${provider.kind}] clean models failed:`, e);
    } finally {
      setDiscovering(false);
    }
  };

  const handleSearchValueChange = (value: string) => {
    setSearchQuery(value);
  };

  const filteredModels = localModels.filter((model) =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderCell = useCallback(
    (model: ModelDTO, columnKey: string) => {
      if (columnKey === 'name') {
        return model.name;
      } else if (columnKey === 'actions') {
        const className = 'cursor-pointer';
        const themeColor = theme === 'light' ? semanticColors.light : semanticColors.dark;
        const dangerColor = themeColor.danger as { DEFAULT: string };
        return (
          <span className="flex justify-center gap-2">
            <Icon
              icon="square-pen"
              className={className}
              svgClassName="inline-block"
              onClick={() => openEditModel(model)}
            />
            <Icon
              icon="trash-2"
              className={className}
              svgClassName="inline-block"
              color={theme === 'light' ? dangerColor.DEFAULT : dangerColor.DEFAULT}
              onClick={() => handleDeleteModelRequest(model.id, model.name)}
            />
          </span>
        );
      } else {
        return columnKey;
      }
    },
    [theme, handleDeleteModelRequest, openEditModel]
  );

  return (
    <>
      <div className="flex justify-between gap-3 items-end">
        <Input
          isClearable
          className="w-full sm:max-w-[44%]"
          placeholder={t('settings.providers.searchModels')}
          value={searchQuery}
          onValueChange={handleSearchValueChange}
          onClear={() => setSearchQuery('')}
        />
        <div className="flex gap-3">
          <Button
            color="primary"
            startContent={<Icon size={18} icon="plus" />}
            onPress={onAddModelOpen}
          >
            {t('settings.providers.newModel')}
          </Button>
          <ButtonGroup>
            {showSyncedButton && (
              <Tooltip content={t('settings.providers.syncModels')} delay={500}>
                <Button
                  isIconOnly
                  isLoading={discovering}
                  isDisabled={discovering}
                  onPress={handleDiscover}
                >
                  <Icon icon="cloud" />
                </Button>
              </Tooltip>
            )}
            <Tooltip content={t('settings.providers.cleanModels')} delay={500}>
              <Button
                isIconOnly
                variant="ghost"
                isLoading={discovering}
                isDisabled={discovering}
                onPress={handleCleanModels}
              >
                <Icon icon="cleaning-services" />
              </Button>
            </Tooltip>
          </ButtonGroup>
        </div>
      </div>
      <Modal isOpen={isAddModelOpen} onOpenChange={onAddModelOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {t('settings.providers.addModel')}
              </ModalHeader>
              <ModalBody>
                <ModelCreateForm
                  formRef={addFormRef}
                  formData={addFormData}
                  setFormData={(newFormData) => {
                    const changedKeys = Object.keys(newFormData) as (keyof typeof newFormData)[];
                    setAddFormData(newFormData);
                    setAddModelErrors((prevErrors) => {
                      const updatedErrors = { ...prevErrors };
                      changedKeys.forEach((key) => {
                        if (addFormData[key] !== newFormData[key]) {
                          updatedErrors[key] = undefined;
                        }
                      });
                      return updatedErrors;
                    });
                  }}
                  errors={addModelErrors}
                />
              </ModalBody>
              <ModalFooter>
                <Button
                  color="danger"
                  variant="light"
                  onPress={() => handleAddModelCancel(onClose)}
                >
                  {t('common.cancel')}
                </Button>
                <Button color="primary" onPress={() => void handleAddModel()}>
                  {t('common.create')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      <Modal isOpen={isEditModelOpen} onOpenChange={onEditModelOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {t('settings.providers.editModel')}
              </ModalHeader>
              <ModalBody>
                <ModelEditForm
                  formRef={editFormRef}
                  formData={editFormData}
                  onEditModel={setEditFormData}
                  errors={editModelErrors}
                />
              </ModalBody>
              <ModalFooter>
                <Button
                  color="danger"
                  variant="light"
                  onPress={() => handleEditModelCancel(onClose)}
                >
                  {t('common.cancel')}
                </Button>
                <Button color="primary" onPress={() => void handleEditModel()}>
                  {t('common.confirm')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      <Modal isOpen={isDeleteModelOpen} onOpenChange={onDeleteModelOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                {t('settings.providers.deleteModel')}
              </ModalHeader>
              <ModalBody>
                <div
                  dangerouslySetInnerHTML={{
                    __html: t('settings.providers.deleteModelConfirm', {
                      modelName: deleteModelName,
                    }),
                  }}
                />
              </ModalBody>
              <ModalFooter>
                <Button
                  color="default"
                  variant="light"
                  onPress={() => handleDeleteModelCancel(onClose)}
                >
                  {t('common.cancel')}
                </Button>
                <Button color="danger" onPress={() => void handleDeleteModelConfirm()}>
                  {t('common.delete')}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      <Table aria-label="LLM Models">
        <TableHeader columns={columns}>
          {(column) => (
            <TableColumn key={column.uid} align={column.uid === 'actions' ? 'center' : 'start'}>
              {column.name}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody emptyContent={'No models.'} items={filteredModels}>
          {(model) => (
            <TableRow key={model.id}>
              {(columnKey: string) => <TableCell>{renderCell(model, columnKey)}</TableCell>}
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  );
}

export default ModelTable;
