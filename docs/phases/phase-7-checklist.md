# Phase 7 checklist

Status: green. Recorded 2026-11-16 after `npx tsc --noEmit` (exit 0), `npx vitest run` (102 files, 1295 passed), and `npm run build` (exit 0, Next.js 15.5.28).

`prisma/dev.db` was not deleted and its user rows were not edited. Login still reads users the same way. Migration `0050_governance_sync_rls.sql` is a file only and was not applied to a remote database. No password, PIN, or account was changed. Repository visibility, git history, and keys were not touched.

## 1. Invented panel rows stay out of reads

- [x] Demo and non-company products are hidden by code and name, not by `INV-00001` or `PO-00001`. `src/lib/panel-visibility.ts:12` and `src/lib/panel-visibility.ts:74`.
- [x] The four bootstrap lead titles are hidden from lead lists, quotation lists, and the assistant. `src/lib/panel-visibility.ts:20` and `src/services/crm.service.ts:16`.
- [x] Reports, warehouses, CRM product dropdowns, recipes, search, backup, stock, and valuation use that filter. `src/lib/reports.ts:23`, `src/lib/reports.ts:119`, `src/app/(panel)/reports/page.tsx`, `src/app/(panel)/warehouses/page.tsx`, `src/app/(panel)/crm/page.tsx`, `src/app/(panel)/recipes/page.tsx`, `src/app/actions/search.ts`, `src/app/api/panel/search/route.ts`.
- [x] Test: `phase 7 panel reads > hides non-company products, invented leads, and excluded warehouses` in `src/lib/__tests__/phase-7-blockers.test.ts`.
- [x] Test: `phase 7 panel reads > does not hide invoices or purchase orders by their first numbers`.

## 2. Unrecognised claims do not count as agreement

- [x] A claim is adopted only when the matcher names an action. `src/server/ai/claims.ts:132`, `src/server/ai/consensus.ts:247`, `src/server/ai/consensus.ts:337`.
- [x] Negation is part of the claim, so "do not close" and "لا تغلق" contradict "close". Whole words are matched, so "closely" is not "close". `src/server/ai/claims.ts:74` and `src/server/ai/claims.ts:78`.
- [x] Opposite pairs are promote/stop, hire/fire, best/worst, expand/close, and raise/lower. `src/server/ai/claims.ts:60`.
- [x] Test: `phase 7 claim consensus > does not adopt a claim the matcher does not recognise`.
- [x] Test: `phase 7 claim consensus > treats a negated close as the opposite of close`.
- [x] Test: `phase 7 claim consensus > does not treat closely as close`.
- [x] Test: `phase 7 claim consensus > drops the reviewer opposite pairs`.

## 3. Number guard

- [x] A from-to pair is checked against direction words in the 64 characters before it and the 64 after it, and again against any direction word in the whole answer. `src/server/ai/number-guard.ts:218`.
- [x] The rise and fall lists include jumped, قفزت, نمو, and هبط. `src/server/ai/claims.ts` direction patterns, used by `directionSign`.
- [x] A derived number is accepted only when the text names a ratio or a difference, or when a percent is the recomputed growth of a from-to pair. 900 to 1000 is 11%. `src/server/ai/number-guard.ts:261`.
- [x] Test: `phase 7 number guard > reads a direction word on either side of a from-to pair`.
- [x] Test: `phase 7 number guard > rejects an unexplained ratio or difference and accepts real growth`.

## 4. Feryal chat

- [x] Best and worst are different claim keys, so they do not land in `agreed`. `src/server/ai/council.ts:93`.
- [x] Test: `phase 7 feryal opposites > does not agree when one model says best and the other says worst`.

## 5. Exclusions on warehouses and valuation

- [x] Hawali, Qurein, جهراء without ال, the prefixes بحولي / وحولي / للجهراء, and codes with digits such as JHR01 match the central filter. `src/lib/odoo/excluded-entities.ts:68`, `src/lib/odoo/excluded-entities.ts:93`, `src/lib/odoo/excluded-entities.ts:153`.
- [x] `listWarehouses` and stock valuation drop those warehouses. Jahra's warehouse valuation is zero. `src/services/warehouse.service.ts:21` and `src/lib/reports.ts:100`.
- [x] Test: `phase 7 exclusions > matches the added spellings, prefixes, and digit codes`.
- [x] Test: `phase 7 panel reads > hides non-company products, invented leads, and excluded warehouses`.

## 6. Governance PIN fallback

- [x] The cache keeps a stored `vfh1_` or `vfsha256_` hash and does not replace a missing cache hash with the default before a write. `src/app/api/erp/governance/route.ts:78`.
- [x] A failed database read sets `loadFailed`. Settings and PIN change both refuse. `src/app/api/erp/governance/route.ts:210` and `src/lib/governance-pin.ts:28`.
- [x] A settings save updates the payload only. `pin_hash` is written only by the verified PIN change. `src/app/api/erp/governance/route.ts:300` and `src/app/api/erp/governance/route.ts:801`.
- [x] Test: `phase 7 governance pin > refuses a write when the load failed and never substitutes a cache hash`.

## 7. Run-now cooldown after the lock

- [x] After `tryAcquireManualRunLock` returns, the route reads the briefs again and releases the lock when the cooldown is still open. `src/app/api/erp/ai-brief/run/route.ts:60`.
- [x] Test: `phase 7 manual run cooldown > checks the cooldown again after the lock is taken`.

## 8. Governance sync row level security

- [x] `database/migrations/0050_governance_sync_rls.sql:11` enables and forces row level security and revokes `PUBLIC`, `anon`, and `authenticated`. The file has no password or PIN value and is not applied by the route.
- [x] Test: `phase 7 governance migration > denies anon on the governance sync table and is not applied from the app`.
- [x] `src/lib/__tests__/security-db.test.ts` lists `vf_executive_governance_sync` as a deny-all table. The migration suite applies the file on the local PGlite database only.

## Still open

- The owner decides repository privacy, key rotation, and whether `prisma/dev.db` leaves git history. The file remains, and panel reads hide the invented rows.
- Migrations `0047` through `0050` were not applied to a remote database. `0049` is still the destructive unsourced-HR cleanup and was not run.
- No executive browser click-through was done. The Vercel team API remains forbidden for this token.
- `deleteUser` and an admin change of email or `isActive` remain available to an administrator and were not invoked.
