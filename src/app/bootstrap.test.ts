import { describe, expect, it, vi } from 'vitest';
import { createAppError } from '../shared/appError';
import { err, ok } from '../shared/result';
import { bootstrapServices } from './bootstrap';
import { createFakeServices, FAKE_TEST_ENV } from './services/renderWithServices';

describe('bootstrapServices', () => {
  it('returns the services built from a valid env', () => {
    const services = createFakeServices();
    const createServices = vi.fn(() => services);
    const result = bootstrapServices({ readEnv: () => ok(FAKE_TEST_ENV), createServices });
    expect(result).toBe(services);
    expect(createServices).toHaveBeenCalledWith(FAKE_TEST_ENV);
  });

  it('returns null for an invalid env without building services', () => {
    const createServices = vi.fn();
    const invalid = err(createAppError('Misconfigured', { message: 'bad env', missing: ['X'] }));
    expect(bootstrapServices({ readEnv: () => invalid, createServices })).toBeNull();
    expect(createServices).not.toHaveBeenCalled();
  });

  it('returns null when building the services throws', () => {
    const result = bootstrapServices({
      readEnv: () => ok(FAKE_TEST_ENV),
      createServices: () => {
        throw new Error('boom');
      },
    });
    expect(result).toBeNull();
  });
});
