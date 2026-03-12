import { useSwitch, VisuallyHidden } from '@heroui/react';
import Icon from './Icon';

interface ReasoningToggleProps {
  isSelected: boolean;
  onValueChange: (checked: boolean) => void;
}

export default function ReasoningToggle(props: ReasoningToggleProps) {
   const {Component, slots, isSelected, getBaseProps, getInputProps, getWrapperProps} =
    useSwitch(props);

  return (
    <div className="flex flex-col gap-2">
      <Component {...getBaseProps()}>
        <VisuallyHidden>
          <input {...getInputProps()} />
        </VisuallyHidden>
        <div
          {...getWrapperProps()}
          className={slots.wrapper({
            class: [
              "w-8 h-8",
              "flex items-center justify-center",
              "rounded-lg bg-default-100 hover:bg-default-200",
            ],
          })}
        >
          {isSelected ? <Icon icon='lightbulb' /> : <Icon icon='lightbulb-off' />}
        </div>
      </Component>
    </div>
  );
}
