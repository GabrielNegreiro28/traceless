// @vitest-environment node
/// <reference types="node" />
import { ESLint, Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Proves the privacy-by-types lint rules fire with the project's REAL merged configuration
 * for each path (eslint.config.js): only consentToCloudScan.ts may create ConsentedRawText,
 * nobody may assert the brand, and features may not call the consent use cases directly.
 * Only the two restriction rules run here (they need no type information).
 */

const RULES = ['@typescript-eslint/no-restricted-imports', 'no-restricted-syntax'] as const;
const CONSENT_MESSAGE =
  'Only src/application/usecases/consentToCloudScan.ts may create ConsentedRawText.';

const FACTORY_IMPORT = `import { unsafeCreateConsentedRawText } from '../../domain/text/brandedText';
export const leaked = unsafeCreateConsentedRawText('raw report text');
`;

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: process.cwd() });
});

async function restrictionRules(filePath: string): Promise<Linter.RulesRecord> {
  const config = (await eslint.calculateConfigForFile(filePath)) as { rules?: Linter.RulesRecord };
  const rules: Linter.RulesRecord = {};
  for (const rule of RULES) {
    const entry = config.rules?.[rule];
    if (entry !== undefined) rules[rule] = entry;
  }
  return rules;
}

/** Lints `code` as if it lived at `filePath`; returns the restriction messages. */
async function lint(code: string, filePath: string): Promise<string[]> {
  const linter = new Linter({ cwd: process.cwd() });
  const config = {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: { parser: tseslint.parser },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: await restrictionRules(filePath),
  } as Linter.Config;
  return linter.verify(code, [config], { filename: filePath }).map((m) => m.message);
}

/** The rule prefixes its own text ("'x' import from 'y' is restricted ..."), then ours. */
const mentions = (messages: readonly string[], text: string): boolean =>
  messages.some((message) => message.includes(text));

describe('ESLint: ConsentedRawText may only be created by consentToCloudScan', () => {
  it.each([
    'src/features/review/useConsentedCloudScan.ts',
    'src/application/usecases/scanWithCloudConsent.ts',
    'src/application/usecases/approveReport.ts',
    'src/infrastructure/ai/consentedCloudModel.ts',
    'src/app/cloudAi.ts',
    'src/domain/report/sampleReport.ts',
  ])('fires when %s imports the factory', async (filePath) => {
    expect(mentions(await lint(FACTORY_IMPORT, filePath), CONSENT_MESSAGE)).toBe(true);
  });

  it('stays quiet in consentToCloudScan.ts, which still cannot create SanitizedText', async () => {
    const file = 'src/application/usecases/consentToCloudScan.ts';
    expect(await lint(FACTORY_IMPORT, file)).toEqual([]);
    const sanitized = FACTORY_IMPORT.replaceAll('ConsentedRawText', 'SanitizedText');
    const messages = await lint(sanitized, file);
    expect(mentions(messages, 'Only src/application/usecases/approveReport.ts may create')).toBe(
      true,
    );
  });

  it('forbids creating the brand with a type assertion anywhere in src', async () => {
    const code = `import type { ConsentedRawText } from '../domain/text/brandedText';
export const forged = 'raw report text' as ConsentedRawText;
`;
    expect(mentions(await lint(code, 'src/app/cloudAi.ts'), 'never by a type assertion')).toBe(
      true,
    );
  });

  it('keeps features from calling the consent use cases directly (types are fine)', async () => {
    const file = 'src/features/onboarding/CloudScanOption.tsx';
    const valueImport = `import { scanWithCloudConsent } from '../../application/usecases/scanWithCloudConsent';
export const run = scanWithCloudConsent;
`;
    const typeImport = `import type { CloudScanConsent } from '../../application/usecases/consentToCloudScan';
export type Consent = CloudScanConsent;
`;
    const messages = await lint(valueImport, file);
    expect(mentions(messages, 'never a consent use case directly')).toBe(true);
    expect(await lint(typeImport, file)).toEqual([]);
  });
});
