import { useEffect, useCallback, useState, useMemo } from 'react';
import { Routes, Route, useNavigate, Navigate, useLocation } from 'react-router';
import { useSettings } from '../../hooks/useSettings';
import { useLogService } from '../../hooks/useLogService';

import SettingsCategory from './SettingsCategory';
import SettingsGeneral from './SettingsGeneral';
import SettingsModel from './Models/SettingsModels';
import SettingsChat from './SettingsChat';
import SettingsHotkeys from './SettingsHotkeys';
import SettingsOther from './SettingsOther';

const categories = [
  { id: 'general', name: 'General', path: '/settings/general' },
  { id: 'models', name: 'Providers', path: '/settings/models' },
  { id: 'chat', name: 'Chat', path: '/settings/chat' },
  { id: 'hotkeys', name: 'Hotkeys', path: '/settings/hotkeys' },
  { id: 'others', name: 'Others', path: '/settings/others' },
];

function Settings() {
  const location = useLocation();
  const getCurrentCategory = useCallback(() => {
    return categories.find((cat) => location.pathname.includes(cat.path)) || categories[0];
  }, [location.pathname]);

  const [activeCategory, setActiveCategory] = useState(getCurrentCategory());
  const { settings, hotkeys, setSettings, setHotkeys } = useSettings();

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
    [navigate, logger]
  );

  const settingDetailsStyle = useMemo(() => {
    return activeCategory.id === 'models' ? '' : 'px-3 py-3';
  }, [activeCategory]);

  return (
    <div className="setting-container grid grid-cols-[250px_1fr] grid-rows-1 h-[100vh]">
      <div className="setting-category bg-background px-3 py-3 border-r-1 border-default">
        <SettingsCategory
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={onCategoryChange}
        />
      </div>
      <div className={`setting-details bg-background ${settingDetailsStyle}`}>
        <Routes>
          <Route
            path="general"
            element={<SettingsGeneral settings={settings.general} onSettingsChange={setSettings} />}
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
