import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary, initSentry } from '../features/observability/sentry';
import { App } from './App';
import './index.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('No se encontró #root');
}

const app = <App />;

createRoot(root).render(
  <StrictMode>
    {initSentry() ? (
      <ErrorBoundary fallback={<p role="alert">No se pudo mostrar la pantalla.</p>} showDialog={false}>
        {app}
      </ErrorBoundary>
    ) : (
      app
    )}
  </StrictMode>,
);
