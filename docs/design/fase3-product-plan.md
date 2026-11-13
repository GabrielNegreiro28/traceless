# Fase 3+ product plan (accepted 2026-11-13, advisor review)

Source of truth for the reporter UX, the no-Nano path, phase order and visual identity. Detection-quality fixes are decided separately (Fase 2 gate).

## 0. Review decision model

- Decisions per finding: `ACCEPTED | EDITED | KEPT_RISK | NOT_ABOUT_ME`.
- Residual risk = `scoreRisk(pending + KEPT_RISK)`; `NOT_ABOUT_ME` does not count.
- `approveReport` re-runs the rule detector on the final text and blocks only **undecided** direct identifiers. The accused's email can be evidence and must be keepable. A `KEPT_RISK` direct identifier, or MEDIUM/HIGH residual risk, needs explicit acknowledgment.
- `propagateDecision`: "Not about me" on a quote applies to every identical string.
- Optional (coordinated with the detection fix): compose field "Who are you reporting? (stays on this device)" feeding a deterministic suppression of those terms.

## 1. Reporter flow (`src/features/*`, presentational components + one `useX` hook each)

1. **Landing + device check** (one screen): thesis line, three steps, capability card, CTAs "Try a sample report" / "Write a report". States:
   - `available`: "Private mode ready".
   - `downloadable` / `downloading`: "Prepare private AI" with progress, plus "meanwhile, try the sample in cloud mode".
   - `unavailable`: the three options in §2.
2. **Compose**: textarea capped at ~6,000 chars, sample button, demo-org label, "English only for now".
3. **Scanning**: per-chunk progress in `aria-live`: "About 10–20 seconds, running on this computer. Nothing is uploaded."
4. **Review (centerpiece)**:
   - Left: text with `<mark>` highlights.
   - Right: sticky RiskMeter (with explanation) and cards showing category chip, quote, reason, editable suggestion, and origin (on-device AI / pattern rule).
   - Card actions: Accept / Edit / Keep anyway / Not about me, with keys A/E/K/N and auto-advance.
   - **No "Accept all".** "Back to edit" returns to compose and forces a re-scan.
   - Collapsible "Second look" checklist of the 7 categories (covers the recall gap).
   - Copy: "Traceless can miss or misjudge details; you are the final check."
5. **Outbox**: "Only this text will leave your device", the acknowledgment checkbox when required, then `structureReport` shows "What the organization will receive" (category, summary, when, where), editable, with its badge.
6. **Submit**: needs a connection. Offline: "Your report stays in this tab. Reconnect to send."
7. **Case key**: shown once, mono groups of four, copy + download .txt, "I saved my key" gate.
8. **Follow-up `/case`**: enter key, status timeline (7-day / 3-month deadlines), handler messages (read-only for the reporter in P1).

- **Wow moment**: Wi-Fi off, the scan still runs with the on-device badge, the meter drops HIGH → LOW as cards are resolved; reconnect, only the Outbox text is sent, and the handler inbox shows only clean text.
- **Privacy ledger**: session-memory list of `{task, source, dataClass}` with no content (e.g. "Identity scan · on-device · raw text, never left"). No "0 network requests" counter (App Check refresh makes it flaky); DevTools Network in the video is the proof.

## 2. No-Nano path (most judges)

- Build **(b) consented cloud scan**, **(c) enable instructions**, and a small **(a) rules-only check**. **No prerecorded demo mode** (it would simulate the core).
- **(b)** wiring:
  - New use case `consentToCloudScan` is the sole creator of `ConsentedRawText` (ESLint-restricted like `approveReport`).
  - New port `ConsentedIdentityScanner.scan(chunk: ConsentedRawText)`; adapter `ConsentedCloudIdentityScanner` (ONLY_IN_CLOUD, `systemInstruction`, `responseSchema`). Never widen the on-device port to a union. Rules/locate/merge are shared through one internal helper.
  - Two consent levels:
    - Unmodified sample (exact string match): one click, "The sample is fictional, so it is safe to analyze in the cloud".
    - Own text: dialog explaining the risk plus a checkbox; per scan, never persisted.
  - Persistent "Cloud mode (with your consent)" chip and badge.
  - Permissive `safetySettings`; a block maps to a `ContentBlocked` error with friendly copy.
  - Remote Config kill switch `cloud_scan_enabled`.
  - Tests: `@ts-expect-error` RawText into the consented port; no cloud call without a consent object; kill switch honoured.
- **(a)** "Basic private check (patterns only, no AI)" with a third badge variant.
- **(c)** Three flag steps with a copyable URL.
- **Landing copy must not claim unconditional on-device processing**: "Elsewhere, nothing is sent unless you explicitly agree."

## 3. Order and scope

1. **Fase 4**: Firestore rules + tests, anonymous auth at submit, repository (accepts only `SanitizedText` for reporter content), case key, read-only follow-up. No offline-queued submit and no PWA (deviation from PLANO §2/Fase 4; see DECISIONS).
2. **Fase 5a**: `structureReport` via a `createHybridModel` typed to SANITIZED specs only (real `PREFER_ON_DEVICE`, so the badge flips between machines), plus `ConfigService` (Remote Config).
3. **Fase 6 minimal**: one-click demo sign-in, inbox, case detail, reply, status, deadline chips, seed script. Persistent label "Demo organization, public inbox, do not submit real reports". Size caps in rules; App Check enforced on Firestore.
4. **`triageCase`**: ONLY_IN_CLOUD, structured (severity, summary, questions, draft acknowledgment).
5. **Rights advisor** (grounding): 1-hour spike on 19/11. Search grounding seems unavailable on the free tier for Gemini 3+, and its widget conflicts with the CSP. Fallback: a static, sourced "Your rights" panel.

- **Cut order if behind**: rights advisor → reporter replies → `triageCase` → option (a) → handler UI → `structureReport`. **Never cut**: reporter flow, (b), submit + case key, polish, video.
- Before Fase 8, trim `INFERENCE_POLICY` to the tasks that shipped, so the README routing table is true. Keep `cloud_model_name` on `gemini-3.5-flash-lite` (never a 2.5 model).

## 4. Visual identity

- **Tokens**: extend `src/styles/tokens.css` (keep the palette). Add `--tl-color-cloud: #3b5b8c` and soft highlight tints: accent `#e3efe9`, warning `#f6ecd6`, danger `#f9e3e1`, cloud `#e4eaf4`. Add a `tokens.contrast.test.ts` (≥ 4.5:1 for text pairs, both themes).
- **Semantics**: green = on-device / resolved; slate-blue = cloud; neutral = rules; amber = suggestion; red only for direct identifiers.
- **Type**: system stack only, no web fonts (CSP, offline). Scale 14/16/18/24/32; report text at line-height 1.6, max 68ch; `ui-monospace` for the case key.
- **Icons**: `lucide-react` (pinned), 1.5 px stroke; lock, cloud and ruler for the three badges; no emoji in the UI.
- **Logo**: "Traceless" wordmark with the last letters fading in opacity (CSS); SVG "T" favicon.
- **Voice**: calm second person; "reduces the risk", never "guarantees anonymity".
- **Accessibility**: WCAG 2.2 AA; full keyboard flow; 2 px `:focus-visible` ring; highlights never by color alone (underline style + label); `role="meter"` with `aria-valuetext`; `aria-live="polite"` for scan and risk changes; native `<dialog>`; `prefers-reduced-motion`; usable at 360 px; one axe pass per screen in Playwright.

## 5. Dated tasks (serial implementers; opus reviewer after each)

| Date     | Task                                                                                                                   | Model                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 13–14/11 | Domain tasks with the §0 amendment                                                                                     | opus                      |
| 13–14/11 | UI kit (`src/ui`), tokens, shell, router, `ServicesProvider`                                                           | sonnet                    |
| 14/11    | Compose, scanning and review on fakes + component tests; detection fix interleaved (timebox 16/11)                     | sonnet (UI), opus (fix)   |
| 15/11    | Onboarding states, real wiring, Outbox, ledger; deploy v0.1. Human: Wi-Fi-off test on the hosted link                  | opus                      |
| 16/11    | No-Nano path (adversarial review); deploy; verify in a flagless profile and in Edge                                    | opus, higher effort       |
| 17/11    | Fase 4 core. Human: enforce App Check on Firestore                                                                     | opus                      |
| 18/11    | Follow-up page, static rights panel, E2E on fakes in CI; deploy v0.2; Fable gate                                       | sonnet                    |
| 19/11    | `structureReport` + Remote Config; 1-hour grounding spike                                                              | sonnet, haiku, opus       |
| 20/11    | Handler minimal + seed. Human: 2–3 testers, three tasks, collect quotes                                                | opus (rules), sonnet (UI) |
| 21/11    | `triageCase`, finish handler; deploy v0.3, feature complete                                                            | sonnet                    |
| 22/11    | Tester fixes; every error, empty, offline and blocked state; responsive                                                | sonnet                    |
| 23/11    | Polish: landing, logo, dark mode, copy, accessibility                                                                  | sonnet                    |
| 24/11    | Full E2E, production CSP console check, Fable pre-freeze audit. Human: dry-run recording                               | sonnet                    |
| 25/11    | Freeze. README, `docs/architecture.md`, ADRs 0001–0004, trimmed policy table, screenshots                              | sonnet, haiku             |
| 26/11    | Video script (Fable review), human records, Devpost draft                                                              | sonnet                    |
| 27/11    | Edit, captions, upload; repo hygiene (Portuguese docs with personal details), secret scan; human makes the repo public | haiku, human              |
| 28/11    | Submit complete draft; Fable final audit                                                                               | fable                     |
| 29–30/11 | Buffer; final submit by midday 30/11                                                                                   | —                         |
