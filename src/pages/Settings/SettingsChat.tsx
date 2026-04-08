import { useState, useEffect } from 'react';
import { Slider } from '@heroui/react';
import { Divider } from '@heroui/react';
import BooleanInput from '../../components/BooleanInput';
import { SettingsChangeHandler } from '@/types';
import { ChatSetting } from '@/types/setting';
import { useTranslation } from 'react-i18next';

interface SettingsChatProps {
  settings: ChatSetting;
  onSettingsChange: SettingsChangeHandler;
}

function SettingsChat({ settings, onSettingsChange }: SettingsChatProps) {
  const { t } = useTranslation();
  const [reasoningEnabled, setReasoningEnabled] = useState(settings.reasoningEnabled ?? false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(settings.webSearchEnabled ?? false);

  // Sync local state when settings change externally (e.g. from ChatPopup window)
  useEffect(() => {
    setReasoningEnabled(settings.reasoningEnabled ?? false);
    setWebSearchEnabled(settings.webSearchEnabled ?? false);
  }, [settings]); // Note: using `settings` (not `settings.reasoningEnabled`) as the dependency keeps settings in sync across different windows.

  return (
    <div className="grid grid-cols-1 grid-rows-[65px_1fr] w-full min-w-0 h-full">
      <div className="header">
        <h1 className="font-bold text-2xl">{t('settings.chat.title')}</h1>
        <Divider className="my-4" />
      </div>
      <div className="body min-w-0 overflow-y-auto flex flex-col gap-4 max-w-[calc(100%_-_theme(spacing.3))]">
        <Slider
          className="max-w-full"
          defaultValue={settings.max_tokens}
          label={t('settings.chat.maxTokens')}
          minValue={1}
          maxValue={16000}
          step={1}
          size="sm"
          marks={[
            { value: 2400, label: '2.4k' },
            {
              value: 4000,
              label: '4k',
            },
            {
              value: 8000,
              label: '8k',
            },
            {
              value: 14000,
              label: '14k',
            },
          ]}
          onChange={(value) => onSettingsChange(['chat', 'max_tokens'], value as number)}
        />

        <Slider
          className="max-w-full"
          defaultValue={settings.temperature}
          label={t('settings.chat.temperature')}
          minValue={0}
          maxValue={1}
          step={0.01}
          size="sm"
          onChange={(value) => onSettingsChange(['chat', 'temperature'], value as number)}
        />

        <Slider
          className="max-w-full"
          defaultValue={settings.top_p}
          label={t('settings.chat.topP')}
          minValue={0.1}
          maxValue={1}
          step={0.01}
          size="sm"
          onChange={(value) => onSettingsChange(['chat', 'top_p'], value as number)}
        />

        <BooleanInput
          id="streaming"
          label={t('settings.chat.streaming')}
          description={t('settings.chat.streamingDescription')}
          defaultSelected={settings.streamingEnabled}
          onValueChange={(checked) => onSettingsChange(['chat', 'streamingEnabled'], checked)}
        />

        <BooleanInput
          id="webSearch"
          label={t('settings.chat.webSearch')}
          description={t('settings.chat.webSearchDescription')}
          isSelected={webSearchEnabled}
          onValueChange={(checked) => {
            setWebSearchEnabled(checked);
            onSettingsChange(['chat', 'webSearchEnabled'], checked);
          }}
        />

        <BooleanInput
          id="reasoning"
          label={t('settings.chat.reasoning')}
          description={t('settings.chat.reasoningDescription')}
          isSelected={reasoningEnabled}
          onValueChange={(checked) => {
            setReasoningEnabled(checked);
            onSettingsChange(['chat', 'reasoningEnabled'], checked);
          }}
        />
      </div>
    </div>
  );
}

export default SettingsChat;
