import { useEffect } from 'react';
import { Routes, Route, useNavigate, useHref } from 'react-router';
import { useTheme } from '@heroui/use-theme';
import { HeroUIProvider } from '@heroui/react';

import ChatPopup from './pages/ChatPopup/ChatPopup';
import Settings from './pages/Settings/Settings';

function App() {
  const navigate = useNavigate();
  const { setTheme } = useTheme();

  useEffect(() => {
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      setTheme(e.matches ? 'dark' : 'light');
    };

    // Set initial theme
    setTheme(darkModeMediaQuery.matches ? 'dark' : 'light');

    // Listen for changes
    darkModeMediaQuery.addEventListener('change', handleChange);

    return () => darkModeMediaQuery.removeEventListener('change', handleChange);
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
