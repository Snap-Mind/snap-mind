import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';

import { useSettingsStore } from './stores/useSettingsStore';
import { useProvidersStore } from './stores/useProvidersStore';
import { useChatStore } from './stores/useChatStore';
import { autoUpdateManager } from './services/AutoUpdateManager';

import './i18n/i18n';
import './index.css';

import App from './App.jsx';

async function boot() {
  await useSettingsStore.getState().hydrate();
  await useProvidersStore.getState().hydrate();
  useChatStore.getState().hydrateFromSettings();
  void autoUpdateManager.initialize();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </StrictMode>
  );
}

void boot();
