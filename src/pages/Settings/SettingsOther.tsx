import { Fragment, useEffect, useState } from 'react';
import { Button, Card, CardBody, CardHeader, Divider } from '@heroui/react';
import { useLogService } from '../../hooks/useLogService';
import { useTranslation } from 'react-i18next';
import Icon from '@/components/Icon';
import LogoSvg from '@/components/LogoSvg';

const APP_LINKS = {
  repo: 'https://github.com/Snap-Mind/snap-mind',
  homepage: 'https://snap-mind.github.io/',
  releases: 'https://github.com/Snap-Mind/snap-mind/releases',
  issues: 'https://github.com/Snap-Mind/snap-mind/issues',
  discord: 'https://discord.gg/4bpEAKMUzw',
  authorGithub: 'https://github.com/Louis-7',
};

const APP_META = {
  author: 'Louis Liu',
  license: 'Apache-2.0',
};

function SettingsOther() {
  const { t } = useTranslation();
  const logger = useLogService();
  const [version, setVersion] = useState('');

  useEffect(() => {
    window.electronAPI.getAppVersion().then(setVersion);
  }, []);

  const openUrl = (url: string) => {
    window.electronAPI.openExternalUrl(url);
  };

  const handleShowLogs = async () => {
    try {
      await logger.openLogFile();
    } catch (error) {
      logger.error('Failed to open log file:', error);
    }
  };

  const aboutRows = [
    {
      icon: 'tag' as const,
      label: t('settings.others.version'),
      value: version || '—',
    },
    {
      icon: 'user' as const,
      label: t('settings.others.author'),
      value: APP_META.author,
      url: APP_LINKS.authorGithub,
    },
    {
      icon: 'scale' as const,
      label: t('settings.others.license'),
      value: APP_META.license,
    },
  ];

  const links = [
    { icon: 'github' as const, label: t('settings.others.githubRepo'), url: APP_LINKS.repo },
    { icon: 'globe' as const, label: t('settings.others.homepage'), url: APP_LINKS.homepage },
    {
      icon: 'book-open' as const,
      label: t('settings.others.changelog'),
      url: APP_LINKS.releases,
    },
    { icon: 'bug' as const, label: t('settings.others.reportIssues'), url: APP_LINKS.issues },
    {
      icon: 'message-circle' as const,
      label: t('settings.others.discord'),
      url: APP_LINKS.discord,
    },
  ];

  return (
    <div className="grid grid-cols-1 grid-rows-[65px_1fr] w-full min-w-0 h-full">
      <div className="header">
        <h1 className="font-bold text-2xl">{t('settings.others.title')}</h1>
        <Divider className="my-4" />
      </div>
      <div className="body min-w-0 overflow-y-auto pb-6">
        {/* App branding */}
        <div className="flex flex-col items-center py-6">
          <div className="drop-shadow-lg">
            <LogoSvg className="w-16 h-16" />
          </div>
          <span className="font-bold text-xl">SnapMind</span>
        </div>

        {/* About */}
        <Card className="w-full my-5 border-1 border-gray-100" shadow="none">
          <CardBody className="p-0">
            {aboutRows.map((row, i) => (
              <Fragment key={i}>
                {i > 0 && <Divider />}
                <div
                  className={`flex items-center justify-between px-4 py-3${row.url ? ' cursor-pointer hover:bg-default-100 transition-colors' : ''}`}
                  onClick={row.url ? () => openUrl(row.url) : undefined}
                >
                  <div className="flex items-center gap-2 text-default-500">
                    <Icon icon={row.icon} size={16} />
                    <span className="text-sm">{row.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm${row.url ? ' text-primary' : ''}`}>{row.value}</span>
                    {row.url && <Icon icon="external-link" size={12} className="text-default-400" />}
                  </div>
                </div>
              </Fragment>
            ))}
          </CardBody>
        </Card>

        {/* Links */}
        <Card className="w-full my-5 border-1 border-gray-100" shadow="none">
          <CardHeader className="flex gap-3 justify-between items-center">
            <h4 className="font-bold">{t('settings.others.links')}</h4>
          </CardHeader>
          <CardBody className="p-0">
            {links.map((link, i) => (
              <Fragment key={i}>
                {i > 0 && <Divider />}
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-default-100 transition-colors"
                  onClick={() => openUrl(link.url)}
                >
                  <div className="flex items-center gap-3 text-default-700">
                    <Icon icon={link.icon} size={18} />
                    <span className="text-sm">{link.label}</span>
                  </div>
                  <Icon icon="external-link" size={14} className="text-default-400" />
                </div>
              </Fragment>
            ))}
          </CardBody>
        </Card>

        {/* Diagnostics */}
        <Card className="w-full my-5 border-1 border-gray-100" shadow="none">
          <CardHeader className="flex gap-3 justify-between items-center">
            <h4 className="font-bold">{t('settings.others.diagnostics')}</h4>
          </CardHeader>
          <CardBody>
            <div className="flex flex-col gap-3">
              <div className="text-xs text-gray-500">
                {t('settings.others.diagnosticsDescription')}
              </div>
              <div>
                <Button
                  color="primary"
                  variant="ghost"
                  size="sm"
                  startContent={<Icon icon="file-text" size={16} />}
                  onPress={handleShowLogs}
                >
                  {t('settings.others.showLogFiles')}
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Footer */}
        <div className="flex flex-col items-center gap-1 text-xs text-default-400 mt-4">
          <span>© 2025 Louis Liu. All rights reserved.</span>
          <div className="flex items-center gap-1.5">
            <span>{t('settings.others.madeWith')}</span>
            <Icon icon="heart" size={12} className="text-danger" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsOther;
