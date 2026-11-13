import type { ReactNode } from 'react';
import { EvalServicesContext, type EvalServices } from './evalServices';

export function EvalServicesProvider(props: {
  readonly services: EvalServices;
  readonly children: ReactNode;
}) {
  return (
    <EvalServicesContext.Provider value={props.services}>
      {props.children}
    </EvalServicesContext.Provider>
  );
}
