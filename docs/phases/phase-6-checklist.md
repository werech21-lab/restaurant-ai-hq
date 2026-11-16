# Phase 6 checklist

Status: green. Recorded 2026-11-16 after `npx tsc --noEmit` (exit 0), `npx vitest run` (99 files, 1282 passed), and `npm run build` (exit 0, Next.js 15.5.28).

Migrations `0048` and `0049` are in the tree and covered by the migration tests. They were not applied to a remote database. No password, PIN, or account was changed, reset, or rehashed. The repository visibility and keys were not touched.

## 1. Consensus is the same claim

- [x] Recommendations are grouped by fact set and a normalized claim (`action|direction|metric|entity`). A recommendation is adopted only when at least two models share that claim. `src/server/ai/consensus.ts:324` and `src/server/ai/consensus.ts:337`.
- [x] Expand versus close on the same facts is a dispute and is not adopted. `src/server/ai/claims.ts:62` and `src/server/ai/consensus.ts:326`.
- [x] Test: `phase 6 claim consensus > drops expand versus close even when both cite the same fact` in `src/server/ai/__tests__/phase-6-truth.test.ts`.
- [x] Test: `phase 6 claim consensus > adopts a recommendation only when two models share the claim`.

## 2. Number guard

- [x] Model numbers must match a cited `value` or `toolNumbers` field. Ids, dates, hours, and codes are skipped. `src/server/ai/number-guard.ts:92` and `src/server/ai/number-guard.ts:236`.
- [x] A percent, delta, or ratio is accepted only when `Decimal` recomputes it from those values and half-up rounding matches the written scale. `src/server/ai/decimal.ts:49` and `src/server/ai/number-guard.ts:132`.
- [x] Rise and fall words must match the sign of the written from-to pair, or of the recomputed period delta. `src/server/ai/number-guard.ts:263`.
- [x] Test: `phase 6 number guard > rejects a percent that only matches an hour` (`20% of sales` with hour 20).
- [x] Test: `phase 6 number guard > rejects a rise whose written endpoints move the other way` (`rose from 1000 to 900`).
- [x] Test: `phase 6 number guard > accepts a percent only after recomputing it from fact values`.

## 3. Feryal chat agreement

- [x] A chat answer is agreed only when at least two models share the claim. Otherwise the reply says there is no agreement and `agreed` is empty. `src/server/ai/council.ts:92` and `src/server/ai/council.ts:116`.
- [x] `agreed` lists only the models in the agreeing cluster.
- [x] Test: `phase 6 feryal agreement > returns no agreement when the models reach opposite conclusions`.
- [x] Test: `phase 6 feryal agreement > lists only the models that share the conclusion`.

## 4. Invented data

- [x] The CRM catering tab no longer shows 38,900 KWD, 96.8%, or the six sample contracts. It shows an empty state. `src/components/crm/VentureCrmHub.tsx:82`. The leads and quotes tab still renders `liveChildren`.
- [x] Test: `phase 6 invented data > removes the catering totals from the CRM hub`.
- [x] The seed catalog inserts and the matching deletes run only outside production. `prisma/seed.ts:32`. Production reads of sales, reports, and warehouses hide those codes and emails. `src/lib/demo-catalog.ts`.
- [x] Test: `phase 6 invented data > gates the seed catalog and hides it on production reads`.
- [x] Migration `database/migrations/0048_deactivate_non_company_items.sql` deactivates the non-company SKUs. It was not run against a remote database. Reads also hide those SKUs. `src/modules/inventory/repositories/inventory-repository.ts:137`.
- [x] Test: `phase 6 invented data > hides the non-company bakery skus and drops the unused screens`.
- [x] `HomeShell`, `Assistant`, `Finance`, `Inventory`, `Recommendations`, `Reports`, and `src/lib/assistant.ts` are removed. Nothing else imported them.
- [x] An employee expiry with no `hrDocument` is `unknown` and the date is not shown. `src/services/hr-compliance.service.ts:49`. Migration `0049_flag_unsourced_hr_expiries.sql` is the flagged cleanup and was not run remotely.
- [x] Test: `phase 6 invented data > flags an expiry without a document as unknown and does not show the date`.

## 5. Governance PIN

- [x] A settings save stores the hash already on the server. The client hash is ignored. `src/app/api/erp/governance/route.ts:771` and `src/lib/governance-pin.ts`.
- [x] `updatePinHash` no longer writes a hash. `src/app/api/erp/governance/route.ts:896`. Changing the PIN stays on `changePin`, which checks the current PIN. `src/lib/governance-compliance.ts:119`.
- [x] A settings push sends the store only. `src/lib/governance-compliance.ts:799`.
- [x] A stored `vfsha256_` hash is kept when the envelope is loaded. `src/app/api/erp/governance/route.ts:186`.
- [x] Test: `phase 6 governance pin > leaves the stored hash unchanged when settings are saved`.

## 6. Exclusions

- [x] حولي, QRN, JHR, and HWL match whole tokens. The other closed-entity fragments stay substrings. `src/lib/odoo/excluded-entities.ts:108` and `src/lib/odoo/excluded-entities.ts:138`.
- [x] Test: `phase 6 exclusions > matches the closed branch as a whole token and keeps lookalikes`.
- [x] Test: `phase 6 exclusions > matches the short codes as tokens and not as a prefix`.
- [x] The listed readers use the central filter: Feryal domains (`src/lib/feryal-odoo-agent.ts:280`, `branch_scope` removed), live sync, `/api/odoo-sync`, Odoo rpc and console, and the warehouse chain route plus studio.
- [x] Test: `phase 6 odoo read paths > routes the listed readers through the central filter`.
- [x] Test: `phase 6 exclusions > strips an excluded branch key from a warehouse payload`.

## 7. Run-now lock and old model routes

- [x] A manual run takes an atomic database lock and a second holder is busy until release or 90 seconds. `src/server/ai/persist.ts:103` and `src/app/api/erp/ai-brief/run/route.ts:47`. The scheduled run does not take this lock.
- [x] Test: `phase 6 manual run lock > lets one holder start and refuses a second until release`.
- [x] `/api/ai/claude`, `/api/ai/gemini`, `/api/erp/planning/forecast`, and `/api/erp/feryal/vision` return 410 after the existing executive session check. `src/app/api/ai/claude/route.ts:12`. The forecast button uses the Odoo formula. The vision caller returns null and does not read a browser key.
- [x] Test: `phase 6 disabled model routes > returns 410 from claude after authentication` (and the gemini, forecast, and vision cases).

## Still open

- [ ] Repository privacy and key rotation stay with the owner. This phase did not change either.
- [ ] Migrations `0048` and `0049` are not applied to a remote database.
- [ ] No executive clicked Run now in a browser. The lock is covered by the database test.
- [ ] `deleteUser` and an admin edit of name, email, role, or active flag remain available to an admin and were not invoked. The empty-database seed still hashes a password only when the user table is empty. An empty employee PIN is still hashed only when that PIN field is empty.
