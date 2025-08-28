import { Divider } from '@heroui/react';
import BooleanInput from '../../components/BooleanInput';

import { SettingsChangeHandler } from '@/types';
import { GeneralSetting } from '@/types/setting';

export interface SettingsGeneralProps {
  settings: GeneralSetting;
  onSettingsChange: SettingsChangeHandler;
}

function SettingsGeneral({ settings, onSettingsChange }: SettingsGeneralProps) {
  return (
    <div className="container grid grid-cols-1 grid-rows-[65px_1fr] h-full">
      <div className="header">
        <h1 className="font-bold text-2xl">General</h1>
        <Divider className="my-4" />
      </div>
      <div className="body overflow-y-auto">
        <BooleanInput
          id="clipboard"
          label="Enable Clipboard Fallback"
          description="Use Clipboard fallback when selected text is not able to be get by API"
          defaultSelected={settings.clipboardEnabled}
          onValueChange={(value) => onSettingsChange(['general', 'clipboardEnabled'], value)}
        />
      </div>
    </div>
  );
}

export default SettingsGeneral;
