import { useState } from 'react';
import {
  Alert,
  Card,
  CardHeader,
  CardBody,
  Switch,
  Kbd,
  Select,
  SelectItem,
  Divider,
  KbdKey,
} from '@heroui/react';
import { useTranslation } from 'react-i18next';

import HotkeyPickerModal from '@/components/HotkeyPickerModal';
import Icon from '@/components/Icon';
import { useHotkeysStore } from '@/stores/useHotkeysStore';
import { useAgentsStore } from '@/stores/useAgentsStore';

const renderHotkeyKey = (accelerator: string) => {
  const isMac = /mac/i.test(navigator.userAgent);
  const keys = accelerator.split('+');
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

function SettingsHotkeys() {
  const { t } = useTranslation();
  const hotkeys = useHotkeysStore((s) => s.hotkeys);
  const updateHotkey = useHotkeysStore((s) => s.updateHotkey);
  const agents = useAgentsStore((s) => s.agents);
  const [editingId, setEditingId] = useState<number | null>(null);

  const editing = hotkeys.find((h) => h.id === editingId) ?? null;
  const closeModal = () => setEditingId(null);

  const handleConfirm = async (val: string) => {
    if (editingId != null) {
      await updateHotkey(editingId, { accelerator: val });
      closeModal();
    }
  };

  return (
    <div className="grid grid-cols-1 grid-rows-[65px_1fr] w-full min-w-0 h-full">
      <div className="header">
        <h1 className="font-bold text-2xl">{t('settings.hotkeys.title')}</h1>
        <Divider className="my-4" />
      </div>
      <div className="body min-w-0 overflow-y-auto">
        <div className="flex items-center justify-center w-full">
          <Alert
            hideIconWrapper
            description={t('settings.hotkeys.customDescription')}
            title={t('settings.hotkeys.custom')}
          />
        </div>
        {hotkeys.map((hotkey, index) => (
          <Card key={hotkey.id} className="w-full my-5 border-1 border-gray-100" shadow="none">
            <CardHeader className="flex gap-3 justify-between">
              <h4>
                {hotkey.mode === 'chat'
                  ? t('common.default')
                  : `${t('settings.hotkeys.shortcut')} ${index}`}
              </h4>
              <Switch
                size="sm"
                isSelected={hotkey.enabled}
                isDisabled={hotkey.agentId == null}
                onValueChange={(value) => void updateHotkey(hotkey.id, { enabled: value })}
              >
                {t('common.enabled')}
              </Switch>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                {renderHotkeyKey(hotkey.accelerator)}
                <Icon
                  className="cursor-pointer hover:text-default-500"
                  icon="settings"
                  size={14}
                  onClick={() => setEditingId(hotkey.id)}
                ></Icon>
              </div>
              {hotkey.mode === 'chat' && (
                <Card shadow="none" isHoverable={true}>
                  <CardBody>
                    <p>{t('settings.hotkeys.defaultDescription')}</p>
                  </CardBody>
                </Card>
              )}
              <Select
                label={t('settings.hotkeys.agent')}
                selectedKeys={hotkey.agentId != null ? [String(hotkey.agentId)] : []}
                description={
                  hotkey.agentId == null ? t('settings.hotkeys.assignAgentToEnable') : undefined
                }
                onChange={(e) =>
                  void updateHotkey(hotkey.id, {
                    agentId: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                {agents.map((agent) => (
                  <SelectItem key={String(agent.id)}>{agent.name}</SelectItem>
                ))}
              </Select>
            </CardBody>
          </Card>
        ))}
        <HotkeyPickerModal
          isOpen={editing != null}
          initialValue={editing?.accelerator ?? null}
          onCancel={closeModal}
          onConfirm={handleConfirm}
          title={t('settings.hotkeys.modalTitle', 'Set Hotkey')}
        />
      </div>
    </div>
  );
}

export default SettingsHotkeys;
