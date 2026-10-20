import { Switch, type SwitchProps } from '@heroui/react';

interface BooleanInputProps extends SwitchProps {
  id: string;
  label: string;
  description?: string;
  wrapperClassName?: string;
}

function BooleanInput({
  id,
  label,
  description,
  wrapperClassName = '',
  ...switchProps
}: BooleanInputProps) {
  return (
    <div className={`flex items-center justify-between ${wrapperClassName}`}>
      <div className="space-y-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      <Switch id={id} {...switchProps} />
    </div>
  );
}

export default BooleanInput;
