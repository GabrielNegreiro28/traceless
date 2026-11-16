# ADR 0003: The case key is a capability, not an account

- **Status:** Accepted
- **Date:** 2026-11-16

## Context

The EU Whistleblowing Directive (2019/1937) requires the organization to acknowledge a
report within 7 days and give feedback within 3 months, so the reporter must be able to come
back to the case. Accounts would tie the report to an identity, and Traceless keeps no
identity on the device (ADR 0005): the anonymous Firebase user is forgotten when the tab
closes.

## Decision

- Each report gets a **case key**: 128 random bits from `crypto.getRandomValues`, encoded as
  22 base62 characters (`src/domain/case/caseKey.ts`, random source injected for tests).
- The case key **is the Firestore document id**: `orgs/{orgId}/reports/{caseKey}`.
- Whoever holds the key can read that one case from any device, after an anonymous sign-in.
  The security rules allow `get` by id to signed-in users and **never `list`** to reporters,
  so a key cannot be discovered by enumeration (`firebase/firestore.rules`).
- The key is shown **once**, in monospace groups of four, with Copy and Download .txt and an
  "I saved my key" gate. It is never written to localStorage, sessionStorage, the URL, logs
  or the flow state.

## Consequences

- 128 bits make guessing infeasible; the key needs no server-side secret or index.
- A lost key cannot be recovered: nobody, including the organization, can link it back to the
  reporter. The copy says so plainly.
- Anyone who obtains the key can read the sanitized report and its status. That text was
  reviewed and approved by the reporter, but the key must still be kept private (the
  downloaded file says so).
- The submit is a Firestore transaction that never overwrites an existing id. The key for an
  approved text is kept in memory across retries, and an existing document with the same
  text counts as success, so a retry after an unconfirmed send (timeout, lost answer) never
  creates a second case. A different text under the same key (a practically impossible
  collision) fails instead of overwriting.
