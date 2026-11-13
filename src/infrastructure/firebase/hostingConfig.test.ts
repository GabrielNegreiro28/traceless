import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import firebaseJsonSource from '../../../firebase.json?raw';

const HEADER_RULE = z.object({
  source: z.string(),
  headers: z.array(z.object({ key: z.string(), value: z.string() })),
});

const FIREBASE_JSON = z.object({
  hosting: z.object({
    public: z.string(),
    rewrites: z.array(z.object({ source: z.string(), destination: z.string() })),
    headers: z.array(HEADER_RULE),
  }),
});

const { hosting } = FIREBASE_JSON.parse(JSON.parse(firebaseJsonSource));

function headerOn(source: string, key: string): string | undefined {
  const rule = hosting.headers.find((candidate) => candidate.source === source);
  return rule?.headers.find((header) => header.key === key)?.value;
}

const REQUIRED_CONNECT_HOSTS = [
  'https://firebasevertexai.googleapis.com',
  'https://content-firebaseappcheck.googleapis.com',
  'https://identitytoolkit.googleapis.com',
  'https://securetoken.googleapis.com',
  'https://firestore.googleapis.com',
  'https://firebaseinstallations.googleapis.com',
  'https://firebaseremoteconfig.googleapis.com',
  'https://firebaseremoteconfigrealtime.googleapis.com',
  'https://www.google.com/recaptcha/',
];

describe('firebase.json hosting', () => {
  it('serves dist as a single-page app', () => {
    expect(hosting.public).toBe('dist');
    expect(hosting.rewrites).toContainEqual({ source: '**', destination: '/index.html' });
  });

  it('allows every Firebase/reCAPTCHA host the app connects to', () => {
    const csp = headerOn('**', 'Content-Security-Policy') ?? '';
    const connectSrc = csp.split(';').find((part) => part.trim().startsWith('connect-src')) ?? '';

    for (const host of REQUIRED_CONNECT_HOSTS) expect(connectSrc.split(/\s+/)).toContain(host);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('allows reCAPTCHA scripts and frames', () => {
    const csp = headerOn('**', 'Content-Security-Policy') ?? '';
    const directive = (name: string): string[] =>
      (csp.split(';').find((part) => part.trim().startsWith(name)) ?? '').trim().split(/\s+/);

    expect(directive('script-src')).toEqual(
      expect.arrayContaining([
        'https://www.google.com/recaptcha/',
        'https://www.gstatic.com/recaptcha/',
      ]),
    );
    expect(directive('frame-src')).toEqual(
      expect.arrayContaining([
        'https://www.google.com/recaptcha/',
        'https://recaptcha.google.com/recaptcha/',
      ]),
    );
  });

  it('never sends a referrer (the case key must not leak)', () => {
    expect(headerOn('**', 'Referrer-Policy')).toBe('no-referrer');
  });

  it('does not restrict language-model, which would disable Gemini Nano', () => {
    const permissions = headerOn('**', 'Permissions-Policy') ?? '';

    expect(permissions).not.toBe('');
    expect(permissions).not.toContain('language-model');
  });

  it('applies the immutable assets cache after the catch-all rule', () => {
    const sources = hosting.headers.map((rule) => rule.source);

    expect(sources.indexOf('/assets/**')).toBeGreaterThan(sources.indexOf('**'));
    expect(sources.indexOf('**')).toBeGreaterThanOrEqual(0);
    expect(headerOn('/assets/**', 'Cache-Control')).toContain('immutable');
    expect(headerOn('**', 'Cache-Control')).toBe('no-cache');
  });
});
