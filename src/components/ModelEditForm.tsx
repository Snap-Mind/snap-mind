import { Capability, ModelType } from '@/types/setting';
import { Input, Select, SelectItem } from '@heroui/react';
import { FormEvent, Ref } from 'react';

interface FormData {
  id: string;
  name: string;
  type: ModelType;
  description: string;
  capabilities: Capability[];
}

interface ModelEditFormProps {
  formRef: Ref<HTMLFormElement>;
  formData: FormData;
  onEditModel: (formData: FormData) => void;
  errors?: Partial<Record<keyof FormData, string>>;
}

const MODEL_TYPE_OPTIONS: ModelType[] = [
  'chat' /* 'image', 'embedding', 'tool', 'code', 'vision'*/,
];
const CAPABILITY_OPTIONS: Capability[] = [
  'chat',
  // 'image-generation',
  // 'image-editing',
  // 'vision',
  // 'websearch',
  // 'reasoning',
  // 'code-generation',
  // 'translation',
  // 'embedding',
  // 'summarization',
  // 'classification',
  // 'ocr',
  // 'speech',
  // 'tool-use',
  // 'multi-modal',
];

export function ModelEditForm({ formRef, formData, onEditModel, errors = {} }: ModelEditFormProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onEditModel({ ...formData, [name]: value });
  };

  return (
    <form ref={formRef} onSubmit={(e: FormEvent) => e.preventDefault()}>
      <Input
        className="mb-4"
        label="id"
        placeholder="Model id"
        name="id"
        value={formData.id}
        onChange={handleChange}
        isRequired
        isReadOnly
        isDisabled
        isInvalid={!!errors.id}
        errorMessage={errors.id}
      />
      <Input
        className="mb-4"
        label="name"
        placeholder="Model name"
        name="name"
        value={formData.name}
        onChange={handleChange}
        isRequired
        isInvalid={!!errors.name}
        errorMessage={errors.name}
      />
      <Select
        className="mb-4"
        label="type"
        name="type"
        defaultSelectedKeys={['chat']}
        onChange={handleChange}
        isRequired
        disallowEmptySelection
        isInvalid={!!errors.type}
        errorMessage={errors.type}
      >
        {MODEL_TYPE_OPTIONS.map((type: ModelType) => (
          <SelectItem key={type}>{type}</SelectItem>
        ))}
      </Select>
      <Select
        className="mb-4"
        label="capabilities"
        name="capabilities"
        defaultSelectedKeys={['chat']}
        onChange={handleChange}
        isRequired
        disallowEmptySelection
        isInvalid={!!errors.capabilities}
        errorMessage={errors.capabilities}
      >
        {CAPABILITY_OPTIONS.map((cap: Capability) => (
          <SelectItem key={cap}>{cap}</SelectItem>
        ))}
      </Select>
      <Input
        className="mb-4"
        label="description"
        placeholder="Model description"
        name="description"
        value={formData.description}
        onChange={handleChange}
        isInvalid={!!errors.description}
        errorMessage={errors.description}
      />
    </form>
  );
}
