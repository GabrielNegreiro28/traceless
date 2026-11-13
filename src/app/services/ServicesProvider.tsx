import type { ReactNode } from 'react';
import type { Services } from '../compositionRoot';
import { ServicesContext } from './useServices';

export function ServicesProvider(props: {
  readonly services: Services;
  readonly children: ReactNode;
}) {
  return (
    <ServicesContext.Provider value={props.services}>{props.children}</ServicesContext.Provider>
  );
}
