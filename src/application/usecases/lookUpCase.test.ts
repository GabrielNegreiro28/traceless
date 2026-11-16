import { beforeEach, describe, expect, it } from 'vitest';
import { generateCaseKey, groupCaseKey } from '../../domain/case/caseKey';
import { FakeAuthService } from '../../infrastructure/fakes/FakeAuthService';
import { FakeClock } from '../../infrastructure/fakes/FakeClock';
import { FakeReportRepository } from '../../infrastructure/fakes/FakeReportRepository';
import { createAppError } from '../../shared/appError';
import { lookUpCase, type LookUpCaseDeps } from './lookUpCase';
import { approvedText, seededBytes } from './submitReport.testKit';

const KEY = generateCaseKey(seededBytes(9));
const TEXT = approvedText('Safety checks were skipped on the loading dock.');

let auth: FakeAuthService;
let repository: FakeReportRepository;
let online: boolean;

function deps(): LookUpCaseDeps {
  return { auth, repository, isOnline: () => online };
}

beforeEach(async () => {
  auth = new FakeAuthService();
  repository = new FakeReportRepository(new FakeClock(5_000));
  online = true;
  await repository.submit({ caseKey: KEY, text: TEXT });
});

describe('lookUpCase', () => {
  it('signs in and reads the case for a key typed in groups', async () => {
    const result = await lookUpCase(groupCaseKey(KEY).join(' '), deps());
    expect(result).toEqual({
      ok: true,
      value: { caseKey: KEY, sanitizedText: TEXT, status: 'received', createdAt: 5_000 },
    });
    expect(auth.signIns).toBe(1);
  });

  it('reads a malformed key as NotFound without signing in', async () => {
    const result = await lookUpCase('not a key', deps());
    expect(result).toMatchObject({ ok: false, error: { kind: 'NotFound' } });
    expect(auth.signIns).toBe(0);
  });

  it('returns NotFound for an unknown key', async () => {
    const result = await lookUpCase(generateCaseKey(seededBytes(1)), deps());
    expect(result).toMatchObject({ ok: false, error: { kind: 'NotFound' } });
  });

  it('fails as Offline when the browser is offline', async () => {
    online = false;
    const result = await lookUpCase(KEY, deps());
    expect(result).toMatchObject({ ok: false, error: { kind: 'Offline' } });
    expect(auth.signIns).toBe(0);
  });

  it('stops when the sign-in fails', async () => {
    auth.failWith(createAppError('Offline', { message: 'network' }));
    const result = await lookUpCase(KEY, deps());
    expect(result).toMatchObject({ ok: false, error: { kind: 'Offline' } });
  });
});
