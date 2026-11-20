import { useTranslation } from 'react-i18next';
import LogoSvg from '@/components/LogoSvg';

export default function AiLoadingIndicator() {
  const { t } = useTranslation();
  const label = t('chat.generating', 'Generating');

  return (
    <div
      className="flex items-center gap-3 py-2"
      role="status"
      aria-label={label}
      aria-live="polite"
    >
      <div className="relative h-10 w-10 shrink-0">
        <span
          className="snap-mind-loading-orbit pointer-events-none absolute inset-0 rounded-full border border-primary/25 border-t-primary"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute inset-1 rounded-full bg-primary/15 blur-sm"
          aria-hidden
        />
        <LogoSvg className="snap-mind-loading-mark relative z-10 m-1.5 h-7 w-7 text-primary" />
      </div>
      <span className="text-sm text-default-500">{label}</span>
    </div>
  );
}
