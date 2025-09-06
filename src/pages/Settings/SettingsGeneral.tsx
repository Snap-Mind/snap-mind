import { Divider, Card, CardBody, CardHeader, Switch, Link } from '@heroui/react';
import { Trans, useTranslation } from 'react-i18next';
import { LanguageSelector } from '../../components/LanguageSelector';
import Icon from '../../components/Icon';

import { SettingsChangeHandler, SystemPermission } from '@/types';
import { GeneralSetting } from '@/types/setting';

export interface SettingsGeneralProps {
  settings: GeneralSetting;
  permissions: SystemPermission[];
  onSettingsChange: SettingsChangeHandler;
}

function SettingsGeneral({ settings, permissions, onSettingsChange }: SettingsGeneralProps) {
  const { t } = useTranslation();

  const renderPermissionCard = (permission: SystemPermission) => {
    const accessibilityInfo = () => (
      <div>
        {permission.isGranted ? (
          t('settings.general.permission.accessibilityGranted')
        ) : (
          <Trans
            i18nKey="settings.general.permission.accessibilityNotGranted"
            components={[
              <Link
                className="text-xs text-primary cursor-pointer"
                isExternal
                showAnchorIcon
                onClick={onOpenSystemAccessibility}
              />,
              <strong className='text-primary' />
            ]}
          />
        )}
      </div>
    );

    const administratorInfo = () => (
      <div>
        {permission.isGranted ? (
          t('settings.general.permission.administratorGranted')
        ) : (
          <Trans
            i18nKey="settings.general.permission.administratorNotGranted"
            values={{ permissionName: permission.name }}
            components={[
              <Link
                className="text-xs text-primary cursor-pointer"
                isExternal
                showAnchorIcon
                onClick={onOpenInstallationFolder}
              />,
               <strong className='text-primary' />
            ]}
          />
        )}
      </div>
    );

    return (
      <div className="text-xs text-gray-500">
        {permission.id === 'macAccessibility' && accessibilityInfo()}
        {permission.id === 'winAdministrator' && administratorInfo()}
      </div>
    );
  };

  const onOpenSystemAccessibility = () => {
    if (window.electronAPI.openSystemAccessibility) {
      window.electronAPI.openSystemAccessibility();
    }
  };

  const onOpenInstallationFolder = () => {
    if (window.electronAPI.openInstallFolder) {
      window.electronAPI.openInstallFolder();
    }
  };

  return (
    <div className="container grid grid-cols-1 grid-rows-[65px_1fr] h-full">
      <div className="header">
        <h1 className="font-bold text-2xl">{t('settings.general.title')}</h1>
        <Divider className="my-4" />
      </div>
      <div className="body overflow-y-auto">
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">{t('settings.general.language')}</label>
          <LanguageSelector />
        </div>
        <Divider className="my-4" />
        <h2 className="font-bold text-xl">{t('settings.general.permission.title')}</h2>
        {permissions.map((permission) => (
          <Card key={permission.id} className="w-full my-5 border-1 border-gray-100" shadow="none">
            <CardHeader className="flex gap-3 justify-between">
              <h4 className="font-bold">{t(`settings.general.permission.${permission.id}`)}</h4>
              <div className="mr-1">
                {permission.isGranted ? (
                  <Icon className="text-success" icon="circle-check-big" />
                ) : (
                  <Icon className="text-danger" icon="circle-x" />
                )}
              </div>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">{renderPermissionCard(permission)}</CardBody>
          </Card>
        ))}
        <Card className="w-full my-5 border-1 border-gray-100" shadow="none">
          <CardHeader className="flex gap-3 justify-between">
            <h4 className="font-bold">{t('settings.general.clipboardFallback')}</h4>
            <Switch
              size="sm"
              defaultSelected={settings.clipboardEnabled}
              onValueChange={(value) => onSettingsChange(['general', 'clipboardEnabled'], value)}
            >
              {t('common.enabled')}
            </Switch>
          </CardHeader>
          <CardBody className="flex flex-col gap-5">
            <div className="text-xs text-gray-500">
              {t('settings.general.clipboardFallbackDescription')}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default SettingsGeneral;
