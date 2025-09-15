import { Button, Divider } from '@heroui/react';
import { useLogService } from '../../hooks/useLogService';
import { useTranslation } from 'react-i18next';
import Icon from '@/components/Icon';

function SettingsOther() {
  const { t } = useTranslation();
  const logger = useLogService();

  const handleShowLogs = async () => {
    try {
      await logger.openLogFile();
    } catch (error) {
      logger.error('Failed to open log file:', error);
    }
  };
  return (
    <div className="container grid grid-cols-1 grid-rows-[65px_1fr] h-full">
      <div className="header">
        <h1 className="font-bold text-2xl">{t('settings.others.title')}</h1>
        <Divider className="my-4" />
      </div>
      <div className="body overflow-y-auto">
        <Button color="primary" startContent={<Icon icon="file-text" size={18} />} onPress={handleShowLogs}>
          {t('settings.others.showLogFiles')}
        </Button>
      </div>
    </div>
  );
}

export default SettingsOther;
