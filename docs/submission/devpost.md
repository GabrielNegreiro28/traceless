# Traceless

**For whistleblowers, Traceless finds the details in a report that could reveal who wrote it, on the device, before anything is sent, so only text the reporter has reviewed and approved ever reaches the cloud.**

Live app (no sign-up): https://traceless-92f85.web.app · Video: https://youtu.be/8pGeiE8gD4U · Code: Apache 2.0, public repository

## Inspiration

A nurse reports fraud through her hospital's anonymous hotline. The channel does its job: no name, no IP address. Then the compliance officer reads one sentence:

> _"I'm the only night-shift nurse on Ward 3."_

The hotline hid the sender. The text gave her away.

That is how anonymous reports fail. The channel holds and the content leaks. Your role, your shift, "the Tuesday after my surgery", "I was the one who trained the new hire". Each detail is harmless on its own. Together they point at one person. In the EU alone, Directive 2019/1937 requires organizations with 50 or more workers to run an internal reporting channel. Every one of those channels protects the sender, and none of them checks whether the report gives the sender away.

AI could catch those details. But it brings a paradox:

> **The text that most needs checking is exactly the text you should never upload.**

Sending a report to a cloud AI to ask "does this identify me?" is already the leak. That paradox is why Traceless exists, and why it has to be hybrid.

## What it does

Traceless checks a report for details that could identify the writer before the report leaves their hands.

1. **Write or paste a report**, or load an invented sample. No account needed.
2. **The scan runs on the device.** Gemini Nano inside Chrome reads the raw text. It works with the internet off: in the video's final test we set the network to Offline before scanning. The badge says **"Checked on your device"**.
3. **The reporter decides, card by card.** Each finding comes with a reason and a safer rewrite: _Accept_, _Edit_, _Keep anyway_, or _Not about me_ (for details about the accused, not the writer). There is deliberately no "accept all", and nothing changes silently.
4. **A second look.** The reporter confirms they re-read the report for details only they would know.
5. **Only then does the cloud help.** Cloud Gemini organizes the approved text into a category, summary, when and where for the organization. The badge says **"Organized in the cloud — only your approved text"**.
6. **Send, keep a key.** The reporter gets a random case key, shown once, to check the status later at `/case`. No name and no account are ever needed.

A **"What happened to your text"** panel lists every step and where it ran (device or cloud), never the words themselves, and it lives in the tab's memory only.

## How we built it

We built Traceless as a chain of problems, each one solved by the next idea. The demo video tells the same chain.

### 1. The details are in the text → an AI that reads like an investigator

Identifying details are not names and emails, so regex-based PII redaction misses them. What gives a whistleblower away is a **quasi-identifier**: a unique role, a shift, a date tied to a personal event. Traceless looks for these.

### 2. Analyzing means uploading → run it on the device

We used **Firebase AI Logic hybrid inference** with Gemini Nano in Chrome. Every raw-text task uses `InferenceMode.ONLY_ON_DEVICE`, with `expectedInputs`/`expectedOutputs` declared as English.

### 3. "Only on device" wasn't strict → three fail-closed locks

We read the SDK source. In the Firebase JS SDK version we use (13.3.0), on a browser without the on-device model, `ONLY_ON_DEVICE` quietly fell back to the cloud. Checking `inferenceSource` after the call is too late, because the text has already left. So raw text goes through three locks:

1. **Factory guard:** a raw-text model is never created if the browser has no on-device model API.
2. **Dead endpoint:** raw-text models point their cloud URL at `https://on-device-only.invalid`, and the CSP blocks it as well. Even an SDK regression has nowhere to send the text.
3. **Post-check:** any result whose `inferenceSource` is not on-device is discarded.

Then we made the rule a **type**. Raw and approved text are different branded types, `RawText` and `SanitizedText`. Only `approveReport()` can create a `SanitizedText`, and cloud adapters accept nothing else:

```ts
// Cloud adapters only accept approved text: passing RawText is a compile error.
structure(text: SanitizedText): Promise<Result<StructureOutcome, AppError>>; // src/application/ports/ReportStructurer.ts
```

So sending raw text to the cloud doesn't compile.

### 4. The local model is small → Nano stops doing everything

Our first version asked Nano to do the whole job. It found about 60% of identifying details and wrongly flagged details about the _accused_ 63% of the time. So we split the work into a cascade:

$$
\underbrace{\text{rules}}_{\text{deterministic}} \;\rightarrow\; \underbrace{\text{grammar candidates}}_{\text{cheap, high recall}} \;\rightarrow\; \underbrace{\text{Nano verifies}}_{\text{short, single-purpose prompts}} \;\rightarrow\; \underbrace{\text{"HR investigator" pass}}_{\text{what could a colleague deduce?}}
$$

Each Nano call is short and has one purpose, and every output is validated with zod.

### 5. Most people don't have Nano → the hybrid

Nano needs desktop Chrome, about 22 GB of free disk space, and a strong GPU or 16 GB of RAM. Phones and other browsers can't run it, and the cloud is simply better at some jobs. Every route lives in **one policy file**, `src/ai/policy/inferencePolicy.ts`, and TypeScript rejects a raw-text task with any mode except `ONLY_ON_DEVICE`:

| Task                               | Mode              | Data                            | Why                                                                 |
| ---------------------------------- | ----------------- | ------------------------------- | ------------------------------------------------------------------- |
| `identityScan`, `disclosureVerify` | `ONLY_ON_DEVICE`  | raw report                      | The most dangerous data never leaves the device                     |
| `structureReport`                  | `PREFER_IN_CLOUD` | approved text only              | The stronger cloud model is fine here; falls back on-device offline |
| `identityScanConsented`            | `ONLY_IN_CLOUD`   | raw, one scan, explicit consent | For devices without Nano, only if the reporter says yes             |

Without Nano, a per-scan consent dialog offers the cloud scan, or a pattern-only check that stays on the device. So judges on any browser can try the full flow.

### Firebase, used with a purpose

- **Firebase AI Logic (hybrid inference):** the core. Nano for raw text, cloud Gemini for approved text, and `inferenceSource` shown in the UI as a badge. See `src/infrastructure/ai/`.
- **App Check:** required by AI Logic; reCAPTCHA Enterprise in production.
- **Anonymous Authentication:** no account for reporters or judges. The anonymous sign-in happens only at send time or when looking up a case.
- **Firestore + security rules:** stores the approved report. Reporters can create a report and get it by key, but never list, update or delete.
- **Remote Config:** a kill switch for the cloud scan, plus the acknowledgement (7 days) and feedback (90 days) deadlines from the EU Directive.
- **Hosting:** the live app, with a strict Content Security Policy.

The rest of the stack is React, TypeScript and Vite with a hexagonal architecture: a pure domain, use cases behind ports, and Firebase only in adapters. Unit, component, Firestore-rules and end-to-end tests run in CI from `npm ci`.

The case key is 128 random bits. Guessing someone else's key has a probability of

$$
P(\text{guess}) = 2^{-128} \approx 2.9 \times 10^{-39},
$$

so the key itself is the only credential, and no identity is needed.

## Challenges we ran into

- **The silent fallback.** Finding it meant reading the SDK source instead of trusting the mode's name. It changed our design question from "pick the right mode" to "make the wrong path impossible".
- **Measuring honestly.** A finding $f$ counts as matching a gold span $g$ when

  $$
  \frac{|f \cap g|}{\min(|f|, |g|)} \ge 0.5,
  \qquad
  \text{recall} = \frac{\#\{\text{gold spans matched}\}}{\#\{\text{gold spans}\}}.
  $$

  The hard part was not the formula. It was resisting the urge to tune on the test set. We wrote a fresh held-out set of 22 reports (87 gold spans) with a blind LLM author, committed its hash before touching the detector, and ran it once.

- **The accused-person problem.** A report is full of details about the wrongdoer, and flagging those as "identifying you" is worse than useless. That is why _Not about me_ exists.
- **Stalls.** Some on-device scans hang. A hung scan counts as a miss in our metric, and the UI offers recovery without ever retrying silently.
- **Language.** Nano's supported languages don't include Portuguese, the builder's own language, so Traceless is English-only for now.

## Accomplishments that we're proud of

- **The hybrid is the product, not decoration.** With the internet off, the scan still runs. The cloud appears only after the reporter approves, and the UI says so.
- **Privacy enforced by types and fail-closed code, not by a promise.**
- **Numbers we didn't polish.** On the held-out set, run once with unchanged thresholds:
  - Strict recall: **0.709** (95% CI 0.642 to 0.784), against a 0.70 target. Met, but unstable: the worst run was 0.655.
  - Wrongly flagging accused people: **0.072**, against a 0.05 target. **Not met.** That's why every finding needs a click.
  - Soft precision: 0.662. Median scan time: 14.3 s.
  - Disclosures: the data is synthetic and LLM-written. A baseline comparison on this split was lost to a stalled run. One late commit changed rewrite suggestions, not detection.
- **A complete product, not a demo.** It covers onboarding with an invented sample, a consent dialog, keyboard shortcuts on the review cards, a privacy ledger, case lookup, and recovery states. A friend tried the live link on their phone (no Nano, so the consented cloud scan), and the full flow worked end to end: scan, review, approval, sending and case lookup.
- Traceless never claims its list is complete, and never promises anonymity.

## What we learned

- **"Only on device" is a promise you have to enforce yourself.** Read the source, then make the unsafe path fail to compile.
- **A small on-device model is a great verifier and a poor detector.** Cheap deterministic candidates plus a short, focused Nano check beat one big prompt.
- **Hybrid works best as a data policy, not a performance trick.** The question isn't "which model is faster?" but "which data is allowed to go where?"
- **Reporting your own misses builds more trust than a headline number.**

## What's next

- Rights advice grounded with Google Search (cloud only, approved text only).
- A triage view for investigators.
- On-device neutralization of writing style.
- More languages as Nano supports them.
- Android with the same SDK.
- Evaluation on real reports, shared with consent.
