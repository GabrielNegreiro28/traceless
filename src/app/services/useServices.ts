import { createContext, useContext } from 'react';
import type { Services } from '../compositionRoot';

export const ServicesContext = createContext<Services | null>(null);

/** The only way features obtain services; they are built once in the composition root. */
export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (services === null) throw new Error('useServices must be used inside a <ServicesProvider>.');
  return services;
}
