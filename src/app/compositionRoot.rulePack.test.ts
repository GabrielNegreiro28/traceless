import { describe, expect, it } from 'vitest';
import { toRawText } from '../domain/text/brandedText';
import { FakeIdentityScanner } from '../infrastructure/fakes/FakeIdentityScanner';
import { createServices, createVariantServices, type ScanVariantSpec } from './compositionRoot';
import { FAKE_TEST_ENV } from './services/renderWithServices';

const REPORT = toRawText("I'm the only glassblower at the kiln and I work nights.");

const CORE: ScanVariantSpec = {
  promptVersion: 'identityScan.v2',
  strategy: 'single2',
  chunkChars: 3000,
  postFilters: ['protectedMentions', 'thirdPerson'],
  rulePack: 'core',
};
const WITH_FIRST_PERSON: ScanVariantSpec = { ...CORE, rulePack: 'core+firstPerson' };

async function ruleQuotes(services: ReturnType<typeof createServices>): Promise<string[]> {
  const result = await services.scanReport(REPORT);
  if (!result.ok) throw new Error(result.error.kind);
  return result.value.findings.filter((f) => f.origin === 'RULE').map((f) => f.quote);
}

describe('composition root: rule packs (§G.3)', () => {
  it('ships core+firstPerson: first-person findings by default', async () => {
    expect(await ruleQuotes(createServices(FAKE_TEST_ENV))).toEqual([
      'the only glassblower',
      'work nights',
    ]);
  });

  it('a core+firstPerson variant runs the first-person pack as a separate cached service', async () => {
    const servicesFor = createVariantServices(FAKE_TEST_ENV, new FakeIdentityScanner());
    const core = servicesFor(CORE);
    const firstPerson = servicesFor(WITH_FIRST_PERSON);
    expect(firstPerson).not.toBe(core);
    expect(servicesFor({ ...WITH_FIRST_PERSON })).toBe(firstPerson);
    expect(await ruleQuotes(core)).toEqual([]);
    expect(await ruleQuotes(firstPerson)).toEqual(['the only glassblower', 'work nights']);
  });

  it('"Continue with basic checks" also runs the first-person pack', () => {
    const services = createVariantServices(FAKE_TEST_ENV)(CORE);
    const quotes = services.scanRulesOnly(REPORT).findings.map((f) => f.quote);
    expect(quotes).toEqual(['the only glassblower', 'work nights']);
  });
});
