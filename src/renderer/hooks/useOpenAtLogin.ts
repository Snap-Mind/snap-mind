import { useCallback, useEffect, useState } from 'react';

export const useOpenAtLogin = () => {
  const [openAtLogin, setOpenAtLogin] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const loadOpenAtLogin = async () => {
      try {
        const result = await window.electronAPI.getOpenAtLogin();
        if (!isActive) return;

        setOpenAtLogin(!!result.openAtLogin);
        setIsSupported(!!result.supported);
      } catch {
        if (!isActive) return;
        setIsSupported(false);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadOpenAtLogin();

    return () => {
      isActive = false;
    };
  }, []);

  const toggleOpenAtLogin = useCallback(
    async (value: boolean) => {
      const previous = openAtLogin;
      setOpenAtLogin(value);

      try {
        const result = await window.electronAPI.setOpenAtLogin(value);
        if (!result.success) {
          setOpenAtLogin(previous);
          return;
        }

        setOpenAtLogin(!!result.openAtLogin);
        setIsSupported(!!result.supported);
      } catch {
        setOpenAtLogin(previous);
      }
    },
    [openAtLogin]
  );

  return {
    openAtLogin,
    isSupported,
    isLoading,
    toggleOpenAtLogin,
  };
};
