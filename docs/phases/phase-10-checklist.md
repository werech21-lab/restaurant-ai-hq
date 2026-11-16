# Phase 10 checklist

Status: green. Recorded 2026-11-16 after `npx tsc --noEmit` (exit 0), `npx vitest run` (108 files, 1332 passed), and `npm run build` (exit 0, Next.js 15.5.28).

`prisma/dev.db` was not deleted and its user rows were not edited. Tests copy it to `/tmp/aetherbi-vitest-<pid>.db` and remove that copy on process exit. Login still reads users the same way. Migrations 0047–0050 were not applied. No password, PIN, or account was changed. Repository visibility, git history, and keys were not touched. Nothing was merged, pushed to main, or deployed.

## Fix table

| Fix | File:line | Test |
| --- | --- | --- |
| Trend base is the earlier fact date. Same day or mixed unit is not a change. Share uses fact role. | `src/server/ai/structured-claim.ts:177` | `phase 10 trend direction > uses the earlier date as the base when the model lists today first` |
| Same-day and KWD-versus-orders changes are rejected. | `src/server/ai/structured-claim.ts:213` | `phase 10 trend direction > rejects a same-day change and a mix of KWD and orders` |
| Reversing cited ids does not change a share. | `src/server/ai/structured-claim.ts:193` | `phase 10 trend direction > keeps a share when the cited ids are reversed` |
| A comparison is checked against the cited numbers. A name is not a fact id. | `src/server/ai/structured-claim.ts:343` | `phase 10 feryal comparisons > rejects a relation that contradicts the cited numbers and a name used as a fact id` |
| The council reads numeric facts from the agent payload. A true comparison is adopted and a false one is rejected. | `src/lib/feryal-council-facts.ts:19` and `src/server/ai/council.ts:169` | `phase 10 feryal comparisons > adopts a true comparison from the real agent payload and rejects a false one` |
| Uncited advice is dropped from a live brief and from a stored brief. | `src/server/ai/consensus.ts:67` and `src/server/ai/consensus.ts:631` | `phase 10 advisory > drops single-model uncited advice from the brief and from a stored report` |
| The env PIN is checked before the default hash is refused. The check does not write a hash. | `src/app/api/erp/governance/route.ts:663` and `src/lib/governance-pin.ts:41` | `phase 10 manager pin route > checks the env pin before refusing the default hash and does not write a hash` |
| A failed governance read stays denied through the pool outage window and writes nothing. | `src/app/api/erp/governance/route.ts:832` | `phase 10 manager pin route > keeps the outage denied after the pool would accept a query again` |
| A recommendation target type must be the cited fact's entity type. | `src/server/ai/structured-claim.ts:292` | `phase 10 target type > rejects a product close cited from an hour bucket and a staff cut cited from a branch` |
| An unrelated third claim does not veto a 2-of-3 agreement. Opposite actions still do. | `src/server/ai/consensus.ts:261` | `phase 10 consensus > keeps a 2-of-3 agreement when a third model adds an unrelated claim` |
| New spellings are excluded. School canteens stay included. Nearby product names stay included. | `src/lib/odoo/excluded-entities.ts:246` | `phase 10 exclusions > adds the missing spellings and keeps school canteens` |
| The temp SQLite copy is removed. The source database is not. | `src/lib/db.ts:6` | `phase 10 temp database > removes a vitest sqlite copy and leaves the source database alone` |

## 1. Trend direction

- [x] Delta and percent change use the earlier fact date as the base, whichever id the model lists first. `src/server/ai/structured-claim.ts:177`.
- [x] Two facts on the same date are not a change. Different metrics or units are not a change. `src/server/ai/structured-claim.ts:184`.
- [x] Share and ratio use the fact role. Citation order is not the role. `src/server/ai/structured-claim.ts:193`.
- [x] A fact used in a claim has a date, a unit, a metric, and an entity. `src/server/ai/structured-claim.ts:137` and `src/server/ai/facts.ts:91`.
- [x] Test: `phase 10 trend direction > uses the earlier date as the base when the model lists today first`.
- [x] Test: `phase 10 trend direction > rejects a same-day change and a mix of KWD and orders`.
- [x] Test: `phase 10 trend direction > keeps a share when the cited ids are reversed`.
- [x] Test: `phase 8 number computer > derives a delta sign from the earlier date and rejects a mismatched direction`.

## 2. Feryal comparisons

- [x] Better, worse, best, worst, and equal are checked against the cited numeric facts for the same metric, unit, and period. A contradiction is rejected. `src/server/ai/structured-claim.ts:343`.
- [x] A cited id must be a fact id. A branch name is not a fact. `src/server/ai/council.ts:195`.
- [x] The agent result carries `facts` built from `structuredFacts`. There is no `records` field. `src/lib/feryal-odoo-agent.ts:2952` and `src/lib/feryal-council-facts.ts:19`.
- [x] Test: `phase 10 feryal comparisons > rejects a relation that contradicts the cited numbers and a name used as a fact id`.
- [x] Test: `phase 10 feryal comparisons > adopts a true comparison from the real agent payload and rejects a false one`.

## 3. Advice text

- [x] Any advisory text fails the review and is not copied into the brief. `src/server/ai/consensus.ts:67` and `src/server/ai/consensus.ts:361`.
- [x] A stored brief's advisory and proposals are read back as empty. `src/server/ai/consensus.ts:631`.
- [x] The brief prompt tells the model not to send advisory text. `src/server/ai/brief.ts:28`.
- [x] Test: `phase 10 advisory > drops single-model uncited advice from the brief and from a stored report`.

## 4. PIN lockout

- [x] A stored hash, including one equal to the install default, is checked. A failed load is still denied. `src/lib/governance-pin.ts:41`.
- [x] `AETHER_MANAGER_PIN` is checked before the default hash is refused. The published default is still rejected when that env value is unset. `src/app/api/erp/governance/route.ts:663`.
- [x] `changePin` returns 503 when the stored hash is still the default or the load failed, and it does not write a hash. `src/app/api/erp/governance/route.ts:832`.
- [x] The route tests call `POST`. After a failed read, the next check inside the pool outage window is denied and issues no pin-hash write.
- [x] Test: `phase 10 manager pin route > checks the env pin before refusing the default hash and does not write a hash`.
- [x] Test: `phase 10 manager pin route > keeps the outage denied after the pool would accept a query again`.
- [x] Test: `phase 8 pin and database > fails closed when the governance read is down, including after the pool returns`.

## 5. Target type

- [x] The target type must equal the cited fact's entity type, and the name or id must be that entity. An hour is not a product. `src/server/ai/structured-claim.ts:292` and `src/server/ai/facts.ts:99`.
- [x] Test: `phase 10 target type > rejects a product close cited from an hour bucket and a staff cut cited from a branch`.

## 6. Consensus

- [x] A conflict is the same target with opposite polarity, an opposite action, or the same action and a different direction. A monitor claim does not veto a close claim. `src/server/ai/consensus.ts:261`.
- [x] Expand versus close on the same target is still disputed and is not adopted.
- [x] Test: `phase 10 consensus > keeps a 2-of-3 agreement when a third model adds an unrelated claim`.
- [x] Test: `phase 6 claim consensus > drops expand versus close even when both cite the same fact`.
- [x] Test: `phase 6 claim consensus > does not adopt a shared fact when a third model names a different action`.

## 7. Exclusions

- [x] قرين, Kurain, Heisenburg, Haisenberg, and جهرا are excluded. `src/lib/odoo/excluded-entities.ts:48`.
- [x] Matching is by token, a clitic-stripped token, a collapsed spaced Latin brand, or a code with digits. Shawali, Chawali Masala, Cheese Qureinat, and Qurainy Dates stay included. `src/lib/odoo/excluded-entities.ts:246`.
- [x] NPIS Hawally and FAIPS Ahmadi stay included. NPIS Jahra stays excluded. `src/lib/odoo/excluded-entities.ts:269`.
- [x] The Odoo domain uses `=ilike` token patterns. It does not use a bare `not ilike` substring. The console extractor matches tokens. `src/lib/odoo/excluded-entities.ts:299` and `src/modules/odoo/domain/console.ts:26`.
- [x] Test: `phase 10 exclusions > adds the missing spellings and keeps school canteens`.
- [x] Test: `phase 10 exclusions > keeps product names that only share letters with a closed branch`.
- [x] Test: `phase 9 company POS > keeps NPIS Hawally and FAIPS Ahmadi and excludes the closed branch and Jahra devices`.

## 8. Temp database copies

- [x] The vitest copy and its journal, wal, and shm files are removed on process exit. A path under `prisma` or ending in `dev.db` is left alone. The Vercel `/tmp/aetherbi-erp.db` path is unchanged. `src/lib/db.ts:6`.
- [x] Test: `phase 10 temp database > removes a vitest sqlite copy and leaves the source database alone`.

## Password and PIN writes

- [x] `src/services/rbac.service.ts:84` hashes a password only inside `user.create` when the form has no existing id. The update at `src/services/rbac.service.ts:90` writes name, email, role, and isActive.
- [x] `updateProfile` returns the Arabic refusal when a password field is sent and then writes the name only. `src/services/rbac.service.ts:227`.
- [x] `src/lib/ensure-venture-foods-team.ts:60` returns the existing user before hashing. `scripts/sync-vf-users.ts:56` does the same.
- [x] `prisma/seed.ts:54` reuses the current admin when any user exists. Hashing runs only in the empty-table branch at `prisma/seed.ts:65`.
- [x] `src/services/ess.service.ts:9` writes an employee pin hash only when that employee has none. It is not a user password.
- [x] Governance settings updates pass the stored PIN hash through `pinHashForSettingsSave`. `changePin` is the only PIN change, and it returns 503 without writing when the stored hash is still the install default. `src/lib/governance-pin.ts:13` and `src/app/api/erp/governance/route.ts:832`.

## Still open

- Repository privacy and key rotation stay with the owner. `prisma/dev.db` remains in git. Reads hide the invented rows.
- Migrations 0047–0050 are not applied. 0049 is destructive and must not be run.
- No executive browser click-through in this pass. The Vercel team check is still 403 from this environment.
- Production is still serving `fix/purge-invented-data-odoo-truth` at `56db360`. This branch was not deployed.
- `deleteUser` can still delete a panel user when an admin invokes it. It does not write a password hash. Admin email and isActive edits remain unused admin actions.
- The SQLite lock is per instance. The seed still hashes a password only when the user table is empty.
- The executive PIN modal still falls back to a local check on some non-OK responses. This pass did not change that client. The server route is the path the tests exercise.
