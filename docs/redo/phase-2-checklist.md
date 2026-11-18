# AetherBI — Redo Phase 2 Checklist (`docs/redo/phase-2-checklist.md`)

- **Branch**: `feat/aetherbi-redo-2026-11-18` (based on `origin/claude/aetherbi-phase-5-integration` @ `e67c1a7`, Phase 1 @ `13e8241`)
- **Author**: `Abdullah Awirah <werech21-lab@users.noreply.github.com>`
- **Hard Owner Rules Verified**:
  - Zero invented numbers and zero hand-typed KWD literals in any new or edited test/fixture.
  - Zero references to `venturefoods_odoo_cids1_dump.json` in production execution paths (`src/services/odoo-live-extractor.service.ts` returns calm unavailable state; live Odoo reads only).
  - Auditor permissions kept 100% untouched (`allowAuditor: false` on `POST /api/erp/feryal/chat`, `POST /api/erp/feryal`, `POST /api/feryal`, and composer hidden for `auditor`; read-only auditor eval proposed in report only per `C8`).
  - `prisma/dev.db` and `.env*` untouched; zero password, key, PIN, cron secret, remote DB migration, or deploy changes.
  - All Odoo RPC calls strictly read-only (`fields_get`, `search_count`, `search_read`, `read_group`, `read`).

---

## 1. Item-by-Item Traceability (`Item → file:line → Proving Test Name`)

### Item 2.1 — Live Model Probe (`F2`)

| File & Exact Lines | Responsibility | Proving Test File & Exact Test Name(s) |
|---|---|---|
| `src/lib/council/types.ts:107-125` | Isomorphic `CouncilModelProbeRow` & `CouncilModelProbeSummary` contracts (`totalCount`, `recentCount`, `presentFields`, `missingFields`, `dateSpan`, `branchCoveragePct`, `departmentCoveragePct`, `supportsConfigHourMethodGroup`) | `src/lib/__tests__/redo-phase-2/council-advisors-and-probe.test.ts:208` — `probes all 8 required models with fields_get, totalCount, recentCount, dateSpan, branchCoveragePct & read-only RPCs only` |
| `src/server/council/odoo-reads.ts:33-108, 123-345` | `PROBED_MODELS` & `probeOdooModels` probing all 8 required models (`hr.attendance`, `hr.employee`, `stock.move`, `stock.scrap`, `stock.quant`, `mrp.bom`, `mrp.bom.line`, `pos.payment`) via `fields_get`, `search_count([])`, 30-day `recentCount`, `dateSpan` (`min..max`), `% with branch`, and `pos.payment` `(config × hour × method)` verification | `src/lib/__tests__/redo-phase-2/council-advisors-and-probe.test.ts:208` — `probes all 8 required models with fields_get, totalCount, recentCount, dateSpan, branchCoveragePct & read-only RPCs only` |
| `src/server/council/service.ts:39-45, 125-127` | `resolveHasBomsFromProbe(probe)` checks `(bom.totalCount ?? bom.recentCount ?? 0) > 0` so `mrp.bom` records created >30 days ago (`recentCount === 0`) are properly detected | `src/lib/__tests__/redo-phase-2/council-advisors-and-probe.test.ts:208` — `probes all 8 required models with fields_get, totalCount, recentCount, dateSpan, branchCoveragePct & read-only RPCs only` |
| `scripts/probe-odoo-models.mjs:35-322`<br>`scripts/run-mac-readonly-probes.mjs:25-33, 152-154`<br>`docs/redo/odoo-model-probe.md:1-32` | Standalone read-only CLI enforcing `ALLOWED_ODOO_METHODS` (`fields_get`, `search_count`, `search_read`, `read_group`, `read`), exiting `0` with owner `.env.local` instructions when credentials are absent, and generating `docs/redo/odoo-model-probe.md` with verified cached baseline facts and honest `غير متاح — بانتظار تشغيل فحص المالك على Mac` markers | `src/lib/__tests__/redo-phase-2/council-advisors-and-probe.test.ts:370` — `standalone CLI scripts/probe-odoo-models.mjs exits 0 when .env.local is absent and docs/redo/odoo-model-probe.md carries verified baseline facts`<br>`src/lib/__tests__/redo-phase-1/reconcile-1-17-nov.test.ts:129` — `enforces strictly read-only Odoo RPC methods in run-mac-readonly-probes.mjs` |

---

### Item 2.2 — Delivery Advisor (`F3`) & Hourly Carry-Forward

| File & Exact Lines | Responsibility | Proving Test File & Exact Test Name(s) |
|---|---|---|
| `src/lib/council/sources.ts:59-70`<br>`src/server/council/odoo-reads.ts:352-424` | `classifyMatrixPaymentChannel` & `fetchAggregatorHourlyMatrix` mapping direct in-branch payments (`dine-in` / `takeaway-direct` — Cash, KNET, Visa/MasterCard, payment links) distinctly from `talabat-tgo`, `talabat-tmp`, `keeta`, `deliveroo`, `jahez`, `snoonu`, and `staff` in integer fils across the 5-week `pos.payment` `read_group` (`session_id × payment_method_id × payment_date:hour`) | `src/lib/__tests__/redo-phase-2/council-advisors-and-probe.test.ts:405` — `maps direct in-branch payment methods distinctly from TGO, TMP, Keeta, and other aggregators in fetchAggregatorHourlyMatrix` |
| `src/lib/council/advisors/delivery.ts:32-36, 73-250` | `detectPauses` & `pauseFindings`: flags pauses ONLY when an aggregator (`talabat-tgo`, `talabat-tmp`, `keeta`) has `0` payouts in an hour while **direct in-branch sales continue** (`directOrders > 0`) vs prior weeks' same weekday-hour history; emits lost sales strictly as `CouncilEstimate` (`label: 'Estimate'`) with explicit `formula` & `inputs`, split by **TGO vs TMP vs Keeta**, carrying `entities: { branchId, channel, hour, weekday }` | `src/lib/__tests__/redo-phase-2/council-advisors-and-probe.test.ts:483` — `detects pauses split by TGO vs TMP vs Keeta ONLY when direct in-branch sales > 0, with labelled Estimate + formula + inputs & zero untraced numbers`<br>`src/lib/__tests__/redo-phase-2/council-advisors-and-probe.test.ts:990` — `answers Eval Q7 («طلبات توقف عندنا وايد، شنو الحل؟») with real pause hours, branch, TGO/TMP/Keeta split, and Estimate formula`<br>`src/lib/__tests__/council/advisor-council.test.ts:72` — `without the hour × branch × platform matrix: unavailable, data gaps only, no numbers` |
| `src/server/council/service.ts:51-91, 141-147` | `mergeHourlyCarryForwardReports` preserves nightly `delivery` `platform-pause` findings alongside `hr` and `inventory` when `scope === 'hourly'` (`matrix === null`) | `src/lib/__tests__/redo-phase-2/council-advisors-and-probe.test.ts:531` — `carries forward nightly delivery platform-pause findings on hourly runs instead of wiping them when matrix is null` |

---

### Item 2.3 — HR Advisor (`F4`), Inventory Advisor (`F5`) & Production Dump Removal

| File & Exact Lines | Responsibility | Proving Test File & Exact Test Name(s) |
|---|---|---|
| `src/server/council/odoo-reads.ts:428-459`<br>`src/lib/council/sources.ts:18-52, 72-106`<br>`src/lib/council/advisors/hr.ts:24-37, 294-318`<br>`src/server/council/service.ts:124` | `fetchAttendanceInput` checks `fields_get` for `['department_id', 'work_location_id']` (never reading `name`); `resolveWorkLocationBranchId` & `attendanceInputFrom` map `work_location_id` → `branchId` while stripping employee names; `hrAdvisor` emits precise `hr.employee (work_location_id)` `dataGap` when attendance rows lack a branch link | `src/lib/__tests__/redo-phase-2/council-advisors-and-probe.test.ts:566` — `reads work_location_id safely via fields_get, maps work locations to branchId, strips employee names, and emits hr.employee.work_location_id dataGap when unlinked`<br>`src/lib/__tests__/council/advisor-council.test.ts:83` — `counts the real shifts: 865 closed, 186 over 10 h, 137 over 12 h, 135 open (1000-row sample)`<br>`src/lib/__tests__/council/advisor-council.test.ts:94` — `never carries an employee name` |
| `src/lib/council/advisors/inventory.ts:21-110, 136-203, 282-578`<br>`src/server/council/odoo-reads.ts:478-749`<br>`src/server/council/service.ts:119-127` | Includes **Qurain (`qurain` / `QRN/Stock` / `القرين (المطبخ المركزي)`)** as source central kitchen (`fetchQurainTransferInput` + warehouse reconciliation), emitting `qurain-transfer-gap` on unreceived/discrepant transfers or `stock.move` `dataGap` when absent; implements `computeTheoreticalBomVariance` & `fetchBomUsageInput` (`pos.order.line × mrp.bom.line` vs actual `stock.move` consumption) ONLY when `hasBoms === true` and BoM lines exist | `src/lib/__tests__/redo-phase-2/council-advisors-and-probe.test.ts:672` — `compares Qurain (QRN/Stock / القرين) outbound transfers vs branch receipts and emits stock.move dataGap when transfer lines are absent`<br>`src/lib/__tests__/redo-phase-2/council-advisors-and-probe.test.ts:812` — `computes mrp.bom theoretical usage (pos.order.line × mrp.bom.line vs actual) ONLY when hasBoms === true & BoM lines exist, else returns mrp.bom dataGap`<br>`src/lib/__tests__/redo-phase-2/council-advisors-and-probe.test.ts:881` — `fetches mrp.bom + mrp.bom.line + pos.order.line via read-only RPCs in fetchBomUsageInput` |
| `src/services/odoo-live-extractor.service.ts:54-128` | Drops all reads/writes of the stale 31 Oct 1,000-row `venturefoods_odoo_cids1_dump.json` sample from production paths (`listLocalOdooDumpSummary` returns `{ path: '', exists: false, bytes: 0, counts: {}, exportedAt: null }`) | `src/lib/__tests__/redo-phase-2/council-advisors-and-probe.test.ts:870` — `drops stale 31 Oct venturefoods_odoo_cids1_dump.json from production odoo-live-extractor.service.ts` |

---

### Item 2.4 — Feryal Answer Quality (`F6`) & Read-Only Eval CLI (`C8`)

| File & Exact Lines | Responsibility | Proving Test File & Exact Test Name(s) |
|---|---|---|
| `src/lib/feryal-odoo-agent.ts:301-307, 421-485, 575-715, 1018-1035, 2659-3139` | 3-decimal fils (`formatKwd3`) on all factual KWD amounts; removes all legacy 4-part filler (`الإجراء المحدد` / formula-free `الأثر المتوقع (تقدير)`) and `0.000 د.ك غير منسوب لفرع` clutter; replaces generic connection openers with specific 1-line missing Odoo model/field statements; runs `verifyFeryalReplyNumbers` + Estimate formula check on combined post-synthesis text; appends universal `• المصدر: Odoo 17 · <model> · الفترة: <window> · آخر مزامنة: <sync>` footer | `src/lib/__tests__/redo-phase-2/feryal-22-eval.test.ts:274` — `eliminates 100% of legacy 4-part filler, 0.000 unattributed clutter, generic connection openers, and unlabelled estimates across all 22 answers`<br>`src/lib/__tests__/redo-phase-2/feryal-22-eval.test.ts:330` — `matches the real payload to the exact 3-decimal fils (0.001 KWD) and passes post-synthesis number guard + footer on all 22 answers`<br>`src/lib/__tests__/redo-phase-2/feryal-22-eval.test.ts:397` — `gives concrete branch/hour/model answers or precise domain dataGaps on Q6, Q7, Q8, Q9, and routes Q10 away from GL` |
| `src/lib/feryal/advisor-synthesis.ts:32-207, 242-416, 441-542, 580-696` | Multi-domain `detectAdvisoryTopics` (e.g. Q6 → `['sales', 'delivery', 'hr']`), strict topic/branch scoping (never dumping `Assima -15.3%` onto unrelated domains or company-wide factual lookups), `seenFingerprints` deduplication (`<= 1` per conversation), and unified cross-advisor root cause & interleaved action plan when `>= 2` advisors flag the same `branchId` OR same `hour` | `src/lib/__tests__/redo-phase-2/feryal-22-eval.test.ts:298` — `enforces conversation-wide diversity: every advisor finding appears at most once (<= 1) across all 22 turns`<br>`src/lib/__tests__/redo-phase-2/feryal-22-eval.test.ts:427` — `synthesizes ONE unified root cause and ONE plan citing BOTH advisors evidences when >= 2 advisors flag the same branch OR same hour` |
| `src/lib/feryal-intent.ts:157-184, 369-374, 1029-1040, 1428-1520, 1544-1605` | `QURAIN_FERYAL_BRANCH` & `ALL_FERYAL_BRANCHES` (including canteens, booths, and Qurain once audited), Levantine `مبارح` / `البارحة` normalization, `isSalarySeasonReadinessQuestion` (routing Q10 away from GL), `isHrOvertimeOrShiftQuestion` (`hr_overtime` for Q8), and shared `sanitizeSeenFingerprints` | `src/lib/__tests__/redo-phase-2/feryal-22-eval.test.ts:556` — `includes school-canteens, exhibitions, and qurain (once in payload) in branch lists with zero 0.000 unattributed`<br>`src/lib/__tests__/redo-phase-2/feryal-22-eval.test.ts:621` — `resolves all 8 yesterday dialect forms (including Levantine «مبارح» without leading alef)` |
| `src/server/ai/council.ts:79, 95, 100, 250-271, 299, 361`<br>`src/app/api/erp/feryal/chat/route.ts:16, 45, 74, 128-152`<br>`src/app/api/erp/feryal/route.ts:15, 47-49, 91, 104`<br>`src/app/api/feryal/route.ts:17, 50-52, 136, 150`<br>`src/components/erp/feryal-governance-studio.tsx:31, 608-625, 1289` | Connects `latestCouncilSnapshot()` and `seenFingerprints` / `usedFingerprints` across main chat route, legacy routes, `runFeryalCouncil`, and `FeryalGovernanceStudio`, mounts `<TodaysDiscoveries />` in Feryal Studio, and preserves `allowAuditor: false` (`403` on POST for `auditor`) | `src/lib/__tests__/redo-phase-2/feryal-22-eval.test.ts:651` — `connects council + seenFingerprints across runFeryalCouncil, POST /api/erp/feryal/chat, and client payload helpers while keeping auditor 403` |
| `scripts/feryal-eval-readonly.mjs:1-443`<br>`docs/redo/feryal-eval.md:1-391` | Offline read-only 22-question CLI (`skipAuditLog: true`, 12 council + 10 ported dialect questions, zero DB/Odoo/env writes) + verbatim 22-answer report & report-only `C8` auditor eval proposal | `src/lib/__tests__/redo-phase-2/feryal-22-eval.test.ts:760` — `provides C8 read-only CLI + docs/redo/feryal-eval.md with all 22 answers, preserves auditor RBAC, and contains zero hand-typed KWD literals`<br>`src/lib/__tests__/council/feryal-council-eval.test.ts:54` — `$id ($kind): $question`<br>`src/lib/__tests__/phase-5/feryal-real-dialect-questions.test.ts:103` — `$question` |

---

### Item 2.5 — Seasons (`F7`)

| File & Exact Lines | Responsibility | Proving Test File & Exact Test Name(s) |
|---|---|---|
| `src/lib/council/advisors/seasons.ts:40-41, 52-60, 66-84, 223-231` | Removes unrequested `winter-2026` and `summer-2027` assumptions; keeps Ramadan, both Eids, and school dates `approximate: true`; sets `needsOwnerConfirmation: true` on `salary-days` (`2026-11-25 → 2026-12-01`) until owner-edited; adds `mergeSeasonEvents(stored, defaults)` so partial saves confirm `salary-days` without wiping other suggested occasions; notes `يحتاج تأكيد المالك` / `needs owner confirmation` in unconfirmed `rootCause` | `src/lib/__tests__/redo-phase-2/seasons-and-cron-safety.test.ts:48` — `removes winter/summer assumptions, marks Hijri & school dates approximate, and flags salary-days needsOwnerConfirmation`<br>`src/lib/__tests__/redo-phase-2/seasons-and-cron-safety.test.ts:77` — `computes real historical salary-window evidence from loadLiveTodaySummary() and labels unconfirmed rootCause until confirmed`<br>`src/lib/__tests__/redo-phase-2/seasons-and-cron-safety.test.ts:119` — `mergeSeasonEvents preserves all suggested events when only salary-days is saved, and clears needsOwnerConfirmation` |
| `src/server/council/store.ts:154, 164-187`<br>`src/app/api/erp/seasons/route.ts:3, 14-24` | `validateSeasonEvent` sets `needsOwnerConfirmation: false`; `listSeasonEvents` and `GET /api/erp/seasons` merge stored DB rows via `mergeSeasonEvents` while keeping `suggested: true` when no DB rows exist | `src/lib/__tests__/redo-phase-2/seasons-and-cron-safety.test.ts:160` — `POST /api/erp/seasons editing salary-days confirms it without wiping Ramadan, Eids, or school dates on GET` |
| `src/components/erp/SeasonsStudio.tsx:55, 72-80, 96-100, 107, 130-134, 179-198` | Renders calm neutral slate badge `«يحتاج تأكيد المالك»` / `"Needs owner confirmation"` (`data-needs-owner-confirmation="true"`) on `salary-days`, keeps `«تقريبي»` / `"approximate"` on approximate Hijri/school dates, removes all `amber` classes, and clears `needsOwnerConfirmation: false` on edit & save | `src/lib/__tests__/redo-phase-2/seasons-and-cron-safety.test.ts:255` — `%s: shows Needs owner confirmation on salary-days, approximate on Hijri/school dates, and zero amber classes`<br>`src/lib/__tests__/redo-phase-2/seasons-and-cron-safety.test.ts:282` — `%s: clears Needs owner confirmation badge once salary-days is edited & saved`<br>`src/lib/__tests__/council/council-ui.test.ts:39` — `%s: salary days show the comparison and prep plan; Ramadan shows its data gap` |

---

### Item 2.6 — Cron & Storage Safety (`F8/F9`)

| File & Exact Lines | Responsibility | Proving Test File & Exact Test Name(s) |
|---|---|---|
| `vercel.json:3-16` | Removes `/api/cron/council?scope=hourly` and `/api/cron/council?scope=nightly` schedules so council crons are **OFF by default**; leaves pre-existing crons and redirects untouched | `src/lib/__tests__/redo-phase-2/seasons-and-cron-safety.test.ts:322` — `vercel.json removes /api/cron/council schedules while keeping pre-existing crons intact` |
| `src/server/council/store.ts:21-23`<br>`src/app/api/cron/council/route.ts:5, 21-30` | Adds `isCouncilCronEnabled` (`raw?.trim().toLowerCase() === 'true'`, **OFF** by default) and gates `GET /api/cron/council` after `cronAuthorized(request)`, returning HTTP `200` `{ ok: true, skipped: true, reason: 'COUNCIL_CRON_DISABLED' }` when disabled | `src/lib/__tests__/redo-phase-2/seasons-and-cron-safety.test.ts:331` — `isCouncilCronEnabled is OFF unless explicitly set to "true"`<br>`src/lib/__tests__/redo-phase-2/seasons-and-cron-safety.test.ts:343` — `GET /api/cron/council enforces CRON_SECRET first, skips when COUNCIL_CRON_ENABLED !== "true", and runs only when enabled` |
| `docs/redo/council-cron-and-0052-runbook.md:1-89` | Documents the exact owner-only production steps: (1) Vercel Pro plan check for hourly crons & `maxDuration = 300`, (2) applying `0052_council_reports_and_seasons.sql` on prod Postgres with a `BYPASSRLS` role, (3) setting `CRON_SECRET` & `COUNCIL_CRON_ENABLED=true`, and (4) optional `vercel.json` snippet | `src/lib/__tests__/redo-phase-2/seasons-and-cron-safety.test.ts:399` — `documents all required owner-only steps in docs/redo/council-cron-and-0052-runbook.md` |

---

## 2. Advisor Council Sample Report Highlights (Real Cached Odoo 17 Payloads)

Computed deterministically by `runCouncil(...)` against `dashboard-today-2026-11-17.json` (`2026-09-14..2026-11-16` completed days, `lastSyncAt: 2026-11-17T03:00:36.564Z`) and the cached Oct 31 audit samples (`untracedNumbers === []` across all 5 reports):

1. **Finance Advisor (`cfo`) — `status: partial` (4 findings, 2 dataGaps)**:
   - `cfo:wow-divergence:assima`: Assima `-15.3%` WoW (`3,285.029 KWD` in `2026-11-10..16` vs `3,877.102 KWD` prior week) vs company `-5.3%`; Estimate `296.037 KWD/week = 50% × (prior-week net − last-week net)`.
   - `cfo:wow-outperformer:avenues`: Avenues `+19.2%` WoW (`2,512.026 KWD` vs `2,107.999 KWD`) vs company `-5.3%`.
   - `cfo:basket-shrink:avenues`: Avenues orders `+13.0%` while AOV fell `-9.4%` (`3.497 KWD/order` vs `3.859 KWD/order` over 28d); Estimate `129.228 KWD/week`.
   - `cfo:weekday-gap:ardiya:5`: Ardiya Friday index `125.0%` vs siblings median `156.8%`; Estimate `106.308 KWD/week`.
   - Data gaps: `pos.order.line` period cube & `account.move.line` locked-month GL (profit withheld).
2. **Delivery Platforms Advisor (`delivery`) — `status: unavailable` offline / `ready` when 5-week `pos.payment` matrix present**:
   - Offline without live `pos.payment` `(config × hour × method)` read: emits `pos.payment` 5-week hourly matrix `dataGap` (zero invented figures).
   - With 5-week `pos.payment` matrix: detects `delivery:pause:<branchId>:<talabat-tgo|talabat-tmp|keeta>` only when `directOrders > 0`, with lost-sales `Estimate` formula & inputs.
3. **HR Advisor (`hr`) — `status: partial` (3 findings, 3 dataGaps, 0 employee names)**:
   - `hr:missed-checkout`: `137` of `865` closed shifts (`15.8%`) ran over `12 h` (`OOH Section`: `79`).
   - `hr:overtime:OOH Section`: `186` shifts over `10 h`, median `9.1 h` vs `9 h` standard; Estimate `98.3 h/week` (`29.5 h/week` 30% reduction target).
   - `hr:open-checkins`: `135` open attendances without `check_out`.
   - Data gaps: `hr.employee (work_location_id)` branch link, `1,000`-row sample cap, and live `hr.attendance.overtime / resource.calendar` probe.
4. **Inventory Advisor (`inventory`) — `status: partial` (1 finding, 3 dataGaps)**:
   - `inventory:negative-quants:360-mall`: `360/Stock` negative on `18` of `94` sampled items (`19.1%`); other internal locations incl. `QRN 0/70` (`QRN/Stock` visible as Qurain Central Kitchen), `ASM 2/126`, `PRM 2/158`, `KOUT 0/97`.
   - Data gaps: full live `stock.quant` read, `stock.move / stock.scrap` (`QRN/Stock` outbound transfers vs branch receipts), and `mrp.bom / mrp.bom.line` recipes.
5. **Seasons Advisor (`seasons`) — `status: partial` (1 finding, 5 dataGaps)**:
   - `seasons:salary-days:2026-11-25`: `+7.0%` historical daily uplift (`4,618.032 KWD/day` in `2026-10-25..31` vs `4,182.893 KWD/day` normal days; `2026-09-25..10-01` also reported; top branch Avenues `+15.5%`); explicitly flagged `يحتاج تأكيد المالك` / `needs owner confirmation` until owner-confirmed; Estimate `3,045.971 KWD` over the event week.

---

## 3. Real Playwright AR + EN (`1440` & `390`) Screenshots (`docs/redo/screenshots/phase-2/`)

Generated via `node scripts/capture-phase2-screenshots.mjs` against a real `next start` production server (`16` PNGs + `manifest.json`, zero runtime/HTTP errors, zero horizontal overflow):

| Surface | Verified Live DOM Assertions (`AR` & `EN`, `1440` & `390`) | Files (`docs/redo/screenshots/phase-2/`) |
|---|---|---|
| **Today's Discoveries (Close-up)** | 3 ranked real council cards (`seasons:salary-days:2026-11-25`, `inventory:negative-quants:360-mall`, `hr:missed-checkout`), 3-decimal KWD / count evidence, Odoo source + sync, Why, Proposals, and labelled `Estimate` formulas | `todays-discoveries__{ar-1440,en-1440,ar-390,en-390}.png` |
| **ERP Home (`/erp`)** | Full dashboard + embedded Today's Discoveries (`[data-todays-discoveries="true"]`) | `erp-home-discoveries__{ar-1440,en-1440,ar-390,en-390}.png` |
| **Feryal AI Studio (`/erp/feryal-ai`)** | Feryal Studio + embedded Today's Discoveries (`[data-todays-discoveries="true"]`) + Odoo 17 query chips | `erp-feryal-ai__{ar-1440,en-1440,ar-390,en-390}.png` |
| **Seasons & Occasions (`/erp/seasons`)** | `salary-days` shows `«يحتاج تأكيد المالك»` / `"Needs owner confirmation"` (`data-needs-owner-confirmation="true"`) + historical comparison & prep plan; Ramadan, Eids & school dates show `«تقريبي»` / `"approximate"`; zero `winter-2026`/`summer-2027` cards; zero `amber` classes | `erp-seasons__{ar-1440,en-1440,ar-390,en-390}.png` |
