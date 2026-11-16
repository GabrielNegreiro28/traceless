import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

/**
 * Firestore security rules (firebase/firestore.rules) against the emulator.
 * Run with `npm run test:rules` (starts the emulator through `firebase emulators:exec`).
 */

const PROJECT_ID = 'demo-traceless';
const ORG = 'acme-demo';
const KEY = 'AbCd1234EfGh5678IjKl90';
const OTHER_KEY = 'ZyXw9876VuTs5432RqPo10';
const HANDLER_UID = 'handler-1';

let env: RulesTestEnvironment;

const anonymousReporter = (): Firestore =>
  env
    .authenticatedContext('reporter-1', { firebase: { sign_in_provider: 'anonymous' } })
    .firestore() as unknown as Firestore;
const handler = (): Firestore =>
  env
    .authenticatedContext(HANDLER_UID, { firebase: { sign_in_provider: 'password' } })
    .firestore() as unknown as Firestore;
const nonHandler = (): Firestore =>
  env
    .authenticatedContext('stranger', { firebase: { sign_in_provider: 'password' } })
    .firestore() as unknown as Firestore;
const unauthenticated = (): Firestore =>
  env.unauthenticatedContext().firestore() as unknown as Firestore;

const reportPath = (key = KEY) => `orgs/${ORG}/reports/${key}`;

function newReport(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sanitizedText: 'A manager approved invoices from a shell company.',
    status: 'received',
    createdAt: serverTimestamp(),
    schemaVersion: 1,
    ...overrides,
  };
}

/** Seeds data with the rules off: one existing report and the org's handler. */
async function seed(): Promise<void> {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore() as unknown as Firestore;
    await setDoc(doc(db, `orgs/${ORG}/handlers/${HANDLER_UID}`), { displayName: 'Demo handler' });
    await setDoc(doc(db, reportPath(OTHER_KEY)), {
      ...newReport(),
      createdAt: Timestamp.fromMillis(1_700_000_000_000),
    });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firebase/firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

describe('reporter: create', () => {
  it('an anonymous user may create a valid report', async () => {
    await assertSucceeds(setDoc(doc(anonymousReporter(), reportPath()), newReport()));
  });

  it('with an optional short category', async () => {
    const report = newReport({ category: 'Health and safety' });
    await assertSucceeds(setDoc(doc(anonymousReporter(), reportPath()), report));
  });

  it('an unauthenticated user may not', async () => {
    await assertFails(setDoc(doc(unauthenticated(), reportPath()), newReport()));
  });

  it('a non-anonymous user may not create a report', async () => {
    await assertFails(setDoc(doc(nonHandler(), reportPath()), newReport()));
  });

  it('an extra field is denied', async () => {
    const report = newReport({ reporterEmail: 'me@example.com' });
    await assertFails(setDoc(doc(anonymousReporter(), reportPath()), report));
  });

  it('a missing field is denied', async () => {
    const report = newReport();
    delete report.schemaVersion;
    await assertFails(setDoc(doc(anonymousReporter(), reportPath()), report));
  });

  it.each(['acknowledged', 'closed'])('status %s is denied', async (status) => {
    await assertFails(setDoc(doc(anonymousReporter(), reportPath()), newReport({ status })));
  });

  it('a client-chosen createdAt is denied', async () => {
    const report = newReport({ createdAt: Timestamp.fromMillis(0) });
    await assertFails(setDoc(doc(anonymousReporter(), reportPath()), report));
  });

  it('a wrong schemaVersion is denied', async () => {
    const report = newReport({ schemaVersion: 2 });
    await assertFails(setDoc(doc(anonymousReporter(), reportPath()), report));
  });

  it.each([
    ['empty', ''],
    ['oversized', 'a'.repeat(6001)],
    ['not a string', 42],
  ])('%s text is denied', async (_label, sanitizedText) => {
    const report = newReport({ sanitizedText });
    await assertFails(setDoc(doc(anonymousReporter(), reportPath()), report));
  });

  it('text of exactly 6000 characters is allowed', async () => {
    const report = newReport({ sanitizedText: 'a'.repeat(6000) });
    await assertSucceeds(setDoc(doc(anonymousReporter(), reportPath()), report));
  });

  it.each([
    ['empty', ''],
    ['101 characters', 'c'.repeat(101)],
    ['not a string', 7],
  ])('a category that is %s is denied', async (_label, category) => {
    const report = newReport({ category });
    await assertFails(setDoc(doc(anonymousReporter(), reportPath()), report));
  });

  it('an id that is not a case key is denied', async () => {
    await assertFails(setDoc(doc(anonymousReporter(), reportPath('short')), newReport()));
  });
});

describe('reporter: read', () => {
  it('may get a report by its id', async () => {
    await assertSucceeds(getDoc(doc(anonymousReporter(), reportPath(OTHER_KEY))));
  });

  it('may not list reports', async () => {
    await assertFails(getDocs(collection(anonymousReporter(), `orgs/${ORG}/reports`)));
  });

  it('an unauthenticated user may not list reports', async () => {
    await assertFails(getDocs(collection(unauthenticated(), `orgs/${ORG}/reports`)));
  });

  it('a retry after a late commit may read the existing report in a transaction (no write)', async () => {
    const db = anonymousReporter();
    await assertSucceeds(
      runTransaction(db, async (transaction) => {
        const existing = await transaction.get(doc(db, reportPath(OTHER_KEY)));
        if (!existing.exists()) throw new Error('expected the earlier report');
      }),
    );
  });

  it('a first send may read the missing id, then create, in one transaction', async () => {
    const db = anonymousReporter();
    const ref = doc(db, reportPath());
    await assertSucceeds(
      runTransaction(db, async (transaction) => {
        if ((await transaction.get(ref)).exists()) throw new Error('unexpected');
        transaction.set(ref, newReport());
      }),
    );
  });

  it('an unauthenticated user may not get a report', async () => {
    await assertFails(getDoc(doc(unauthenticated(), reportPath(OTHER_KEY))));
  });

  it('may not update or delete a report', async () => {
    const ref = doc(anonymousReporter(), reportPath(OTHER_KEY));
    await assertFails(updateDoc(ref, { sanitizedText: 'changed' }));
    await assertFails(updateDoc(ref, { status: 'closed' }));
    await assertFails(deleteDoc(ref));
  });

  it('may not overwrite an existing report by "creating" it again', async () => {
    await assertFails(setDoc(doc(anonymousReporter(), reportPath(OTHER_KEY)), newReport()));
  });
});

describe('handler', () => {
  it('a handler may list and get the reports of the org', async () => {
    await assertSucceeds(getDocs(collection(handler(), `orgs/${ORG}/reports`)));
    await assertSucceeds(getDoc(doc(handler(), reportPath(OTHER_KEY))));
  });

  it('a signed-in non-handler may not list reports', async () => {
    await assertFails(getDocs(collection(nonHandler(), `orgs/${ORG}/reports`)));
  });

  it('a handler of another org may not list them', async () => {
    await assertFails(getDocs(collection(handler(), 'orgs/other-org/reports')));
  });

  it('a handler may change only the status, to a known value', async () => {
    const ref = doc(handler(), reportPath(OTHER_KEY));
    await assertSucceeds(updateDoc(ref, { status: 'acknowledged' }));
    await assertFails(updateDoc(ref, { status: 'deleted' }));
    await assertFails(updateDoc(ref, { sanitizedText: 'edited by the handler' }));
    await assertFails(deleteDoc(ref));
  });
});

describe('everything else', () => {
  it('denies the messages subcollection, org and handler documents', async () => {
    const messages = `${reportPath(OTHER_KEY)}/messages/m1`;
    await assertFails(setDoc(doc(anonymousReporter(), messages), { text: 'hi' }));
    await assertFails(getDoc(doc(handler(), messages)));
    await assertFails(getDoc(doc(anonymousReporter(), `orgs/${ORG}`)));
    await assertFails(setDoc(doc(nonHandler(), `orgs/${ORG}/handlers/stranger`), {}));
    await assertFails(getDoc(doc(anonymousReporter(), 'anything/else')));
  });
});
