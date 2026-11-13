# Evaluation datasets

## `reports.v1.json`

24 synthetic, first-person whistleblower reports in English, each annotated with the details that could reveal **who wrote it** (`gold`) and the details that must **not** be flagged (`mustNotFlag`). The evaluation harness (`docs/design/fase2-ai-layer.md` §4) uses it to measure the identity scan: recall on `gold`, and the violation rate on `mustNotFlag`, split by kind and by origin (rules or model).

### Format

```json
{
  "version": "reports.v1",
  "reports": [
    {
      "id": "r01",
      "sector": "hospital",
      "split": "dev",
      "text": "...",
      "gold": [{ "quote": "...", "category": "ROLE_UNIQUE", "occurrence": 1 }],
      "mustNotFlag": [{ "quote": "...", "kind": "ACCUSED", "occurrence": 1 }]
    }
  ]
}
```

- Annotations are **quotes**, not offsets. They are resolved to spans at load time.
- A quote without `occurrence` appears exactly once in `text`. With `occurrence: n`, it refers to the n-th match (1-based).
- Quotes are 2 to 12 words and copied verbatim. The text uses only straight ASCII quotes and apostrophes.
- Within a report, no `gold` span overlaps another `gold` or `mustNotFlag` span.

### Annotation guidelines

**Gold: details about the writer** (the person saying I, me, my) that narrow down who they are:

| Category              | Meaning                                                                                          | Example from the dataset                    |
| --------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `ROLE_UNIQUE`         | A job, title or duty that only one or very few people have                                       | "the only GIS analyst in the department"    |
| `SCHEDULE`            | The writer's shift, hours, or the days they are present or absent                                | "I'm on the 4 a.m. split shift"             |
| `LOCATION`            | The writer's desk, room or post, or where they were when they saw it                             | "at the far end of the B concourse"         |
| `PERSONAL_EVENT_DATE` | When the writer's own events happened: hiring, leave, surgery, or a meeting only they attended   | "the week I came back from paternity leave" |
| `PERSONAL_TRAIT`      | The writer's age, gender, nationality, language, health, visa status or tenure                   | "I am the only Portuguese speaker"          |
| `TEAM_SIZE`           | How small the writer's group is                                                                  | "a lab crew of three"                       |
| `DIRECT_IDENTIFIER`   | The writer's own name, initials, nickname, username, employee or badge ID, email or phone number | "Badge number 3318", "call me Big Tom"      |

When a phrase mixes two signals, it is split into separate quotes, one category each. For example, "I run the quality lab" is `ROLE_UNIQUE` and "on second shift" is `SCHEDULE`. A phrase that merely places the writer in a large, common role ("I'm a dispatcher at a regional trucking company") is not gold.

**Must not flag: details the report needs in order to be useful:**

- `ACCUSED`: the name and title of the person being reported, and the accused's own schedule, location and actions. These are hard negatives, for example "He always leaves the night shift early" or "in his office by the shipping dock".
- `INCIDENT_FACT`: what happened. This covers amounts, documents, systems, counts, and the timing of the wrongdoing described in words ("On the early morning departures", "usually right before close").
- `OTHER_PERSON`: names or descriptions of third parties (colleagues, victims, inspectors).

Explicit calendar dates are **never** annotated as `mustNotFlag`, because the deterministic rules flag every explicit date by design. To keep the dataset fair to that design choice, incident timing is written in words. Spans that are neither clearly gold nor clearly must-not are left unannotated (for example, "the surgical supply room on the fourth floor", where the incident happened). A finding on an unannotated span does not affect recall or the gate, but it lowers soft precision. So any gold the annotation misses makes precision look worse than it really is.

Every mention of the accused is annotated as `ACCUSED`, including later short references ("Wade had", "the director's office", a second "the assistant principal" via `occurrence`). Pronouns ("he", "her office") are not annotated.

### Composition

- **Split:** 8 `dev` (r01 to r08) for prompt iteration, and 16 `test` (r09 to r24) for the gate. The test split is never used to tune prompts, so the gate measures generalization rather than memorization.
- **Zero-gold reports:** r04, r11, r17 and r22 are well-anonymized reports. They measure false positives on clean text. r17 is written in the first person, but only about a common role in a large department ("I'm an adjuster in the property claims department ... I review these files every day").
- **Long reports:** r06 (dev) and r19 (test) are longer than 3,000 characters, so they span more than one model chunk (`MODEL_CHUNK_CHARS`). Both have gold in every chunk. In r19, the second chunk holds only the final paragraph, which contains the writer's age. The other reports are roughly 500 to 1,300 characters.
- **Style:** a mix of formal, plain, and emotional run-on writing without capitalization.
- **Coverage (reports / quotes):**

  | Category            | Reports | Quotes |
  | ------------------- | ------- | ------ |
  | ROLE_UNIQUE         | 13      | 18     |
  | SCHEDULE            | 10      | 16     |
  | LOCATION            | 10      | 11     |
  | PERSONAL_EVENT_DATE | 8       | 12     |
  | PERSONAL_TRAIT      | 10      | 15     |
  | TEAM_SIZE           | 5       | 5      |
  | DIRECT_IDENTIFIER   | 11      | 11     |

  There are 88 gold quotes in total. On the must-not side there are 49 `ACCUSED`, 86 `INCIDENT_FACT` and 15 `OTHER_PERSON` quotes.

- **Direct identifiers:** across the whole dataset, 5 identifiers can be caught by the deterministic rules: r03 (employee ID), r07 (phone), r08 (email), r16 (badge number) and r21 (email). In the test split, only r16 and r21 can be caught by rules. The other 5 test `DIRECT_IDENTIFIER`s can only be caught by the model: r09 (initials), r12 (signature), r14 (username), r18 (first name) and r23 (nickname).
- The dataset does not overlap with the prompt's few-shot examples (`src/ai/prompts/identityScan.v1.ts`).

### Known limitations

- **Synthetic.** The reports were written for this evaluation. All people, organizations and places are invented. Real reports are messier, longer and less evenly distributed across categories.
- **English only**, matching the on-device model's `languages: ["en"]` configuration.
- **Single annotator, with no inter-annotator agreement.** Boundaries between categories are sometimes debatable, for example a language trait that also makes a role unique. That is why metrics are reported both category-agnostic and per category.
- **Dev and test share templates.** Some reports follow the same pattern, for example r03 and r21 (a formal report with a small team and a sign-off identifier), the "only speaker of language X" trait (r05, r19), and overnight-shift patterns (r01, r19). Results that improve on dev may transfer to test more easily than they would to new reports.
- **Cues are mostly explicit.** Identifying details are usually spelled out ("the only X", "a team of three"). Real reports more often identify the writer through indirect combinations of details, so measured recall is likely optimistic.
- **Small.** With 16 test reports, one report can move per-category recall by a large step. Read the per-category numbers as signals, not precise estimates.
- **No `WRITING_STYLE` gold.** That category belongs to the separate style-neutralization task, not to the identity scan.
