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
import { ModelSetting } from '@/types/setting';
import { ModelEditForm } from './ModelEditForm';
import { useTranslation } from 'react-i18next';
import ProviderFactory from '@/services/providers/ProviderFactory';
import { useLogService } from '@/hooks/useLogService';
import { BaseProviderConfig } from '@/types/providers';

interface Column {
  name: string;
  uid: string;
}

interface ModelTableProps {
  providerConfig: BaseProviderConfig;
  onModelsChange: (models: ModelSetting[]) => void;
  showSyncedButton?: boolean;
}

const initialFormData: ModelSetting = {
  id: '',
  name: '',
  type: 'chat',
  capabilities: ['chat'],
  description: '',
};

function ModelTable({ providerConfig, onModelsChange, showSyncedButton = false }: ModelTableProps) {
  const { t } = useTranslation();
  const logger = useLogService();
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
  const [localModels, setLocalModels] = useState<ModelSetting[]>([...providerConfig.models]);
  const [addFormData, setAddFormData] = useState<ModelSetting>(initialFormData);
  const [editFormData, setEditFormData] = useState<ModelSetting>();
  const [searchQuery, setSearchQuery] = useState('');
  const addFormRef = useRef<HTMLFormElement>(null);
  const editFormRef = useRef<HTMLFormElement>(null);
  const [deleteModelId, setDeleteModelId] = useState<string | null>(null);
  const [deleteModelName, setDeleteModelName] = useState<string>('');
  const [addModelErrors, setAddModelErrors] = useState<Partial<Record<keyof ModelSetting, string>>>(
    {}
  );
  const [editModelErrors, setEditModelErrors] = useState<
    Partial<Record<keyof ModelSetting, string>>
  >({});

  useEffect(() => {
    setLocalModels([...providerConfig.models]);
  }, [providerConfig.models]);

  const handleAddModel = () => {
    if (addFormRef.current && addFormRef.current.checkValidity()) {
      const errors: Partial<Record<keyof ModelSetting, string>> = {};
      const isDuplicate = localModels.some((model) => model.id === addFormData.id);
      if (isDuplicate) {
        errors.id = 'Model id already exists. Please use a unique id.';
        setAddModelErrors(errors);
        return;
      }
      setAddModelErrors({});
      const updatedModels = [...localModels, addFormData];
      setLocalModels(updatedModels);
      onModelsChange(updatedModels);
      setAddFormData(initialFormData);
      onAddModelOpenChange();
    } else {
      addFormRef.current?.reportValidity();
    }
  };

  const handleEditModel = () => {
    if (editFormRef.current && editFormRef.current.checkValidity()) {
      setEditModelErrors({});
      const updatedModels = localModels.map((model) =>
        model.id === editFormData.id ? editFormData : model
      );
      setLocalModels(updatedModels);
      onModelsChange(updatedModels);
      setEditFormData(undefined);
      onEditModelOpenChange();
    } else {
      editFormRef.current?.reportValidity();
    }
  };

  const handleDeleteModelRequest = useCallback(
    (id: string, name: string) => {
      setDeleteModelId(id);
      setDeleteModelName(name);
      onDeleteModelOpen();
    },
    [onDeleteModelOpen]
  );

  const handleDeleteModelConfirm = useCallback(() => {
    if (deleteModelId) {
      setLocalModels((prevModels) => {
        const updatedModels = prevModels.filter((model) => model.id !== deleteModelId);
        onModelsChange(updatedModels);
        return updatedModels;
      });
      setDeleteModelId(null);
      setDeleteModelName('');
      onDeleteModelOpenChange();
    }
  }, [deleteModelId, onModelsChange, onDeleteModelOpenChange]);

  // Cancel deletion
  const handleDeleteModelCancel = useCallback((onClose) => {
    setDeleteModelId(null);
    setDeleteModelName('');
    onClose();
  }, []);

  const openEditModel = useCallback(
    (model: ModelSetting) => {
      setEditFormData({ ...model });
      onEditModelOpen();
    },
    [onEditModelOpen]
  );

  const handleAddModelCancel = (onClose) => {
    setAddFormData(initialFormData);
    setAddModelErrors({});
    onClose();
  };

  const handleEditModelCancel = (onClose) => {
    setEditFormData(undefined);
    setEditModelErrors({});
    onClose();
  };

  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const provider = ProviderFactory.createProvider(providerConfig);
      const syncedModels = await provider.listModels();
      if (Array.isArray(syncedModels) && syncedModels.length > 0) {
        onModelsChange(syncedModels);
        setLocalModels(syncedModels);
      }
    } catch (e) {
      logger.error(`[${providerConfig.id}] auto discover failed:`, e);
    } finally {
      setDiscovering(false);
    }
  };

  const handleCleanModels = async () => {
    setDiscovering(true);
    try {
      onModelsChange([]);
      setLocalModels([]);
    } catch (e) {
      logger.error(`[${providerConfig.id}] clean models failed:`, e);
    } finally {
      setDiscovering(false);
    }
  };

  // Use HeroUI controlled pattern so clear button works reliably
  const handleSearchValueChange = (value: string) => {
    setSearchQuery(value);
  };

  const filteredModels = localModels.filter((model) =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderCell = useCallback(
    (model: ModelSetting, columnKey: string) => {
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
                <Button color="primary" onPress={handleAddModel}>
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
                <Button color="primary" onPress={handleEditModel}>
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
                <Button color="danger" onPress={handleDeleteModelConfirm}>
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
