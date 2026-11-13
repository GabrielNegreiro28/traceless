# CLAUDE.md — Traceless

Project: **Traceless**, the #BuildHybridAI hackathon entry (deadline 2026-11-30). Full context (participant, rules, Firebase AI Logic constraints, best practices) is in HACKATHON.md, imported below. The approved architecture and execution plan is in `PLANO.md` — read the relevant sections before any implementation task.

- Autonomous workflow: the manager follows `.claude/manager/PROTOCOL.md`; agents live in `.claude/agents/`.
- Progress & records: `docs/progress/STATUS.md`, `docs/progress/HUMAN_TODO.md`, `docs/progress/DECISIONS.md`, ADRs in `docs/adr/`.
- Talk to the owner in **Portuguese**; everything judges see (code, UI, README, commits) in **English**.

## Engineering rules (apply to all code)

1. **Hexagonal architecture**: `src/domain` is pure (no React, Firebase or DOM). Use cases depend on ports (interfaces) in `src/application/ports`. Firebase/Gemini live in `src/infrastructure` adapters. `src/features` (UI) never imports `src/infrastructure` — services come from the composition root via `useServices()`.
2. **Single responsibility**: one job per function (~≤40 lines), one concept per file (~≤200 lines). No "do-everything" functions.
3. **Privacy by types**: `RawText` vs `SanitizedText` branded types. Cloud adapters accept only `SanitizedText`, created solely by `approveReport()`. RAW tasks use `InferenceMode.ONLY_ON_DEVICE` — never `PREFER_ON_DEVICE` (silent cloud fallback is a privacy bug).
4. **Central inference policy**: task → mode → data class lives only in `src/ai/policy/inferencePolicy.ts`. Every on-device model declares `expectedInputs`/`expectedOutputs` with `languages: ["en"]`.
5. **Explicit errors**: `Result<T, AppError>`; adapters map exceptions to `AppError`; validate model output with zod.
6. **Never log raw report text**; use `src/shared/logger.ts`, not `console`. No analytics/localStorage of report content.
7. **Tests with the code**: deterministic unit tests for domain, fake-model adapter tests, component tests, Firestore rules tests, E2E with fake AI.
8. **Reproducible**: exact versions, committed lockfile, `.env.example`, infra as code under `firebase/`, scripts in `package.json`, CI runs from `npm ci`.
9. **Never delete files or folders, never send messages/emails, never commit secrets, never change repo visibility or force-push, never edit `.claude/settings*.json`.**

@HACKATHON.md
