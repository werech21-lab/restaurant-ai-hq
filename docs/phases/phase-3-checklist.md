# Phase 3 — Truth guard

Status: green. Recorded 2026-11-16.

## Requirements

- [x] A model number is kept only when it is the same decimal as an Odoo fact. `10.50`, `10.5`, and Arabic `١٠٫٥` match. `10.501` and scientific notation do not. Evidence: `canonicalDecimal` at `src/server/ai/number-guard.ts:35` and `guardAnswerNumbers` at `src/server/ai/number-guard.ts:89`. Test: `phase 3 truth guard > accepts only the exact decimal from the fact pack`.
- [x] A number that fails the guard is rejected with `GUARD_REJECTED` and is not stored in the report. Evidence: `src/server/ai/consensus.ts:186`. Test: `phase 3 truth guard > keeps a finding only when two models cite the same Odoo value`.
- [x] A data finding is adopted only when at least two of the three models cite the same fact. A single model stays in `unadoptedFindings`. Evidence: `src/server/ai/consensus.ts:230`. Same test.
- [x] A recommendation is adopted only with two supporters and zero disputes. Evidence: `src/server/ai/consensus.ts:287`. Same test.
- [x] Each model call is stored as an `AiRun` row, including a guard rejection. Evidence: status mapping at `src/server/ai/brief.ts:214` and `persistAiRuns` at `src/server/ai/persist.ts:178` (`INSERT INTO public.ai_runs` at `src/server/ai/persist.ts:130`, SQLite `aiRun.createMany` at `src/server/ai/persist.ts:161`). Test: `phase 3 truth guard > persists one AiRun row per model after the guard`.

## Checks

- `npx tsc --noEmit` — exit 0.
- `npx vitest run` — 94 files, 1254 tests, all passed.
- `npm run build` — exit 0 (Next.js 15.5.28 compiled successfully).
