# Phase 8 checklist

Status: green. Recorded 2026-11-16 after `npx tsc --noEmit` (exit 0), `npx vitest run` (104 files, 1310 passed), and `npm run build` (exit 0, Next.js 15.5.28).

`prisma/dev.db` was not deleted and its user rows were not edited. Tests copy it to `/tmp/aetherbi-vitest-<pid>.db`. Login still reads users the same way. Migration `0050_governance_sync_rls.sql` stays a file and was not applied. No password, PIN, or account was changed. Repository visibility, git history, and keys were not touched.

## 1. Structured claims

- [x] A model finding or recommendation is strict JSON: action, target type plus an Odoo id or canonical name, metric, direction, polarity, and cited fact ids. Zod rejects anything else. Free text with `text`, `solution`, or `factIds` is not a fallback. `src/server/ai/structured-claim.ts:36` and `src/server/ai/consensus.ts:76`.
- [x] Two models agree only when action, target, metric, direction, and polarity are equal and they share a cited fact id. `action: none` is not adopted. `src/server/ai/structured-claim.ts:135` and `src/server/ai/consensus.ts:386`.
- [x] Arabic and English display text is the template in `renderClaimText`. Model prose is not stored. `src/server/ai/structured-claim.ts:219`.
- [x] Test: `phase 8 structured claims > rejects every reviewer consensus break` in `src/server/ai/__tests__/phase-8-structured.test.ts`. The seven pairs are لا ينبغي إغلاق الفرع / أغلق الفرع, We shouldn't close the branch / Close the branch, You should not ever close the branch / Close the branch, إغلاق الفرع خطأ كبير / أغلق الفرع, Close the morning shift only / Close the branch permanently, Stop the discounts / Stop the branch, and Review the branch / Review then close the branch.
- [x] Test: `phase 8 structured claims > adopts only when action, target, direction, polarity and a cited fact match`.
- [x] Test: `phase 8 structured claims > does not adopt action none`.
- [x] Test: `phase 8 structured claims > rejects a claim whose target is not in the cited facts`.

## 2. Feryal comparisons

- [x] A comparison is `{subject_id, relation, object_id, metric, cited_fact_ids}`. `worse` is normalised to the swapped `better` before the key is compared. Fewer than two identical structures returns لا اتفاق plus the Odoo facts. `src/server/ai/structured-claim.ts:238` and `src/server/ai/council.ts:118`.
- [x] The reply is the template, not the model sentence. `src/server/ai/structured-claim.ts:262`.
- [x] Test: `phase 8 feryal comparisons > rejects every reviewer chat paraphrase`. The pairs are الأفنيوز أفضل من السالمية / السالمية أفضل من الأفنيوز, الأقوى / الأضعف, جيد / سيئ, and top / bottom.
- [x] Test: `phase 8 feryal comparisons > does not treat best and worst as the same structure`.
- [x] Test: `phase 8 feryal comparisons > normalises Y worse than X to X better than Y`.

## 3. Numbers come from cited facts

- [x] Displayed values, deltas, percents, and ratios are `computeClaimFigure` with Decimal. Direction is accepted only when the computed sign matches. A percent change from 900 to 1000 is 11. `src/server/ai/structured-claim.ts:163`.
- [x] Advisory text that contains a digit is dropped. `src/server/ai/consensus.ts:72`.
- [x] `guardAnswerAgainstFacts` is not called from consensus or the council. `src/server/ai/consensus.ts` and `src/server/ai/council.ts`.
- [x] Test: `phase 8 number computer > rejects every reviewer number sentence`. The sentences include sales fell from 900 to 1000 while orders rose from 50 to 40, صعدت / تحسنت / were up / improved from 1000 to 900, سجلت المبيعات ارتفاعاً من 1000 إلى 900, growth of -10% from 900 to 1000, 90% of sales came from one branch, sales rose 1000 → 900, ارتفعت المبيعات: 900 مقابل 1000 أمس, المبيعات ضعف الأمس 1000, and الفرق كبير: 100 طلب.
- [x] Test: `phase 8 number computer > displays 11 for a rise from 900 to 1000 and rejects the opposite direction`.
- [x] Test: `phase 8 number computer > derives a delta sign from the facts and rejects a mismatched direction`.
- [x] Test: `phase 8 gates > does not use the free-text number guard as the consensus or chat gate`.

## 4. PIN fails closed

- [x] A failed or unavailable governance read, including a missing Postgres pool, returns an empty pin hash and `loadFailed`. The default hash is not copied from the cache. `src/app/api/erp/governance/route.ts:173`.
- [x] `planPinCheck` returns `deny` when the load failed, the pool is down, Postgres is configured without a custom hash, or the stored hash is the default constant. `initial` remains only for a local install with no stored hash. `src/lib/governance-pin.ts:33`.
- [x] `planPinWrite` refuses a change-pin write when the load failed, even if the pool is available again. `src/lib/governance-pin.ts:49`.
- [x] The default SHA is compared only when the plan is `initial` and no stored hash is present. `src/app/api/erp/governance/route.ts:681`.
- [x] Test: `phase 8 pin and database > fails closed when the governance read is down, including after the pool returns`.

## 5. Warehouses, lines, and the test database

- [x] The default All view sums `WarehouseStock` on warehouses that are not excluded. Sales and cost of goods use visible invoice lines and the same warehouse set. `src/lib/reports.ts:19`, `src/lib/reports.ts:33`, `src/lib/reports.ts:71`, `src/lib/reports.ts:90`.
- [x] Low stock uses that warehouse set. `src/lib/stock.ts:9`. The stock report does too. `src/app/(panel)/reports/page.tsx:136`.
- [x] Hawaly, Gurain, Jahara, الجهرا, and Heizenberg are on the exclusion list. A leading ك is not stripped, so كحولي stays. Spaced Heizenberg matches the collapsed Latin form. `src/lib/odoo/excluded-entities.ts:38`, `src/lib/odoo/excluded-entities.ts:73`, `src/lib/odoo/excluded-entities.ts:83`, `src/lib/odoo/excluded-entities.ts:113`, `src/lib/odoo/excluded-entities.ts:123`, `src/lib/odoo/excluded-entities.ts:178`.
- [x] An invoice or purchase order stays when it has a visible product line. Hidden lines are omitted from the displayed and exported total. `src/lib/panel-visibility.ts:85` and `src/app/(panel)/sales/page.tsx:72`.
- [x] Sales and purchase CSV exports and the BI sales total use the same filters. `src/services/report.service.ts:281` and `src/services/bi.service.ts:18`.
- [x] Vitest copies `prisma/dev.db` to `/tmp` and sets `SQLITE_URL` there. `src/lib/db.ts:13`.
- [x] Test: `phase 8 exclusions > matches the added spellings and keeps a leading kaf`.
- [x] Test: `phase 8 warehouse scope > values, sells, costs and counts low stock on visible warehouses only`.
- [x] Test: `phase 8 warehouse scope > keeps a document that still has a real line and filters exports`.
- [x] Test: `phase 8 pin and database > points the test database at a temp copy`.

## Password and PIN writes

- [x] `src/services/rbac.service.ts:80` hashes a password only inside `user.create` when the form has no existing id. The update at `src/services/rbac.service.ts:90` writes name, email, role, and isActive.
- [x] `updateProfile` returns the Arabic refusal when a password field is sent and then writes the name only. `src/services/rbac.service.ts:227`.
- [x] `src/lib/ensure-venture-foods-team.ts:60` returns the existing user before hashing. `scripts/sync-vf-users.ts:56` does the same.
- [x] `prisma/seed.ts:54` reuses the current admin when any user exists. Hashing runs only in the empty-table branch.
- [x] `src/services/ess.service.ts:9` writes an employee pin hash only when that employee has none. It is not a user password.
- [x] Governance settings updates do not write `pin_hash`. `changePin` is the only PIN writer, and it runs only after `planPinWrite` returns `change-pin`.

## Still open

- Repository privacy and key rotation stay with the owner. `prisma/dev.db` remains in git. Reads hide the invented rows.
- Migrations 0047–0050 are not applied. 0049 is destructive and must not be run.
- No executive browser click-through in this pass. The Vercel team check is still 403 from this environment.
- `deleteUser` can still delete a panel user when an admin invokes it. It does not write a password hash. Admin email and isActive edits remain unused admin actions.
- The SQLite lock is per instance. The seed still hashes a password only when the user table is empty.
