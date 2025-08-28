import { Input } from '@heroui/react';
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

export function ModelCreateForm({ formRef, formData, setFormData }: ModelCreateFormProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        required
      />
      <Input
        className="mb-4"
        label="name"
        placeholder="Model name"
        name="name"
        value={formData.name}
        onChange={handleChange}
        required
      />
      <Input
        className="mb-4"
        label="type"
        placeholder="Model type"
        name="type"
        value={formData.type}
        onChange={handleChange}
        required
      />
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
