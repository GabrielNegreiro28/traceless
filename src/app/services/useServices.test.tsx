import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FakeDeviceCapability } from '../../infrastructure/fakes/FakeDeviceCapability';
import { FakeIdentityScanner } from '../../infrastructure/fakes/FakeIdentityScanner';
import { createFakeServices, renderWithServices } from './renderWithServices';
import { useServices } from './useServices';

function Probe() {
  const services = useServices();
  return <p>{services.identityScanner.constructor.name}</p>;
}

describe('useServices', () => {
  it('throws a clear error outside a provider', () => {
    expect(() => render(<Probe />)).toThrow(/useServices must be used inside a <ServicesProvider>/);
  });

  it('returns the fake services from the composition root inside the helper', () => {
    const { services } = renderWithServices(<Probe />);
    expect(screen.getByText('FakeIdentityScanner')).toBeInTheDocument();
    expect(services.identityScanner).toBeInstanceOf(FakeIdentityScanner);
    expect(services.deviceCapability).toBeInstanceOf(FakeDeviceCapability);
  });

  it('applies per-test overrides', () => {
    const scanner = new FakeIdentityScanner();
    const { services } = renderWithServices(<Probe />, { identityScanner: scanner });
    expect(services.identityScanner).toBe(scanner);
    expect(createFakeServices().identityScanner).not.toBe(scanner);
  });
});
