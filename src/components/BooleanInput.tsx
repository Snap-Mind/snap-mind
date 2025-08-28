import { Switch } from '@heroui/react';

interface BooleanInputProps {
  id: string;
  label: string;
  description?: string;
  defaultSelected: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  className?: string;
}

function BooleanInput({
  id,
  label,
  description,
  defaultSelected,
  onValueChange,
  disabled = false,
  className = '',
}: BooleanInputProps) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="space-y-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      <Switch
        id={id}
        defaultSelected={defaultSelected}
        onValueChange={onValueChange}
        disabled={disabled}
      />
    </div>
  );
}

export default BooleanInput;
