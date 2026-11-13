import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { bootstrapServices } from './app/bootstrap';
import { createAppRouter } from './app/router';
import { ServicesProvider } from './app/services/ServicesProvider';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('Root element #root not found');
const root = createRoot(rootElement);

// Null when the config is invalid or building the services threw (both are logged).
const services = bootstrapServices();

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
