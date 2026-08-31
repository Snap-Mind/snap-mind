import type { ReactNode } from 'react';
import { Divider } from '@heroui/react';

interface SettingsSplitLayoutProps {
  title: ReactNode;
  headerAction?: ReactNode;
  list: ReactNode;
  details: ReactNode;
}

/**
 * Two-column settings layout (list + details) that fills the parent pane.
 * Height comes from Settings root (`h-[100vh]`); this component uses
 * `h-full min-h-0` so nested `100vh` is never needed.
 */
function SettingsSplitLayout({ title, headerAction, list, details }: SettingsSplitLayoutProps) {
  return (
    <div className="setting-container grid h-full min-h-0 grid-cols-[250px_1px_1fr] grid-rows-1">
      <div className="setting-category min-h-0 bg-background">
        <div className="container grid h-full min-h-0 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] px-3 py-3">
          <div className="header shrink-0">
            <div className="flex items-start justify-between gap-2">
              {typeof title === 'string' ? (
                <h1 className="font-bold text-2xl">{title}</h1>
              ) : (
                title
              )}
              {headerAction}
            </div>
            <Divider className="my-4" />
          </div>
          <div className="body min-h-0 overflow-y-auto">{list}</div>
        </div>
      </div>
      <Divider orientation="vertical" />
      <div className="setting-details min-h-0 overflow-y-auto bg-background px-3 pb-3">{details}</div>
    </div>
  );
}

export default SettingsSplitLayout;
