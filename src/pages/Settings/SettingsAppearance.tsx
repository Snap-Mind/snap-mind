import { Divider, Radio, RadioGroup } from '@heroui/react';
import { useTranslation } from 'react-i18next';

import { SettingsChangeHandler } from '@/types';
import { AppearanceSetting } from '@/types/setting';
import Icon from '@/components/Icon';

interface SettingsAppearanceProps {
  settings: AppearanceSetting;
  onSettingsChange: SettingsChangeHandler;
}

function SettingsAppearance({ settings, onSettingsChange }: SettingsAppearanceProps) {
  const { t } = useTranslation();

  const handleThemeChange = async (value: string) => {
    const nextTheme = value as 'light' | 'dark' | 'auto';
    await onSettingsChange(['appearance', 'theme'], nextTheme);
  };

  return (
    <div className="container grid grid-cols-1 grid-rows-[65px_1fr] h-full">
      <div className="header">
        <h1 className="font-bold text-2xl">{t('settings.appearance.title')}</h1>
        <Divider className="my-4" />
      </div>
      <div className="body overflow-y-auto">
        <label className="block text-sm font-medium mb-2">
          {t('settings.appearance.themeMode')}
        </label>
        <RadioGroup
          defaultValue={settings.theme || 'auto'}
          onValueChange={handleThemeChange}
          className="w-full"
          classNames={{
            wrapper: 'grid grid-cols-1 md:grid-cols-3 gap-3',
          }}
        >
          <Radio
            value="light"
            classNames={{
              base: 'm-0 data-[selected=true]:border-primary border-2 border-default rounded-large px-3 py-3 max-w-full',
              wrapper: 'hidden',
              labelWrapper: 'ml-0',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-default-100 p-2">
                <Icon icon="sun" size={16} />
              </div>
              <div>
                <div className="font-medium">{t('settings.appearance.options.light')}</div>
                <div className="text-tiny text-default-500">
                  {t('settings.appearance.hints.light')}
                </div>
              </div>
            </div>
          </Radio>
          <Radio
            value="dark"
            classNames={{
              base: 'm-0 data-[selected=true]:border-primary border-2 border-default rounded-large px-3 py-3 max-w-full',
              wrapper: 'hidden',
              labelWrapper: 'ml-0',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-default-100 p-2">
                <Icon icon="moon" size={16} />
              </div>
              <div>
                <div className="font-medium">{t('settings.appearance.options.dark')}</div>
                <div className="text-tiny text-default-500">
                  {t('settings.appearance.hints.dark')}
                </div>
              </div>
            </div>
          </Radio>
          <Radio
            value="auto"
            classNames={{
              base: 'm-0 data-[selected=true]:border-primary border-2 border-default rounded-large px-3 py-3 max-w-full',
              wrapper: 'hidden',
              labelWrapper: 'ml-0',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-default-100 p-2">
                <Icon icon="monitor" size={16} />
              </div>
              <div>
                <div className="font-medium">{t('settings.appearance.options.auto')}</div>
                <div className="text-tiny text-default-500">
                  {t('settings.appearance.hints.auto')}
                </div>
              </div>
            </div>
          </Radio>
        </RadioGroup>
      </div>
    </div>
  );
}

export default SettingsAppearance;
