import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';

import { ServiceProvider } from './contexts/ServiceProvider.jsx';

import './i18n/i18n';
import './index.css';

import App from './App.jsx';

// Scrollbar auto-hide helper: add a class while user is actively scrolling / moving pointer / keyboard nav
(function initAutoHideScrollbars() {
  let timeout: number | null = null;
  const ACTIVE_CLASS = 'show-scrollbars';
  const HIDE_DELAY = 800; // ms after last interaction

  const show = () => {
    if (!document.body.classList.contains(ACTIVE_CLASS)) {
      document.body.classList.add(ACTIVE_CLASS);
    }
    if (timeout) window.clearTimeout(timeout);
    timeout = window.setTimeout(() => {
      document.body.classList.remove(ACTIVE_CLASS);
    }, HIDE_DELAY);
  };

  ['wheel', 'touchmove', 'mousemove', 'keydown'].forEach((evt) => {
    window.addEventListener(evt, show, { passive: true });
  });
})();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ServiceProvider>
      <HashRouter>
        <App></App>
      </HashRouter>
    </ServiceProvider>
  </StrictMode>
);
