import { HotKeysChangeHandler } from '@/types';
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

interface SettingsHotkeysProps {
  hotkeys: Hotkey[];
  onHotkeysChange: HotKeysChangeHandler;
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

  return <Kbd keys={modifiers}> {mainKey}</Kbd>;
};

function SettingsHotkeys({ hotkeys, onHotkeysChange }: SettingsHotkeysProps) {
  const handleHotkeyChange = (index, key, value) => {
    const newHotkeys = [...hotkeys];
    newHotkeys[index] = {
      ...newHotkeys[index],
      [key]: value,
    };
    onHotkeysChange(newHotkeys);
  };
  const title = 'Custom Keyboard Shortcuts';
  const description = 'Configure up to 3 custom keyboard shortcuts with personalized prompts';
  return (
    <div className="container grid grid-cols-1 grid-rows-[65px_1fr] h-full">
      <div className="header">
        <h1 className="font-bold text-2xl">Hotkeys</h1>
        <Divider className="my-4" />
      </div>
      <div className="body overflow-y-auto">
        <div className="flex items-center justify-center w-full">
          <Alert description={description} title={title} />
        </div>
        {hotkeys.map((hotkey, index) => (
          <Card key={index} className="w-full my-5 border-1 border-gray-100" shadow="none">
            <CardHeader className="flex gap-3 justify-between">
              <h4>{hotkey.id === 0 ? 'Default' : `Shortcut ${index}`}</h4>
              <Switch
                size="sm"
                defaultSelected={hotkey.enabled}
                onValueChange={(value) => handleHotkeyChange(index, 'enabled', value)}
              >
                Enabled
              </Switch>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              <div>{renderHotkeyKey(hotkey.key)}</div>

              {hotkey.id === 0 ? (
                <Card shadow="none" isHoverable={true}>
                  <CardBody>
                    <p>Use default hotkey to open blank chat window.</p>
                  </CardBody>
                </Card>
              ) : (
                <Textarea
                  label="Prompt"
                  placeholder="Enter your prompt"
                  defaultValue={hotkey.prompt}
                  onValueChange={(value) => handleHotkeyChange(index, 'prompt', value)}
                />
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default SettingsHotkeys;
