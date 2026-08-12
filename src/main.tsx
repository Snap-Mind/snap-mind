import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';

import { ServiceProvider } from './contexts/ServiceProvider.jsx';
import { useSettingsStore } from './stores/useSettingsStore';
import { useChatStore } from './stores/useChatStore';
import { autoUpdateManager } from './services/AutoUpdateManager';

import './i18n/i18n';
import './index.css';

import App from './App.jsx';

async function boot() {
  await useSettingsStore.getState().hydrate();
  useChatStore.getState().hydrateFromSettings();
  void autoUpdateManager.initialize();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ServiceProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </ServiceProvider>
    </StrictMode>
  );
}

void boot();
