# ADR 0005: No persistent client storage for report data or identity

- **Status:** Accepted
- **Date:** 2026-11-12

## Context

Traceless is used by whistleblowers, often on a shared or work computer that the
organization being reported may control or inspect. Anything the app writes to
IndexedDB or localStorage outlives the tab: the report text, messages, the case key
(which alone opens the case) and the anonymous Firebase identity could all be
recovered from the browser profile later. That would defeat the product's promise.

The original plan (PLANO §2) used Firestore's persistent cache so that a report
could be queued offline and sent later, even after a restart.

## Decision

- Firestore is initialized with `memoryLocalCache()`
  (`src/infrastructure/firebase/firestore.ts`).
- Firebase Auth is initialized with `inMemoryPersistence`
  (`src/infrastructure/firebase/auth.ts`).
- No report content, case key or identity is written to localStorage, IndexedDB,
  analytics or logs by application code.

## Consequences

- Offline submission works only while the tab stays open: Firestore queues the write
  in memory and syncs when the connection returns. Fase 4 adds a "Keep this tab open"
  banner while a write is pending and a `beforeunload` warning.
- Closing the tab signs the anonymous user out; follow-up relies on the case key,
  which the reporter saves themselves (ADR 0003).
- Firebase SDKs still keep non-identifying technical state in IndexedDB (App Check
  token, Installations ID, fetched Remote Config values). None of it contains report
  content, the case key or the reporter's identity.
- Public copy must say "no report content, case key or identity is stored on this
  device", never "nothing is stored".
