import { useState, type ReactNode } from 'react';
import Icon from '@/components/Icon';

interface Props {
  title: ReactNode;
  ariaLabel?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function Expand({ title, ariaLabel, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const label = ariaLabel ?? (typeof title === 'string' ? title : undefined);

  return (
    <div className="py-0.5 text-default-500">
      <button
        type="button"
        className="inline-flex max-w-full cursor-pointer items-center gap-0.5 rounded-sm text-sm font-medium text-default-500"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">{title}</span>
        <Icon
          icon="chevron-right"
          size={14}
          className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open ? <div className="mt-1 text-default-500">{children}</div> : null}
    </div>
  );
}
