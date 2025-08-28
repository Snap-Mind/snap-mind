import { Divider } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import BooleanInput from '../../components/BooleanInput';
import { LanguageSelector } from '../../components/LanguageSelector';

import { SettingsChangeHandler } from '@/types';
import { GeneralSetting } from '@/types/setting';

export interface SettingsGeneralProps {
  settings: GeneralSetting;
  onSettingsChange: SettingsChangeHandler;
}

function SettingsGeneral({ settings, onSettingsChange }: SettingsGeneralProps) {
  const { t } = useTranslation();

  return (
    <div className="container grid grid-cols-1 grid-rows-[65px_1fr] h-full">
      <div className="header">
        <h1 className="font-bold text-2xl">{t('settings.general.title')}</h1>
        <Divider className="my-4" />
      </div>
      <div className="body overflow-y-auto">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            {t('settings.general.language')}
          </label>
          <LanguageSelector  />
        </div>
        <BooleanInput
          id="clipboard"
          label={t("settings.general.clipboardFallback")}
          description={t("settings.general.clipboardFallbackDescription")}
          defaultSelected={settings.clipboardEnabled}
          onValueChange={(value) => onSettingsChange(['general', 'clipboardEnabled'], value)}
        />
      </div>
    </div>
  );
}

export default SettingsGeneral;
