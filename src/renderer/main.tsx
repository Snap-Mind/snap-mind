import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';

import { useSettingsStore } from './stores/useSettingsStore';
import { useProvidersStore } from './stores/useProvidersStore';
import { useAgentsStore } from './stores/useAgentsStore';
import { useHotkeysStore } from './stores/useHotkeysStore';
import { useChatStore } from './stores/useChatStore';
import { autoUpdateManager } from './services/AutoUpdateManager';

import './i18n/i18n';
import './index.css';

import App from './App.jsx';

async function boot() {
  await useSettingsStore.getState().hydrate();
  await useProvidersStore.getState().hydrate();
  await useAgentsStore.getState().hydrate();
  await useHotkeysStore.getState().hydrate();
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
