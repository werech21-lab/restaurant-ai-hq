# Phase 5 — Proposals never auto-apply

Status: green. Recorded 2026-11-16.

## Requirements

- [x] An app idea is stored as `status: 'proposed'` and `kind: 'opinion'`. An organization note stays advisory and is not a proposal. Evidence: `src/server/ai/consensus.ts:257`. Test: `phase 5 proposals never auto-apply > stores an app idea as proposed opinion and leaves it unapplied`.
- [x] The export is text for a person to review. It says the council does not write code and does not deploy. Evidence: `githubIssueDraft` at `src/server/ai/consensus.ts:115`. Same test.
- [x] The council code does not call GitHub, write a file, or deploy. Evidence: scan of `src/server/ai`, `src/app/erp/ai-brief`, `src/app/api/erp/ai-brief`, and `src/app/api/cron` finds no `api.github.com`, `octokit`, `vercel --prod`, `child_process`, or `writeFile`. Test: `phase 5 proposals never auto-apply > exports the draft as text for a person and does not call GitHub`.
- [x] The button copies the draft to the clipboard. Evidence: `navigator.clipboard.writeText` in `src/app/erp/ai-brief/copy-draft.tsx`. Same scan test.
- [x] The copy control is rendered for an executive and omitted for other roles. Evidence: `canExport` at `src/app/erp/ai-brief/report-body.tsx`. Test: `phase 5 proposals never auto-apply > shows the draft to an executive and hides the export from other roles`.

## Checks

- `npx tsc --noEmit` — exit 0.
- `npx vitest run` — 96 files, 1261 tests, all passed.
- `npm run build` — exit 0 (Next.js 15.5.28 compiled successfully).
