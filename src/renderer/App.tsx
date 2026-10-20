import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useHref } from 'react-router';
import { useTheme } from '@heroui/use-theme';
import { HeroUIProvider, ToastProvider } from '@heroui/react';

import ChatPopup from './pages/ChatPopup/ChatPopup';
import Settings from './pages/Settings/Settings';
import { ThemeService } from './services/ThemeService';

function App() {
  const navigate = useNavigate();
  const { setTheme } = useTheme();

  useEffect(() => {
    const themeService = new ThemeService();
    void themeService.initialize(setTheme);

    return () => {
      themeService.dispose();
    };
  }, [setTheme]);

  useEffect(() => {
    window.electronAPI?.nav?.onGo?.((path) => {
      navigate(path);
    });
    return () => window.electronAPI?.nav?.offGo?.();
  }, [navigate]);

  // const toggleTheme = () => {
  //   setTheme(theme === 'light' ? 'dark' : 'light');
  // };

  return (
    <>
      <HeroUIProvider navigate={navigate} useHref={useHref}>
        <ToastProvider placement="bottom-right" toastOffset={16} />
        <Routes>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatPopup />} />
          <Route path="/chatpopup" element={<Navigate to="/chat" replace />} />
          <Route path="/settings/*" element={<Settings />} />
        </Routes>
      </HeroUIProvider>
    </>
  );
}

export default App;
