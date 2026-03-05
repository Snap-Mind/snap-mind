import { useEffect } from 'react';
import { Routes, Route, useNavigate, useHref } from 'react-router';
import { useTheme } from '@heroui/use-theme';
import { HeroUIProvider } from '@heroui/react';

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

  // const toggleTheme = () => {
  //   setTheme(theme === 'light' ? 'dark' : 'light');
  // };

  return (
    <>
      <HeroUIProvider navigate={navigate} useHref={useHref}>
        <Routes>
          <Route path="/" element={<Settings />} />
          <Route path="/chatpopup" element={<ChatPopup />} />
          <Route path="/settings/*" element={<Settings />} />
        </Routes>
      </HeroUIProvider>
    </>
  );
}

export default App;
