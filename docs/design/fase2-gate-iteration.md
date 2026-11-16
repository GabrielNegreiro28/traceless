# Fase 2 gate — iteration plan after the first real eval (2026-11-13)

Decision: **ITERATE, no pivot** (advisor review of `eval/results/identityScan.v1-single-*`). Implementer briefs must use **dev examples only** (r01–r08); never copy test-split text (r09–r24) into prompts, few-shots or briefs.

## What v1 showed (test 16×3, pooled)

- Infrastructure is sound: 0 invalid output, 0 scan failures, oversized 0.004, latency p50 ≈ 7 s.
- **ACCUSED violations (0.63)** are one structured failure. Nano types entities but does not attribute a subject: the accused's title becomes ROLE_UNIQUE and the name DIRECT_IDENTIFIER, mostly at the "[title], [Name]" introduction. Repeats and the accused's own schedule or place make up the rest. Instructions alone did not fix it, so the output space must change.
- **Recall (0.60)** is lost to under-generation and position bias. Runs stop early, nearly every report gets a finding at offset 0, and the v1 few-shot puts all of its findings in the first two sentences. The long report scores far below the short ones. The union of 3 runs reaches ≈ 0.77, so a second pass can plausibly buy the gap.
- Recall by category, weakest first: SCHEDULE 0.41, PERSONAL_TRAIT 0.50, PERSONAL_EVENT_DATE 0.60, TEAM_SIZE 0.67, ROLE_UNIQUE 0.69, LOCATION 0.76, DIRECT_IDENTIFIER 0.76.
- Keyword triggers cause false positives:
  - any number → TEAM_SIZE;
  - timing of the wrongdoing → SCHEDULE;
  - badge/login/account → DIRECT_IDENTIFIER;
  - the first-sentence role is always ROLE_UNIQUE, even for common jobs.
- Zero-gold reports are never left empty.
- Implicit cues (e.g. "it passes through my hands") are missed: documented limitation.
- Metric artifacts, disclosed and not fixed (the test set is frozen): one gold identifier is scored as a miss at 0.45 overlap, costing ≈ 1.9 recall points; one ACCUSED overlap at 0.37 is not counted.

## B. ACCUSED fix: outlet labels + deterministic protected mentions

1. **Schema**:
   - `OUTLET_LABELS = ['REPORTED_PERSON','OTHER_PERSON']`.
   - `buildIdentityScanSchema(categories, outlets = [])` builds the enum from categories + outlets.
   - `parseIdentityScanOutput(text, allowed, outlets)` returns `{ findings, protectedQuotes }`. Outlet items never become findings, and the domain `FindingCategory` is unchanged.
   - With `outlets = []` the v1 path stays byte-identical, so v1 remains reproducible.
2. **Port**: `IdentityScanResult.protectedQuotes: readonly string[]`. It is raw text: never log or persist it.
3. **Domain (pure)**:
   - `protectedMentions.ts`:
     - `buildProtectedTerms(quotes)` keeps the full quote and its name tokens. It strips Mr/Ms/Mrs/Dr/Professor/Coach and keeps capitalised tokens of 3+ chars.
     - `suppressProtected(text, modelFindings, terms)` returns `{ kept, suppressed, protectedSpans }`. It drops a MODEL finding when a protected-term occurrence covers ≥ 50% of it, or when it contains a protected name token and no first-person singular token.
   - `thirdPersonFilter.ts`: drops MODEL findings that start with He/She/They and contain no first-person singular token.
   - Safety: **never** suppress RULE findings, and never suppress a finding containing I, I'm, I've, me, my or myself.
   - **Narrowed after the T2 review (2026-11-13):**
     - Name tokens are only the tokens after an honorific or job title ("Site Manager Gary Holt" gives Gary, Holt), or the last 1–2 tokens of the quote's final capitalised run (the "[title], [Name]" introduction). A run with a place, organisation or department word ("Riverside Depot", "Ward 7") gives none, and ALL-CAPS acronyms are never names.
     - Name tokens suppress a finding only when the finding **opens** with them: its leading capitalised run (after an optional honorific) must be made only of protected name tokens ("Wade had…", "Mr. Wade knows…"). An unprotected capitalised token ("Tom Alvarez works…") or a place word ("Jordan Street branch…") in that run keeps the finding. A name elsewhere in the finding does not count. Coverage ≥ 50% is measured against occurrences of the full protected quotes only.
     - A protected quote containing a first-person singular token is ignored entirely.
     - The third-person filter also keeps findings with a first-person plural token (we, us, our, ours, ourselves), e.g. "They put only two of us on the desk".
   - **Known limitations:**
     - Shared surname: a writer finding that starts with a surname shared with a protected person is suppressed (protected "Dr. Patel", writer finding "Patel, the only nurse on the ward"). It is rare, and the writer's first-person sentences are always kept.
     - Shared first name: likewise, a writer finding whose leading run is only a first name shared with a protected person is suppressed (protected "Supervisor Lena Ortiz", writer finding "Lena and the night porter are the only two"). Same mitigation as above.
     - Sign-off rule: a bare one-word name after a blank line ("\n\nMarco") is a known miss, because it can't be told apart from an ordinary word. The model may still catch it.
4. **scanReport**:
   - Collect `protectedQuotes` from all chunks first, then filter, so chunk 1's introduction protects chunk 2's bare name.
   - Return `protectedSpans` (used for Fase 3 "Kept: who you're reporting" chips) and `stats.suppressed`.
5. **Plan C** (only if filtered dev ACCUSED stays > 0.15): one batched `subjectCheck` call per chunk classifying each candidate quote WRITER/REPORTED/OTHER with an enum array.

## C. Recall fix

1. **`identityScan.v2.ts`** (v1 untouched; inject the prompt builder into `OnDeviceIdentityScanner`). New lines:
   - a name is DIRECT_IDENTIFIER only if it is the writer's own (my name is, call me, sign-off); every other name is REPORTED_PERSON or OTHER_PERSON;
   - a common job is not ROLE_UNIQUE;
   - TEAM_SIZE = the writer's own team only;
   - SCHEDULE = when the writer works, not when the wrongdoing happened;
   - DIRECT_IDENTIFIER excludes accounts, logs and badges of others;
   - "Read to the end; the last sentences and the sign-off count";
   - quotes of 2–8 words.
2. **Three few-shots**, disjoint from the dataset (prefix limit ≈ 5,000 chars):
   - (i) a medium report with writer details mid-text and a sign-off at the end; the accused's title and name as REPORTED_PERSON, a colleague as OTHER_PERSON; an unflagged count and an unflagged timing of the wrongdoing;
   - (ii) a third-person report whose only items are REPORTED_PERSON;
   - (iii) a lowercase run-on report with a common role left unflagged and the writer's schedule in the last sentence.
3. **Second pass**: `STRATEGIES.single2 = [ALL, ALL]`; compare it with `grouped2`.
4. **Sign-off rule** (deterministic, origin RULE, DIRECT_IDENTIFIER):
   - Trigger: a final short line (≤ 5 words) after a blank line or a cue (Regards/Signed/Sincerely/Best/Thanks/dash) containing a non-initial capitalised token or initials. Dev example: "Jorge M., picker".
   - Hard negatives: "Thank you.", "Please investigate."
   - The rules-only baseline must keep RULE violations at 0.
5. **Chunk size** stays 3,000. Try 1,500 only if long-report recall is still the outlier after v2.

## D. Final thresholds (pre-registered 2026-11-13, before any v2 data)

Measured on the shipping pipeline with no user input; raw-model numbers are reported alongside.

| Gate            | Threshold      |
| --------------- | -------------- |
| strictRecallAll | ≥ 0.70         |
| ACCUSED         | ≤ 0.05         |
| INCIDENT_FACT   | ≤ 0.10         |
| invalid output  | ≤ 0.05         |
| scan failures   | ≤ 0.05         |
| oversized       | ≤ 0.25         |
| softPrecision   | ≥ 0.35 (new)   |
| latencyP50Ms    | ≤ 20,000 (new) |
| latencyMaxMs    | ≤ 60,000 (new) |

- **ACCUSED between 0.05 and 0.15** = conditional go: ship only with the protected-chips confirmation in the review UI and the real number in the README. **> 0.15** = fail → Plan C before Fase 3 review work.
- DIRECT_IDENTIFIER is not numerically gated (n = 21); every miss is listed and reviewed at the gate.

## E. Experiment plan

- **13/11:** T1, then T2 (no owner click).
- **14/11, session B:** the owner clicks "Dev matrix" (~30 min unattended). Each variant runs dev ×3, saved raw and post-filtered:
  - M0 v1/single;
  - M1 v2/single;
  - M2 v2/grouped2;
  - M3 v2/single2.
- **Decision rules (dev, pooled ×3):**
  - Pick the cheapest variant with recall ≥ 0.72, ACCUSED ≤ 0.05, INCIDENT_FACT ≤ 0.10, softPrecision ≥ 0.35 and p50 ≤ 20 s.
  - Multi-pass must beat M1 by ≥ 8 points; on a tie, take `single2`.
  - Raw ACCUSED > 0.25 or filtered 0.05–0.15 → v3 with a `subject` field.
  - INCIDENT_FACT > 0.10 → v3 adds a `WHAT_HAPPENED` outlet.
  - Recall < 0.72 everywhere → `single3` or chunk 1,500.
- **14–15/11, session C:** only if v3 is needed, one dev ×3 run.
- **15/11, session D:** the chosen variant on test ×3, **once**. No tuning afterwards; then the gate consult.

## F. Implementer tasks (serial)

- **T1 (sonnet):**
  - `scripts/eval-inspect.mjs` + `npm run eval:inspect -- <file>`: per report, prints each finding's quote, category, origin and label (GOLD hit / ACCUSED / INCIDENT_FACT / OTHER_PERSON / unannotated), plus missed gold. Stdout only, synthetic data only.
  - Variant registry and `dev3` / `devMatrix` presets.
  - The result JSON records `variant { promptVersion, strategy, chunkChars, postFilters }` and both the raw and filtered views (spans and labels only, never quote text).
  - New gate criteria.
- **T2 (opus, opus review):** B.1–B.4 and C.1–C.4 with tests:
  - parser separates outlets; v1 parity;
  - JSON-schema/zod enum parity including outlets;
  - protectedMentions: honorifics, cross-chunk propagation, never suppresses RULE or first-person findings, multi-occurrence;
  - thirdPersonFilter hard cases;
  - sign-off rule positives and negatives;
  - scanReport with `protectedQuotes`;
  - few-shots disjoint from the dataset.
  - The reviewer checks conservative suppression, no test-set leakage and v1 reproducibility.

## G. Round 2 after the dev matrix (pre-registered 2026-11-13, before any data on the final variant)

**Dev matrix (dev ×3, pooled, filtered):** v1-single recall 0.581 / ACCUSED 0.500; v2-single 0.476 / 0.033; v2-grouped2 0.276 / 0.000; v2-single2 0.571 / 0.083 (precision 0.72, p50 10.5 s, max 38.3 s). No variant reaches recall 0.72. Misses are plain first-person phrases.

**G.1 Product default now:** `v2-single2` (dominates v1 on precision and ACCUSED at equal recall within noise). Recorded as a default by dominance, not a gate pass; the final default is whichever variant goes to the test split.

> **Note 2026-11-16:** the shipped default is now `v2-single2-rules` (`v2-single2` plus the deterministic first-person rule pack). The gate outcome was ship-with-disclosed-miss; see DECISIONS 2026-11-16.

**G.2 Stuck recovery first** (one stall currently poisons every later scan, and reload destroys the in-memory draft):

- One AbortController per memoized on-device model; its signal goes in `createOptions.signal`. `OnDeviceModel.abandon()` aborts and drops the cache entry; the next call builds a fresh model through the same factory (fail-closed layers intact).
- On deadline: `abandon()`, keep `holdUntilSettled`, return `OnDeviceStuck { recoverable: true }`. Cap: 2 recoveries per page load, or work unsettled 5 s after abort → `recoverable: false`. No auto-retry. Timeout stays 120 s.
- UI: recoverable → "On-device AI stalled. Try again" (text kept). Terminal → "Continue with basic checks" (rules + Second look) or reload with "Copy my text".
- Eval: a stalled report counts as a scan failure, the matrix continues, the result file records the recovery count.

**G.3 First-person rule pack** (`src/domain/detection/firstPersonRules.ts`, pure, origin RULE), frozen design:

- Families: (1) "I am / I'm the only <NP>" → ROLE_UNIQUE; (2) "one of (two…twelve | N) <plural noun>" with a first-person anchor → TEAM_SIZE; (3) "I('ve| have) (worked|been) … for N (years|months)" → PERSONAL_TRAIT; (4) first-person + work verb (work, cover, start, finish, am on, rostered) + shift/day/time term → SCHEDULE; (5) "(when|after|since) I (came back|returned|started|was hired|was promoted|joined)" → PERSONAL_EVENT_DATE; (6, probation) "my/our <specifying modifier> <workplace place noun>" → LOCATION (bare "our office" never fires).
- Lexicons: closed, general lists only (number words 2–12, weekdays, shift terms, employment events, leave types, workplace place nouns). After dev measurement only deletions or tightening; never an addition motivated by a dev miss. Diffs logged.
- Anchor: every match needs I/my/me/we/our/us inside the span or earlier in the same clause. Spans 2–8 words.
- The implementer gets no dataset text and does not open `eval/datasets`. Unit corpus is invented and passes the few-shot disjointness check. Twin test: swapping I→He/She, my→his, our→their in every positive fires zero times; ≥ 40 invented hard negatives.
- Precision guard (vitest, rules-only baseline, **dev split only**): 0 ACCUSED, 0 INCIDENT_FACT, 0 OTHER_PERSON; per-family precision ≥ 0.75 when a family fires ≥ 3 times. A failing family is dropped whole. One fix round for span-boundary bugs only. The existing whole-dataset RULE-violation assertion is restricted to dev (a deterministic whole-dataset test leaks test-split feedback).
- `ScanVariantSpec.rulePack: 'core' | 'core+firstPerson'`, included in `variantKey`. Merger: RULE+MODEL overlap keeps origin RULE, prefers the model's suggestion. README reports rules-only and model-only recall separately.

**G.4 Next owner click:** dev ×3 for `v2-single2+rules` and `v2-single3+rules`.

- Take single3+rules only if it beats single2+rules by ≥ 0.05 recall, max latency ≤ 50 s and dev ACCUSED ≤ 0.10; otherwise single2+rules.
- Guards: dev softPrecision ≥ 0.60; ACCUSED not above pre-rules single2 by more than one event. On failure drop the offending family; no re-run.
- Then the chosen variant on test ×3, **once**, even if dev recall < 0.72 (dev budget spent). If the run dies for infrastructure reasons, restart once from scratch without viewing partial metrics.

**G.5 Test outcomes (thresholds in §D unchanged):**

| Test result                                                                               | Outcome                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| All §D gates pass                                                                         | GO                                                                                                                                                                                                            |
| ACCUSED 0.05–0.15                                                                         | Conditional go (§D)                                                                                                                                                                                           |
| Recall 0.55–0.70, other gates pass, ACCUSED ≤ 0.15                                        | **Ship with disclosed miss**: gate recorded NOT MET; README/Devpost print target and measured numbers; UI never implies completeness; Second look becomes a required step before the Outbox; detection frozen |
| Recall < 0.55, or ACCUSED > 0.15, INCIDENT_FACT > 0.10, precision < 0.35, failures > 0.05 | Consult before more Fase 3 work; Plan C if ACCUSED                                                                                                                                                            |

Rationale for the asymmetry: a wrong flag on the accused silently damages the report; a miss is covered by the human checklist. The README states the test split was run twice (v1 failed; final pipeline).
