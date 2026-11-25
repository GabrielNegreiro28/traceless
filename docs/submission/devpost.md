# Traceless

**For whistleblowers, Traceless finds the details in a report that could reveal who wrote it, on the device, before anything is sent, so only text the reporter has reviewed and approved ever reaches the cloud.**

Live app (no sign-up): https://traceless-92f85.web.app · Video: https://youtu.be/8pGeiE8gD4U · Code: Apache 2.0, public repository

## Inspiration

A nurse reports fraud through her hospital's anonymous hotline. The channel does its job: no name, no IP address. Then the compliance officer reads one sentence: _"I'm the only night-shift nurse on Ward 3."_ The hotline hid the sender. The text gave her away.

This is how anonymous reports usually fail. The channel holds; the content leaks. Your role, your shift, "the Tuesday after my surgery", "I was the one who trained the new hire". Each detail is harmless alone. Together they point at one person.

AI could catch those details. That brings a paradox: the text that most needs checking is exactly the text you should never upload. Hybrid inference resolves it, and Traceless is built around that idea.

## What it does

Traceless checks a report for details that could identify the writer before the report leaves your hands.

1. **Write or paste a report** (or load an invented sample). No account needed.
2. **Scan on the device.** Gemini Nano runs inside Chrome. It still works with the internet off; in our demo video we switch the network to Offline first. The badge reads "Checked on your device".
3. **Decide, card by card.** Every finding is a card with a reason and a safer rewrite: Accept, Edit, Keep anyway, or "Not about me" (for details about the accused, not you). There is no "accept all", and nothing changes silently.
4. **Take a second look.** You confirm you re-read the report for details only you would know.
5. **Approve, then the cloud helps.** Only approved text goes to cloud Gemini, which organizes it for the organization: category, summary, when, where. The badge reads "Organized in the cloud — only your approved text".
6. **Send and keep a key.** You get a random case key, shown once, to follow up later at `/case`. You never create an account or give a name.

A "What happened to your text" panel lists every step and where it ran (device or cloud), never the words. It lives in the tab's memory only.

## How we built it

We built it as a chain of problems, each one solved by the next idea.

**Problem: the details that identify you are in the text.** _Solution:_ an AI that reads the report like an investigator would and flags your role, your shift, your dates and your one-of-a-kind experiences.

**Problem: analyzing the report means uploading the most dangerous text you own.** _Solution:_ run that AI on the device. Firebase AI Logic hybrid inference with Gemini Nano in Chrome, mode `ONLY_ON_DEVICE`.

**Problem: we read the SDK's source, and "only on device" wasn't strict.** In the Firebase JS SDK we use (13.3.0), on a browser without the on-device model, `ONLY_ON_DEVICE` quietly fell back to the cloud. Checking `inferenceSource` afterwards is too late, because the text has already left. _Solution:_ three fail-closed locks for raw text:

1. a factory guard that never creates a raw-text model when the browser has no on-device model API;
2. a dead cloud endpoint (`https://on-device-only.invalid`) on raw-text models, so even an SDK regression has nowhere to send the text (the CSP blocks it too);
3. a post-check that throws away any result whose `inferenceSource` is not on-device.

On top of that, the type system enforces the rule. Raw and approved text have different types (`RawText`, `SanitizedText`). Only `approveReport()` creates `SanitizedText`, and cloud adapters accept nothing else, so sending raw text to the cloud doesn't compile.

**Problem: the local model is small.** Our first evaluation asked Nano to do everything. It found about 60% of identifying details (recall 0.604) and wrongly flagged details about the accused person 63% of the time (0.632). _Solution:_ Nano stopped doing everything. Deterministic rules and grammar-based candidates go first, Nano only verifies each candidate, and a second pass plays an HR investigator asking what a colleague could deduce. On a fresh held-out set, recall reached **0.709**, and accused-person errors fell to **0.072**. That is still above our 0.05 target, so every finding is a card the reporter confirms.

**Problem: most people don't have Gemini Nano, and the cloud is better at some jobs.** Nano needs desktop Chrome, about 22 GB of free disk space, and a strong GPU or 16 GB of RAM. Phones and other browsers can't run it. _Solution:_ the hybrid, routed by one policy file (`src/ai/policy/inferencePolicy.ts`). TypeScript rejects a raw-text task with any mode other than `ONLY_ON_DEVICE`.

| Task                               | Mode              | Data                            | Why                                                                 |
| ---------------------------------- | ----------------- | ------------------------------- | ------------------------------------------------------------------- |
| `identityScan`, `disclosureVerify` | `ONLY_ON_DEVICE`  | raw report                      | The most dangerous data never leaves the device                     |
| `structureReport`                  | `PREFER_IN_CLOUD` | approved text only              | The stronger cloud model is fine here; falls back on-device offline |
| `identityScanConsented`            | `ONLY_IN_CLOUD`   | raw, one scan, explicit consent | For devices without Nano, only if the reporter says yes             |

Without Nano, a per-scan consent dialog offers the cloud scan, or a pattern-only check that stays on the device. Judges on any browser can try the full flow.

Firebase products, each with a job:

- **Firebase AI Logic (hybrid inference):** the core. Nano for raw text, cloud Gemini for approved text, `inferenceSource` shown in the UI. `src/infrastructure/ai/aiService.ts`, `modelFactory.ts`, `hybridModel.ts`.
- **App Check:** required by AI Logic; reCAPTCHA Enterprise in production. `src/infrastructure/firebase/appCheck.ts`.
- **Authentication (anonymous):** no account for reporters or judges. The anonymous sign-in happens only when you send a report or look up a case. `src/infrastructure/firebase/anonymousAuth.ts`.
- **Firestore + rules:** stores the approved report. Reporters can create a report and get it by key, but never list, update or delete. `src/infrastructure/firebase/reportSubmit.ts`, `firebase/firestore.rules`.
- **Remote Config:** a kill switch for the cloud scan, plus the acknowledgement (7 days) and feedback (90 days) deadlines from EU Directive 2019/1937. `src/infrastructure/config/RemoteConfigService.ts`.
- **Hosting:** the live app, with a strict CSP. `firebase.json`.

Stack: React, TypeScript, Vite, zod to validate model output, hexagonal architecture. Full diagram: `docs/architecture.md`.

## Challenges we ran into

- **The silent fallback.** Finding it meant reading the SDK source instead of trusting the mode's name. It changed our design from "pick the right mode" to "make the wrong path impossible".
- **A small model on hard prompts.** Nano degrades on long, multi-part instructions, so each call is short and single-purpose, and cheap deterministic layers run first.
- **Stalls.** Some on-device scans hang. A failed or hung scan counts as a miss in our metric. The UI offers recovery and never retries silently.
- **Language.** Nano's supported languages don't include Portuguese, the builder's own language, so the product is English-only for now.

## Accomplishments that we're proud of

- **The hybrid is the product, not decoration.** In the video's final test, the internet is off and the scan still runs. The cloud only appears after the reporter approves the text, and the badge says so.
- **Privacy is enforced by types and fail-closed code, not by a promise.**
- **An honest evaluation.** We wrote a new 22-report held-out set (87 gold spans) with a blind LLM author, committed its hash before touching the detector, and ran it once with unchanged thresholds.
  - Strict recall **0.709** (95% CI 0.642 to 0.784) against a 0.70 target: met, but unstable (worst run 0.655).
  - Wrongly flagging accused people: **0.072** against a 0.05 target: **not met**. This is why every finding needs a click and "Not about me" exists.
  - Soft precision 0.662 (findings that match a gold span without being oversized, out of all findings); median scan 14.3 s.
  - Disclosures: the data is synthetic and LLM-written. The baseline comparison on this split was lost to a stalled run, so detector comparisons rest on the development pool only. One late commit changed rewrite suggestions, not detection.
- **A real test.** A friend tried the live link on their phone. Phones have no Gemini Nano, so they used the consented cloud scan. The full flow (scan, review, approval, sending and case lookup) worked end to end.
- Traceless never claims its list is complete, and never promises anonymity.

## What we learned

"Only on device" is a promise you have to enforce yourself. A small on-device model works best as a verifier over cheap candidates, not as the whole detector. And reporting your own misses builds more trust than a headline number.

## What's next

- Rights advice grounded with Google Search (cloud only, approved text only).
- A triage view for investigators.
- On-device neutralization of writing style.
- More languages as Nano supports them.
- Android with the same SDK.
- Evaluation on real reports, shared with consent.
