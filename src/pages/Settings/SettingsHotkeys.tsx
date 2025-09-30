import React, { useState } from 'react';
import { HotkeysChangeHandler } from '@/types';
import { Hotkey } from '@/types/setting';
import {
  Alert,
  Card,
  CardHeader,
  CardBody,
  Switch,
  Kbd,
  Textarea,
  Divider,
  KbdKey,
} from '@heroui/react';
import { useTranslation } from 'react-i18next';
import HotkeyPickerModal from '@/components/HotkeyPickerModal';
import Icon from '@/components/Icon';

interface SettingsHotkeysProps {
  hotkeys: Hotkey[];
  onHotkeysChange: HotkeysChangeHandler;
}

const renderHotkeyKey = (key: string) => {
  const isMac = /mac/i.test(navigator.userAgent);
  const keys = key.split('+');
  const modifiers: KbdKey[] = keys.slice(0, -1).map((k) => {
    if (k == 'CommandOrControl') {
      k = isMac ? 'command' : 'ctrl';
    }
    return k.toLowerCase() as KbdKey;
  });
  const mainKey = keys[keys.length - 1];

  if (isMac) {
    return <Kbd keys={modifiers}> {mainKey}</Kbd>;
  } else {
    return (
      <div className="font-bold">
        {modifiers.map((k) => k.charAt(0).toUpperCase() + k.slice(1)).join(' + ') + ' + ' + mainKey}
      </div>
    );
  }
};

function SettingsHotkeys({ hotkeys, onHotkeysChange }: SettingsHotkeysProps) {
  const { t } = useTranslation();
  const title = t('settings.hotkeys.custom');
  const description = t('settings.hotkeys.customDescription');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const closeModal = () => setEditingIndex(null);
  const handleConfirm = async (val: string) => {
    if (editingIndex != null) {
      await onHotkeysChange([editingIndex, 'key'], val);
      closeModal();
    }
  };

  return (
    <div className="container grid grid-cols-1 grid-rows-[65px_1fr] h-full">
      <div className="header">
        <h1 className="font-bold text-2xl">{t('settings.hotkeys.title')}</h1>
        <Divider className="my-4" />
      </div>
      <div className="body overflow-y-auto">
        <div className="flex items-center justify-center w-full">
          <Alert description={description} title={title} />
        </div>
        {hotkeys.map((hotkey, index) => (
          <Card key={index} className="w-full my-5 border-1 border-gray-100" shadow="none">
            <CardHeader className="flex gap-3 justify-between">
              <h4>
                {hotkey.id === 0
                  ? t('common.default')
                  : `${t('settings.hotkeys.shortcut')} ${index}`}
              </h4>
              <Switch
                size="sm"
                defaultSelected={hotkey.enabled}
                onValueChange={(value) => onHotkeysChange([index, 'enabled'], value)}
              >
                {t('common.enabled')}
              </Switch>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              {hotkey.id === 0 ? (
                <>
                  <div>{renderHotkeyKey(hotkey.key)}</div>
                  <Card shadow="none" isHoverable={true}>
                    <CardBody>
                      <p>{t('settings.hotkeys.defaultDescription')}</p>
                    </CardBody>
                  </Card>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    {renderHotkeyKey(hotkey.key)}
                    <Icon
                      className="cursor-pointer hover:text-default-500"
                      icon="settings"
                      size={14}
                      onClick={() => setEditingIndex(index)}
                    ></Icon>
                  </div>
                  <Textarea
                    label="Prompt"
                    placeholder={t('settings.hotkeys.promptPlaceholder', 'Enter your prompt')}
                    defaultValue={hotkey.prompt}
                    onValueChange={(value) => onHotkeysChange([index, 'prompt'], value)}
                  />
                </>
              )}
            </CardBody>
          </Card>
        ))}
        <HotkeyPickerModal
          isOpen={editingIndex != null}
          initialValue={editingIndex != null ? hotkeys[editingIndex].key : null}
          onCancel={closeModal}
          onConfirm={handleConfirm}
          title={t('settings.hotkeys.modalTitle', 'Set Hotkey')}
        />
      </div>
    </div>
  );
}

export default SettingsHotkeys;
