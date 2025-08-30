import { ModelType } from '@/types/setting';
import { Input, Select, SelectItem } from '@heroui/react';
import { FormEvent, Ref } from 'react';

interface FormData {
  id: string;
  name: string;
  type: string;
  description: string;
}

interface ModelCreateFormProps {
  formRef: Ref<HTMLFormElement>;
  formData: FormData;
  setFormData: (formData: FormData) => void;
}

const MODEL_TYPE_OPTIONS: ModelType[] = ['chat'];

export function ModelCreateForm({ formRef, formData, setFormData }: ModelCreateFormProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
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
      />
      <Input
        className="mb-4"
        label="name"
        placeholder="Model name"
        name="name"
        value={formData.name}
        onChange={handleChange}
        isRequired
      />
      <Select
        className="mb-4"
        label="type"
        name="type"
        defaultSelectedKeys={['chat']}
        onChange={handleChange}
        isRequired
        disallowEmptySelection
      >
        {MODEL_TYPE_OPTIONS.map((type: ModelType) => (
          <SelectItem key={type}>{type}</SelectItem>
        ))}
      </Select>
      <Input
        className="mb-4"
        label="description"
        placeholder="Model description"
        name="description"
        value={formData.description}
        onChange={handleChange}
      />
    </form>
  );
}
