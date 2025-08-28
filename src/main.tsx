import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';

import { ServiceProvider } from './contexts/ServiceProvider.jsx';

import './i18n/i18n';
import './index.css';

import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ServiceProvider>
      <HashRouter>
        <App></App>
      </HashRouter>
    </ServiceProvider>
  </StrictMode>
);
