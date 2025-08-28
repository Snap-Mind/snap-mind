import { Button, Divider } from '@heroui/react';
import { FileText } from 'lucide-react';
import { useLogService } from '../../hooks/useLogService';

function SettingsOther() {
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
        <h1 className="font-bold text-2xl">Others</h1>
        <Divider className="my-4" />
      </div>
      <div className="body overflow-y-auto">
        <Button color="primary" startContent={<FileText size={18} />} onPress={handleShowLogs}>
          Show Log Files
        </Button>
      </div>
    </div>
  );
}

export default SettingsOther;
