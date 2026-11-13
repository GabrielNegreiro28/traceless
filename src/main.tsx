import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { createServices, type Services } from './app/compositionRoot';
import { readEnv } from './app/env';
import { createAppRouter } from './app/router';
import { ServicesProvider } from './app/services/ServicesProvider';
import './index.css';
import { logger } from './shared/logger';

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('Root element #root not found');
const root = createRoot(rootElement);

/** Builds the app services once, here at the composition root. */
function buildServices(): Services | null {
  const env = readEnv();
  if (!env.ok) {
    logger.error('App configuration is invalid', { kind: env.error.kind });
    return null;
  }
  return createServices(env.value);
}

const services = buildServices();

root.render(
  <StrictMode>
    {services === null ? (
      <p role="alert" className="p-6 text-danger">
        Traceless is not set up correctly. Please try again later.
      </p>
    ) : (
      <ServicesProvider services={services}>
        <RouterProvider router={createAppRouter()} />
      </ServicesProvider>
    )}
  </StrictMode>,
);
