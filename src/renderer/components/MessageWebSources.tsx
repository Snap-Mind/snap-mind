import { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerBody } from '@heroui/drawer';
import { LuGlobe, LuExternalLink } from 'react-icons/lu';
import { useTranslation } from 'react-i18next';
import { ChatSource } from '@/types/chat';

interface MessageWebSourcesProps {
  sources: ChatSource[];
}

function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

const PILL_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-cyan-500',
];

function colorForIndex(i: number): string {
  return PILL_COLORS[i % PILL_COLORS.length];
}

function openUrl(url: string) {
  if (window.electronAPI?.openExternalUrl) {
    window.electronAPI.openExternalUrl(url);
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

export default function MessageWebSources({ sources }: MessageWebSourcesProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  if (!sources || sources.length === 0) return null;

  const uniqueHosts = [...new Set(sources.map((s) => extractHostname(s.url)))];
  const previewCount = Math.min(uniqueHosts.length, 3);

  return (
    <>
      {/* Pill trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                   bg-default-100 hover:bg-default-200 transition-colors
                   text-xs text-default-600 cursor-pointer select-none"
        aria-label={t('chat.sources')}
      >
        {/* Stacked host indicators */}
        <span className="flex -space-x-1.5">
          {uniqueHosts.slice(0, previewCount).map((host, i) => (
            <span
              key={host}
              className={`inline-flex items-center justify-center w-4 h-4 rounded-full
                         ring-1 ring-background text-[8px] font-bold text-white
                         ${colorForIndex(i)}`}
              title={host}
            >
              {host.charAt(0).toUpperCase()}
            </span>
          ))}
        </span>
        <span className="font-medium">
          {t('chat.sources')} · {sources.length}
        </span>
      </button>

      {/* Sources drawer */}
      <Drawer isOpen={isOpen} onClose={() => setIsOpen(false)} placement="right" size="sm">
        <DrawerContent>
          <DrawerHeader className="flex items-center gap-2 text-base font-semibold">
            <LuGlobe size={16} />
            {t('chat.sources')}
          </DrawerHeader>
          <DrawerBody className="px-4 pb-6">
            <ul className="flex flex-col gap-2">
              {sources.map((source, i) => {
                const host = extractHostname(source.url);
                return (
                  <li key={`${source.url}-${i}`}>
                    <button
                      type="button"
                      onClick={() => openUrl(source.url)}
                      className="w-full text-left flex items-start gap-3 p-3 rounded-xl
                                 bg-default-50 hover:bg-default-100 transition-colors
                                 cursor-pointer group"
                    >
                      <span
                        className={`mt-0.5 flex-shrink-0 inline-flex items-center justify-center
                                    w-6 h-6 rounded-lg text-[10px] font-bold text-white
                                    ${colorForIndex(i)}`}
                      >
                        {host.charAt(0).toUpperCase()}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-foreground truncate">
                          {source.title || host}
                        </span>
                        <span className="block text-xs text-default-400 truncate">{host}</span>
                      </span>
                      <LuExternalLink
                        size={14}
                        className="mt-1 flex-shrink-0 text-default-300 group-hover:text-default-500 transition-colors"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
