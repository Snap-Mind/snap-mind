import { useEffect, useCallback, useState, useMemo } from 'react';
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../hooks/useSettings';
import { useLogService } from '../../hooks/useLogService';

import SettingsCategory from './SettingsCategory';
import SettingsGeneral from './SettingsGeneral';
import SettingsModel from './Models/SettingsModels';
import SettingsChat from './SettingsChat';
import SettingsHotkeys from './SettingsHotkeys';
import SettingsOther from './SettingsOther';
import SettingsAppearance from './SettingsAppearance';

function Settings() {
  const { t } = useTranslation();
  const categories = useMemo(
    () => [
      { id: 'general', name: t('settings.general.title'), path: '/settings/general' },
      { id: 'appearance', name: t('settings.appearance.title'), path: '/settings/appearance' },
      { id: 'models', name: t('settings.providers.title'), path: '/settings/models' },
      { id: 'chat', name: t('settings.chat.title'), path: '/settings/chat' },
      { id: 'hotkeys', name: t('settings.hotkeys.title'), path: '/settings/hotkeys' },
      { id: 'others', name: t('settings.others.title'), path: '/settings/others' },
    ],
    [t]
  );
  const location = useLocation();
  const getCurrentCategory = useCallback(() => {
    return categories.find((cat) => location.pathname.includes(cat.path)) || categories[0];
  }, [location.pathname, categories]);

  const [activeCategory, setActiveCategory] = useState(getCurrentCategory());
  const [isCategoryCollapsed, setIsCategoryCollapsed] = useState(false);
  const { settings, hotkeys, permissions, setSettings, setHotkeys } = useSettings();

  const logger = useLogService();
  const navigate = useNavigate();

  useEffect(() => {
    const matchedCategory = getCurrentCategory();
    setActiveCategory(matchedCategory);
  }, [getCurrentCategory]);

  const onCategoryChange = useCallback(
    (id) => {
      logger.info(`Setting active category to ${id}`);

      const category = categories.find((cat) => cat.id === id);
      if (category) {
        navigate(category.path);
      }
    },
    [navigate, logger, categories]
  );

  const settingDetailsStyle = useMemo(() => {
    return activeCategory.id === 'models' ? '' : 'px-3 py-3';
  }, [activeCategory]);

  const sidebarWidthStyle = useMemo(() => {
    return isCategoryCollapsed
      ? 'grid-cols-[68px_minmax(0,1fr)]'
      : 'grid-cols-[230px_minmax(0,1fr)]';
  }, [isCategoryCollapsed]);

  return (
    <div
      className={`setting-container grid w-full min-w-0 ${sidebarWidthStyle} grid-rows-1 h-[100vh] overflow-hidden transition-all duration-200 ease-in-out`}
    >
      <div className="setting-category bg-background min-w-0 px-3 py-3 border-r-1 border-default">
        <SettingsCategory
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={onCategoryChange}
          isCollapsed={isCategoryCollapsed}
          onToggleCollapse={() => setIsCategoryCollapsed((prev) => !prev)}
        />
      </div>
      <div className={`setting-details bg-background min-w-0 ${settingDetailsStyle}`}>
        <Routes>
          <Route
            path="general"
            element={
              <SettingsGeneral
                settings={settings.general}
                permissions={permissions}
                onSettingsChange={setSettings}
              />
            }
          />
          <Route
            path="models/*"
            element={
              <SettingsModel
                settings={settings.providers}
                onSettingsChange={setSettings}
              ></SettingsModel>
            }
          ></Route>
          <Route
            path="appearance"
            element={
              <SettingsAppearance settings={settings.appearance} onSettingsChange={setSettings} />
            }
          />
          <Route
            path="chat"
            element={<SettingsChat settings={settings.chat} onSettingsChange={setSettings} />}
          />
          <Route
            path="hotkeys"
            element={<SettingsHotkeys hotkeys={hotkeys} onHotkeysChange={setHotkeys} />}
          />
          <Route index element={<Navigate to="general" replace />} />
          <Route path="others" element={<SettingsOther />} />
        </Routes>
      </div>
    </div>
  );
}

export default Settings;
