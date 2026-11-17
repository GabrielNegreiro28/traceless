# Traceless

**For whistleblowers, Traceless finds the details in a report that could reveal who wrote it, on the device, before anything is sent, so only text the reporter has reviewed and approved ever reaches the cloud.**

Live app (no sign-up): https://traceless-92f85.web.app · Video: VIDEO_URL_TBD · Code: Apache 2.0, public repository

## Inspiration

Anonymous reporting channels protect the sender. The report itself often gives the reporter away: "the only night-shift nurse on Ward 3", "the Tuesday after my surgery", "I was the one who trained the new hire". A hotline can strip IP addresses and still hand the employer a text that points at one person. Anonymity fails through content, not the channel.

That creates a paradox for AI: the text that needs the most protection is exactly the text you should not upload to analyze. Hybrid inference resolves it. USER_QUOTES_TBD

## What it does

A reporter pastes a report (or loads an invented sample). Traceless then:

1. **Scans on the device.** Rules, grammar-based candidates, then Gemini Nano verifies each candidate, and a second "HR investigator" pass asks what a colleague could deduce. The badge reads "Checked on your device".
2. **Shows every finding as a card.** The reporter chooses Accept, Edit, Keep anyway or "Not about me". There is deliberately no "accept all", and nothing changes silently.
3. **Forces a Second look.** The reporter must confirm they re-read the report for details only they would know.
4. **Approves in the Outbox.** Only then does the cloud get involved: Gemini organizes the approved text (category, summary, when, where). The badge reads "Organized in the cloud — only your approved text".
5. **Shows what happened.** A "What happened to your text" panel lists every step so far and where it ran (device or cloud), never the words themselves, and lives in the tab's memory only.
6. **Sends and returns.** The reporter gets a random 128-bit case key, shown once, and can check status later at `/case`.

It works with one click and no account. On a browser without Gemini Nano, a per-scan consent dialog offers a cloud scan, or a pattern-only check that stays on the device.

## How we built it

Every task is routed by one file, `src/ai/policy/inferencePolicy.ts`, and TypeScript rejects a raw-text task with any mode other than `ONLY_ON_DEVICE`. Raw and approved text have different types (`RawText`, `SanitizedText`); only `approveReport()` creates the latter, and cloud adapters accept nothing else.

| Task                               | Mode              | Data                            |
| ---------------------------------- | ----------------- | ------------------------------- |
| `identityScan`, `disclosureVerify` | `ONLY_ON_DEVICE`  | raw report                      |
| `structureReport`                  | `PREFER_IN_CLOUD` | approved text only              |
| `identityScanConsented`            | `ONLY_IN_CLOUD`   | raw, one scan, explicit consent |

Firebase products:

- **Firebase AI Logic (hybrid inference):** the core. Nano for raw text, cloud Gemini for approved text, `inferenceSource` shown in the UI. `src/infrastructure/ai/aiService.ts`, `modelFactory.ts`, `hybridModel.ts`.
- **App Check:** required by AI Logic; reCAPTCHA Enterprise in production. `src/infrastructure/firebase/appCheck.ts`.
- **Authentication (anonymous):** no account for reporters or judges; the anonymous sign-in happens only when you send a report or look up a case. `src/infrastructure/firebase/anonymousAuth.ts`.
- **Firestore + rules:** stores the approved report; reporters can create and get by key, never list, update or delete. `src/infrastructure/firebase/reportSubmit.ts`, `firebase/firestore.rules`.
- **Remote Config:** a cloud-scan kill switch, plus the acknowledgement (7 days) and feedback (90 days) deadlines from EU Directive 2019/1937. `src/infrastructure/config/RemoteConfigService.ts`.
- **Hosting:** the live app with a strict CSP. `firebase.json`.

Stack: React, TypeScript, Vite, zod for model output. Full diagram: `docs/architecture.md`.

## Challenges we ran into

- **Small local model.** Nano degrades on complex prompts, so each call is short and single-purpose, and cheap deterministic layers run first.
- **Stalls.** Some on-device scans hang. A failed or hung scan counts as a miss in our metric, and the UI offers recovery without ever retrying silently.
- **No silent fallback.** `PREFER_ON_DEVICE` would quietly send raw text to the cloud, so raw tasks never use it.
- **English only.** Nano's supported languages exclude Portuguese, so the product is English-only for now.

## Accomplishments that we're proud of

- The hybrid is the product, not decoration: with the network off, the scan still runs and the badge says so.
- The privacy rule is enforced by types, not by promise.
- Honest evaluation. We wrote a new 22-report held-out set (87 gold spans) with a blind LLM author, committed its hash before touching the detector, and ran it once with unchanged thresholds.
  - Strict recall **0.709** (95% CI 0.642 to 0.784), target 0.70: met, but unstable (worst run 0.655).
  - Wrongly flagging accused people: **0.072** against a 0.05 target: **not met**. This is why every finding needs a click and "Not about me" exists.
  - Soft precision 0.662 (findings that match a gold span without being oversized, out of all findings); median scan 14.3 s.
  - Disclosures: the data is synthetic and LLM-written; the baseline comparison on this split was lost to a stalled run, so detector comparisons rest on the development pool only; one late commit changed rewrite suggestions, not detection.
- Traceless never claims the list is complete, and never promises anonymity.

## What we learned

Privacy-sensitive features need a routing policy you can read in one file. A small on-device model is strongest as a verifier over cheap candidates. And reporting your own misses builds more trust than a headline number.

## What's next

Rights advice grounded with Google Search (cloud only, approved text), an investigator-side triage view, on-device writing-style neutralization, more languages as Nano gains them, Android with the same SDK, and evaluation on real, consented reports.
