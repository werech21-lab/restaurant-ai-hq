# Phase 2 — Background council

Status: green. Recorded 2026-11-16.

## Requirements

- [x] The daily job is cron `0 3 * * *` (06:00 Asia/Kuwait) on `/api/cron/ai-daily-brief`. Evidence: `vercel.json:13`. Test: `phase 2 background council > schedules the morning analysis at 06:00 Asia/Kuwait`.
- [x] The job stays on unless `AI_DAILY_BRIEF_ENABLED` is `0`, `false`, or `off`. Evidence: `isBackgroundAnalysisEnabled` in `src/server/ai/env.ts:30`. Test: `phase 2 background council > keeps the daily job on unless the flag is explicitly off`.
- [x] The cron route requires `CRON_SECRET` and does not run when the flag is off. Evidence: `src/app/api/cron/ai-daily-brief/route.ts:33` and `src/app/api/cron/ai-daily-brief/route.ts:39`. Test: `phase 2 background council > refuses the cron without its secret and skips the run when the flag is off`.
- [x] The scheduled run uses `trigger: 'schedule'` and is not covered by the manual cooldown. Evidence: `src/app/api/cron/ai-daily-brief/route.ts:47`. Test: `phase 2 background council > does not apply the manual cooldown to the scheduled route`.
- [x] Server calls go to Claude (`api.anthropic.com`), Gemini (`generativelanguage.googleapis.com`), and Grok (`api.x.ai`). Evidence: `src/server/ai/providers.ts:142`, `src/server/ai/providers.ts:158`, `src/server/ai/providers.ts:171`. Test: `phase 2 background council > calls Claude, Gemini, and Grok on the server and skips a missing key`.
- [x] A missing or short key is stored as not configured and no request is sent. Evidence: `src/server/ai/providers.ts:295`. Same test, plus `missingCouncilKeyNames` for `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, and `XAI_API_KEY`.
- [x] Manual run is executive-only (`admin`, `gm`, `dgm`, `ops`, `cfo`) and blocked for `marketing`, `supply`, and `auditor`. Evidence: `canTriggerManualOdooSync` at `src/lib/auth/role-access-policy.ts:209` and the route check at `src/app/api/erp/ai-brief/run/route.ts:17`. Test: `phase 2 background council > limits a manual run to executives and to once every ten minutes`.
- [x] Manual runs are limited to once every 10 minutes. A scheduled row does not start the cooldown. The route returns 429 with `Retry-After`. Evidence: `MANUAL_RUN_COOLDOWN_MS` in `src/server/ai/manual-run.ts:1` and `src/app/api/erp/ai-brief/run/route.ts:43`. Same test. The route calls `trigger: 'manual'` at `src/app/api/erp/ai-brief/run/route.ts:48`.
- [x] The page button posts to `/api/erp/ai-brief/run` and shows the Arabic label, and it stays disabled during the cooldown. Evidence: `src/app/erp/ai-brief/run-button.tsx:27` and `src/app/erp/ai-brief/run-button.tsx:65`. Test: `phase 2 background council > renders the manual run button against the executive route`.

## Checks

- `npx tsc --noEmit` — exit 0.
- `npx vitest run` — 92 files, 1245 tests, all passed.
- `npm run build` — exit 0 (Next.js 15.5.28 compiled successfully).
