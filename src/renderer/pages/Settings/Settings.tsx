import { useEffect, useCallback, useState, useMemo } from 'react';
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useLogService } from '../../hooks/useLogService';
import type { SettingsChangeHandler } from '@/types';

import SettingsCategory from './SettingsCategory';
import SettingsGeneral from './SettingsGeneral';
import SettingsModel from './Models/SettingsModels';
import SettingsAgents from './Agents/SettingsAgents';
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
      { id: 'agents', name: t('settings.agents.title'), path: '/settings/agents' },
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
  const settings = useSettingsStore((s) => s.settings);
  const permissions = useSettingsStore((s) => s.permissions);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  const setSettings = useCallback<SettingsChangeHandler>(
    async (path, value) => {
      await updateSetting(path, value);
      return useSettingsStore.getState().settings;
    },
    [updateSetting]
  );

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
    return activeCategory.id === 'models' || activeCategory.id === 'agents' ? '' : 'px-3 py-3';
  }, [activeCategory]);

  return (
    <div className="setting-container grid w-full min-w-0 grid-cols-[230px_minmax(0,1fr)] grid-rows-1 h-[100vh] overflow-hidden">
      <div className="setting-category bg-background min-w-0 px-3 py-3 border-r-1 border-default">
        <SettingsCategory
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={onCategoryChange}
          onBack={() => navigate('/chat')}
        />
      </div>
      <div
        className={`setting-details bg-background min-w-0 min-h-0 h-full ${settingDetailsStyle}`}
      >
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
          <Route path="models/*" element={<SettingsModel />}></Route>
          <Route path="agents/*" element={<SettingsAgents />}></Route>
          <Route
            path="appearance"
            element={
              <SettingsAppearance settings={settings.appearance} onSettingsChange={setSettings} />
            }
          />
          <Route path="hotkeys" element={<SettingsHotkeys />} />
          <Route index element={<Navigate to="general" replace />} />
          <Route path="others" element={<SettingsOther />} />
        </Routes>
      </div>
    </div>
  );
}

export default Settings;
