import { useCallback, useEffect, useState, useRef } from 'react';
import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from '@heroui/react';
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@heroui/table';
import { semanticColors } from '@heroui/theme';
import { useTheme } from '@heroui/use-theme';

import Icon from './Icon';
import { ModelCreateForm } from './ModelCreateForm';
import { ModelSetting } from '@/types/setting';
import { ModelEditForm } from './ModelEditForm';
import { useTranslation } from 'react-i18next';

interface Column {
  name: string;
  uid: string;
}

interface ModelTableProps {
  models: ModelSetting[];
  onModelsChange: (models: ModelSetting[]) => void;
}

const initialFormData: ModelSetting = {
  id: '',
  name: '',
  type: '',
  description: '',
};

function ModelTable({ models, onModelsChange }: ModelTableProps) {
  const { t } = useTranslation();
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
  const [localModels, setLocalModels] = useState<ModelSetting[]>(models);
  const [addFormData, setAddFormData] = useState<ModelSetting>(initialFormData);
  const [editFormData, setEditFormData] = useState<ModelSetting>();
  const [searchQuery, setSearchQuery] = useState('');
  const addFormRef = useRef<HTMLFormElement>(null);
  const editFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setLocalModels(models);
  }, [models]);

  const handleAddModel = () => {
    if (addFormRef.current && addFormRef.current.checkValidity()) {
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
      const updatedModels = localModels.map((model) =>
        model.id === editFormData.id ? editFormData : model
      );
      setLocalModels(updatedModels);
      onModelsChange(updatedModels);
      setEditFormData(undefined);
      onEditModelOpenChange();
    } else {
      addFormRef.current?.reportValidity();
    }
  };

  const handleDeleteModel = useCallback(
    (id: string) => {
      setLocalModels((prevModels) => {
        const updatedModels = prevModels.filter((model) => model.id !== id);
        onModelsChange(updatedModels);
        return updatedModels;
      });
    },
    [onModelsChange]
  );

  const openEditModel = useCallback(
    (model: ModelSetting) => {
      setEditFormData({ ...model });
      onEditModelOpen();
    },
    [onEditModelOpen]
  );

  const handleAddModelCancel = (onClose) => {
    setAddFormData(initialFormData);
    onClose();
  };

  const handleEditModelCancel = (onClose) => {
    setEditFormData(undefined);
    onClose();
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
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
              onClick={() => handleDeleteModel(model.id)}
            />
          </span>
        );
      } else {
        return columnKey;
      }
    },
    [theme, handleDeleteModel]
  );

  return (
    <>
      <div className="flex justify-between gap-3 items-end">
        <Input
          isClearable
          className="w-full sm:max-w-[44%]"
          placeholder={t('settings.providers.searchModels')}
          value={searchQuery}
          onChange={handleSearchChange}
        />
        <div className="flex gap-3">
          <Button startContent={<Icon size={18} icon="plus" />} onPress={onAddModelOpen}>
            {t('settings.providers.newModel')}
          </Button>
        </div>
      </div>
      <Modal isOpen={isAddModelOpen} onOpenChange={onAddModelOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">{t('settings.providers.addModel')}</ModalHeader>
              <ModalBody>
                <ModelCreateForm
                  formRef={addFormRef}
                  formData={addFormData}
                  setFormData={setAddFormData}
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
              <ModalHeader className="flex flex-col gap-1">{t('settings.providers.editModel')}</ModalHeader>
              <ModalBody>
                <ModelEditForm
                  formRef={editFormRef}
                  formData={editFormData}
                  onEditModel={setEditFormData}
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
