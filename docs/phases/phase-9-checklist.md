# Phase 9 checklist

Status: green. Recorded 2026-11-16 after `npx tsc --noEmit` (exit 0), `npx vitest run` (105 files, 1319 passed), and `npm run build` (exit 0, Next.js 15.5.28).

`prisma/dev.db` was not deleted and its user rows were not edited. Tests copy it to `/tmp/aetherbi-vitest-<pid>.db`. Login still reads users the same way. Migrations 0047–0050 were not applied. No password, PIN, or account was changed. Repository visibility, git history, and keys were not touched. Nothing was merged, pushed to main, or deployed.

## 1. School canteens stay in the company total

- [x] A school canteen is kept even when its name contains the closed-branch district. Jahra, Heisenberg, Qurain, and the closed restaurant branch stay excluded. `src/lib/odoo/excluded-entities.ts:172` and `src/lib/odoo/excluded-entities.ts:215`.
- [x] NPIS and FAIPS canteens map to `school-canteens` before any admin override. The closed branch and a device named Central Kitchen do not map to Ardiya. `src/lib/odoo-live-connector.ts:899` and `src/lib/odoo-live-connector.ts:939`.
- [x] The branch is labelled School canteens / مقاصف المدارس and is included in the all-branches ranking. `src/lib/odoo-live-connector.ts:3091` and `src/lib/aether/cores-hub-engine.ts:704`.
- [x] An Odoo name filter keeps a school-canteen name instead of a blind `not ilike` on the closed-branch fragment. `src/lib/odoo/excluded-entities.ts:238` and `src/modules/odoo/domain/console.ts:23`.
- [x] Test: `phase 9 company POS > keeps NPIS Hawally and FAIPS Ahmadi and excludes the closed branch and Jahra devices`.
- [x] Test: `phase 9 company POS > maps school canteens to their own branch and leaves the closed branch and central kitchen unmapped`.
- [x] Test: `phase 9 company POS > keeps a school canteen on the top-branch card and drops the closed branch`.
- [x] Test: `phase 9 company POS > does not drop a school canteen with a blind name exclusion`.

## 2. Both live paths use the same company POS set

- [x] A config is in the company total only when it is an approved restaurant register or a school canteen that is not otherwise excluded. Exhibitions and unknown configs are omitted. `src/lib/odoo/company-pos.ts:43`.
- [x] The live connector queries `session_id.config_id in` that set. `src/lib/odoo-live-connector.ts:1653`.
- [x] `live-sync-core` searches the same restaurant ids plus school-canteen names, then applies the same predicate, and adds the canteen net to the company total. `src/lib/odoo/live-sync-core.ts:592` and `src/lib/odoo/live-sync-core.ts:650`.
- [x] Test: `phase 9 company POS > keeps the orders title, the tooltip, and the two POS paths on the shared rules`.

## 3. Unassigned sales are not forced to direct takeaway

- [x] An unmapped order uses `resolveUiChannelHint(..., false)`, so a payment name with no delivery hint stays dine-in. `src/lib/odoo-live-connector.ts:2587`.
- [x] A missing branch no longer counts as a delivery terminal. `src/lib/odoo-live-connector.ts:2794`.
- [x] Test: the same source assertion in `phase 9 company POS > keeps the orders title, the tooltip, and the two POS paths on the shared rules`.

## 4. Admin device mappings persist in the database

- [x] Mappings are rows in `pos_terminal_branch_map`, created with `CREATE TABLE IF NOT EXISTS` at runtime. Postgres is used when `DATABASE_URL` is postgres. Otherwise the app SQLite database is used. There is no temp-file store and no remote migration was applied. `src/lib/odoo/terminal-mapping-store.ts:15`.
- [x] A save writes the database before the process cache. A failed write throws and the API returns `mapping_persist_failed`. `src/lib/odoo-terminal-mappings.ts:334` and `src/app/api/erp/terminal-mappings/route.ts:154`.
- [x] Test: `phase 9 company POS > stores an admin terminal mapping in the database across a cold cache`.

## 5. KPI tooltip

- [x] The details open on click below the badge, close on a second click, an outside click, or Escape, and there is no native `title` tooltip. `src/components/erp/KpiProvenanceBadge.tsx:140` and `src/components/erp/KpiProvenanceBadge.tsx:244`.
- [x] The orders and sales queries are built from the Kuwait day converted to an exclusive UTC end, the company id when the snapshot has one, and the config allow-list. `src/lib/odoo/pos-order-query.ts:49` and `src/components/aether/FullJourney360.tsx:227`.
- [x] Test: `phase 9 company POS > builds the POS query from Kuwait UTC bounds, the company filter, and the config list`.
- [x] Test: the badge assertion in `phase 9 company POS > keeps the orders title, the tooltip, and the two POS paths on the shared rules`.

## 6. KWD formatting

- [x] Money on the executive journey uses three decimal places. 35.05 is 35.050 and 18.95 is 18.950. `src/lib/format-kwd.ts:2` and `src/components/aether/FullJourney360.tsx:221`.
- [x] Test: `phase 9 company POS > keeps refunds signed, anchors today on the Kuwait date, and formats KWD to 3 decimals`.

## 7. Refunds, Central Kitchen, and today

- [x] POS net is `amount_total - amount_tax` and is not clamped to zero. `src/lib/odoo/company-pos.ts:53`, `src/lib/odoo-live-connector.ts:2535`, and `src/lib/odoo/live-sync-core.ts:636`.
- [x] The Ardiya name rule no longer treats the word central as Ardiya. `src/lib/odoo-live-connector.ts:939`.
- [x] The today window is the Kuwait calendar day, including just after midnight when the newest order is still yesterday. `src/lib/odoo/company-pos.ts:67` and `src/lib/odoo-live-connector.ts:1689`.
- [x] Test: `phase 9 company POS > keeps refunds signed, anchors today on the Kuwait date, and formats KWD to 3 decimals`.
- [x] Test: `phase 9 company POS > maps school canteens to their own branch and leaves the closed branch and central kitchen unmapped`.

## 8. Orders title

- [x] The orders card title is Total Orders / إجمالي الطلبات. The before-rent amount stays in its own pill. `src/components/aether/FullJourney360.tsx:772`.
- [x] Test: `phase 9 company POS > keeps the orders title, the tooltip, and the two POS paths on the shared rules`.

## Password and PIN writes

- [x] `src/services/rbac.service.ts:84` hashes a password only inside `user.create` when the form has no existing id. The update at `src/services/rbac.service.ts:90` writes name, email, role, and isActive.
- [x] `updateProfile` returns the Arabic refusal when a password field is sent and then writes the name only. `src/services/rbac.service.ts:227`.
- [x] `src/lib/ensure-venture-foods-team.ts:60` returns the existing user before hashing. `scripts/sync-vf-users.ts:56` does the same.
- [x] `prisma/seed.ts:54` reuses the current admin when any user exists. Hashing runs only in the empty-table branch at `prisma/seed.ts:65`.
- [x] `src/services/ess.service.ts:9` writes an employee pin hash only when that employee has none. It is not a user password.
- [x] Governance settings updates pass the stored PIN hash through `pinHashForSettingsSave`. `changePin` is the only PIN change, and it runs only after the load succeeds. `src/lib/governance-pin.ts:15`.

## Still open

- Repository privacy and key rotation stay with the owner. `prisma/dev.db` remains in git. Reads hide the invented rows.
- Migrations 0047–0050 are not applied. 0049 is destructive and must not be run.
- No executive browser click-through in this pass. The badge was checked by a static render, not by a signed-in dashboard session. The Vercel team check is still 403 from this environment.
- Production is still serving `fix/purge-invented-data-odoo-truth` at `56db360`. This branch was not deployed.
- `deleteUser` can still delete a panel user when an admin invokes it. It does not write a password hash. Admin email and isActive edits remain unused admin actions.
- The SQLite lock is per instance. The seed still hashes a password only when the user table is empty.
