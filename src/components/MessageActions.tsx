import { ReactNode } from 'react';

interface MessageActionsProps {
  children: ReactNode;
  className?: string;
}

export default function MessageActions({ children, className = '' }: MessageActionsProps) {
  return (
    <div
      role="toolbar"
      aria-label="Message actions"
      className={`flex flex-row items-center gap-0.5 mt-1 ${className}`.trim()}
    >
      {children}
    </div>
  );
}
