# AetherBI Overnight Audit & Polish — Execution Plan (`overnight-plan.md`)

- **Repository:** `werech21-lab/restaurant-ai-hq` (`F:\restaurant-ai-hq-complete\restaurant-ai-hq-complete\restaurant-ai-hqw`)
- **Branch:** `fix/aetherbi-followup-2026-11-16` (tracking `origin/fix/aetherbi-followup-2026-11-16`)
- **Base Commit (Phase 13 green):** `b5485414fd0fcab1a77bffcae7666260778c48c9`
- **Current `HEAD` SHA:** `d61b35c6cc32f31d1595838741a2e6424614ea33` (`fix(odoo): surface partial sub-query failures as null with warning and fail batch sync on query errors`)
- **Recorded By:** `plan-baseline` (Gemini 4 Carbon High) on `2026-11-16`
- **Phase Docs Inventory at Start:**
  - `docs/phases/phase-1-checklist.md` … `docs/phases/phase-13-checklist.md`: Present
  - `docs/phases/phase-14-checklist.md`: **Already present** (added in `d61b35c`, 65 lines)
  - `docs/phases/overnight-plan.md`: Created in this step (uncommitted pending `reviewer-carbon` gate)
  - `docs/phases/overnight-report.md`: Not yet created (scheduled for Phase C final gate)

---

## 1. Baseline Verification Metrics (`HEAD = d61b35c6cc32f31d1595838741a2e6424614ea33`)

All baseline checks were executed synchronously in sequence on `F:\restaurant-ai-hq-complete\restaurant-ai-hq-complete\restaurant-ai-hqw`:

| Check | Command | Exit Code | Exact Result & Operational Notes |
| --- | --- | --- | --- |
| Prisma Client Sync Note | `npx.cmd tsc --noEmit` (cold, pre-`prisma generate`) | `2` -> **`0`** | Cold `tsc` immediately after switching from `main` to `fix/aetherbi-followup-2026-11-16` hit 6 stale `@prisma/client` type errors in `src/server/ai/persist.ts` (`aiRun`, `aiDailyBrief`) because `node_modules/@prisma/client` still reflected `main`. Once `prisma generate` ran (via `npm.cmd run build`), standalone `npx.cmd tsc --noEmit` exited **`0` (0 errors)**. **Rule for all workers:** run `npx.cmd prisma generate` in any fresh worktree before standalone `tsc`. |
| TypeScript (`tsc`) | `npx.cmd tsc --noEmit` | **`0`** | Zero type errors across the entire repository. |
| Unit & Integration Suite (`vitest`) | `npx.cmd vitest run` | **`0`** | **`115` test files passed (`115/115`), `1,399` tests passed (`1399/1399`)** in `715.75s`. |
| Temp File Hygiene | `C:\tmp` & `os.tmpdir()` scan | **`0` leftovers** | `0` `aetherbi-vitest-*` files in `C:\tmp`, `0` `aetherbi-vitest-*` files in `os.tmpdir()`, `0` `vf-vitest-run-*` files in `os.tmpdir()`. |
| Local SQLite Integrity | `git diff prisma/dev.db` | **Empty (`0` bytes)** | `prisma/dev.db` completely untouched. |
| Production Build (`next build`) | `npm.cmd run build` (`prisma generate && next build`) | **`0`** | Next.js `15.5.28` compiled cleanly (`21/21` static pages + all `109` `page.tsx` routes and API routes). Only `3` non-blocking `@next/next/no-img-element` ESLint warnings remain (`src/app/(panel)/hr/payroll/[id]/print/page.tsx:54`, `src/app/(panel)/settings/apps/page.tsx:37`, `src/app/download/page.tsx:34`) — scheduled for cleanup in Phase C. |

---

## 2. Forensic Audit of WIP Commit `d61b35c` (`b548541..HEAD`) vs. Phase A Requirements

- **Overall Diff (`git diff --stat b548541..HEAD`):** `23 files changed, 3781 insertions(+), 1119 deletions(-)`
- **Test Diff (`git diff --stat b548541..HEAD -- '**/__tests__/**'`):** `2 files changed, 975 insertions(+), 26 deletions(-)`:
  - `src/lib/__tests__/phase-14-partial-and-batch.test.ts` (`+943`, new file, `28` tests)
  - `src/lib/__tests__/phase-13-count-atomicity.test.ts` (`+32 / -26` — updated **only** lines `233–240` and `351–384` where Phase 13 previously asserted `0` / `undefined` fallback on wrapped sub-query count failures, upgrading those assertions to require `null`, `partial: true`, and `diagnosticCode === 'PARTIAL_LIVE'` per Blocker N2 while keeping every Phase 13 N1 atomicity check intact; all `113` Phase 1–12 test files have `0` diff lines).

### 2.1 What `d61b35c` Already Completed Correctly

1. **Blocker N2 — Connector & Envelope Contract (`src/lib/odoo-live-connector.ts`, `src/lib/odoo/live-sync-core.ts`):**
   - `safeSubQuery(fn, fallback, onFailure)` (`odoo-live-connector.ts:1324-1335`) records every failed wrapped section key in per-pull `unavailableSectionSet` (`markFailure(section)`) without logging raw Odoo URLs, credentials, or raw RPC errors.
   - Envelope and `OdooLiveSummary` expose `partial: boolean`, `unavailableSections: string[]`, `warningAr: "بعض الأرقام غير متاحة الآن"`, `warningEn: "Some figures are temporarily unavailable"`, and `diagnosticCode: 'PARTIAL_LIVE'` whenever `unavailableSections.length > 0`, and `partial: false`, `unavailableSections: []`, `diagnosticCode: 'OK_LIVE'` (with `warningAr`/`warningEn` omitted) on normal runs (`odoo-live-connector.ts:3293-3296, 3489-3496, 3572-3579`).
   - All 7 core wrapped pairs (`hourly`, `channels.month`, `channels.week`, `channels.today`, `channels.year`, `year`, `journeyPulse`) set their failed outputs (`hourlySeries`, `bucket.uiChannels`, `year.totals`, `journeyPulse`) to `null` (never `0`), suppress silent fallback to `pricelistUiHints30` when `channels.month` fails (`odoo-live-connector.ts:3058`), and never compute AOV from `null`.
   - Primary fail-closed paths (`ordersByDaySessionPricelist`, `fetchLiveOdooPeriodCube`, `fetchLiveOdooSummary`) remain strictly fail-closed (`connected: false` / rejection).
   - `<OdooPartialWarningBanner />` (`src/components/erp/OdooPartialWarningBanner.tsx`) renders `role="alert"` + `data-odoo-partial-warning="true"` when `summary?.partial === true` and is mounted on primary studios (`FullJourney360`, `CoresHubStudio`, `DeliveryRadarV5`, `ExecutivePnlStudio`, `SalesScorecardStudio`) plus all remaining `/erp/*` routes via `TopFilterBar.tsx:1823`.
   - `phase-14-partial-and-batch.test.ts` verifies `count`, `net`, and `both` failure modes across all 7 wrapped pairs (`21` parameterized tests), normal-run refund/count invariants (`10` positive + `1` big refund -> `9` orders, net `-20`; refund-only -> `0` orders, net `-45`; tooltip domain `["amount_total",">=",0]` parity), and SSR markup checks on `FullJourney360` and `DeliveryRadarV5`.

2. **Item B — Batch Sync & Dataset (`scripts/sync-odoo-live.mjs`, `scripts/build-odoo-dataset.mjs`, `src/lib/odoo/odoo-dataset.ts`, `src/lib/aether/ledger.ts`):**
   - `Math.round(netVal / 4.8)` is completely removed from `scripts/sync-odoo-live.mjs` (verified by source scan + test).
   - `salesQuery(model, label, fn)` (`sync-odoo-live.mjs:205-216`) rethrows any non-`isAccessError` failure so `runSyncOdooLive` rejects and exits non-zero **before** `writeFile(JOURNEY_OUT, ...)` or `writeFile(SNAPSHOT, ...)` executes; on `isAccessError`, it records the model in `permissions.missingRead` and returns `null`.
   - `scripts/build-odoo-dataset.mjs` (`buildOdooDataset`), `src/lib/odoo/odoo-dataset.ts`, and `src/lib/aether/ledger.ts` (`fmt`, `kwd`, `pct`) type and format `null` orders/AOV as `"—"` (never `0`).

3. **Protected Logic Integrity:**
   - `git diff b548541..HEAD` confirms **zero** changes to `src/lib/odoo/company-pos.ts`, `src/lib/odoo/excluded-entities.ts`, `src/lib/odoo/pos-order-query.ts`, `src/lib/odoo/pos-registry.json`, `src/modules/odoo/domain/console.ts`, `src/server/ai/structured-claim.ts`, `src/lib/governance-pin.ts`, `src/app/api/erp/governance/route.ts`, `src/lib/db.ts`, `vitest.config.mts`, `src/lib/__tests__/support/vitest-global-setup.ts`, or Feryal 2-of-3 consensus modules.

---

### 2.2 Exact Remaining Phase A Gaps (`A1`–`A6`) Required to Finish Phase A

Our line-by-line audit of `d61b35c` identified **6 remaining Phase A defects** where failed `safeSubQuery` sections or missing Odoo read permissions still coerce `null`/`undefined` into `0` (`0 KWD`, `0%`, `0 orders`, or forced 100% bucket allocation):

| Gap ID | File & Exact Lines | Defect Found in `d61b35c` | Required Fix & RED-First Test |
| --- | --- | --- | --- |
| **A1** | `src/components/erp/SalesScorecardStudio.tsx:130-133, 146-243` | When `brands.<period>`, `channels.<period>`, or `year` fails, `cascadingOptions` sets `opt.salesKwd = undefined`, but `SalesScorecardStudio` evaluates `const sales = b.salesKwd ?? 0` / `br.salesKwd ?? 0` / `ch.salesKwd ?? 0` and `share = workspace.salesKwd > 0 ? ... : 0`, rendering **`0 KWD` (`0.0%`)** for every brand, branch, and channel row instead of `"غير متاح"` / `"—"`. | Render `"غير متاح"` (AR) / `"—"` (EN) and `"—"` share whenever `opt.salesKwd === undefined` or `workspace.nullableSalesKwd === null`. Add SSR test in `phase-14-partial-and-batch.test.ts` asserting `SalesScorecardStudio` never renders `0 KWD` / `0.0%` when `brands.month`, `channels.month`, or `year` fails. |
| **A2** | `src/components/erp/ExecutivePnlStudio.tsx:286-338` | `brandRows.map` and `branchRows.map` evaluate `const sales = b.salesKwd ?? 0` and `br.salesKwd ?? 0`, rendering **`0 KWD (0.0%)`** with a 2% progress bar when `brands.<period>` or `year` fails. | Render `"غير متاح"` / `"—"` (and suppress progress fill) when `b.salesKwd === undefined` / `br.salesKwd === undefined` or `workspace.nullableSalesKwd === null`. Add SSR test assertion in `phase-14-partial-and-batch.test.ts`. |
| **A3** | `src/lib/aether/cores-hub-engine.ts:195-215, 716-785, 845-960` & `src/components/aether/CoresHubStudio.tsx:743-828, 871-920` | (1) When `year` fails (`activeBucket.totals.restaurantNetKwd === null`, `byLocation === null`), `cores-hub-engine.ts:718-733` falls through to `safeNum(wsOpt?.salesKwd)` -> `0`, rendering all branches + `unattributed` in `CoresHubStudio` as **`0.000 KWD` / `0 orders · 0.0%`**. (2) `brandsUnavailable` is computed in `cores-hub-engine.ts:672` but never exposed on `snapshot.sales` (nor `menuUnavailable` when `products` or `brands.<period>` fails), leaving `CoresHubStudio` with a blank brand card and **`0` SKUs / `0` units / `0.000 KWD`** on the Menu tab instead of `"غير متاح"` / `"—"`. | Expose `branchesUnavailable` and `brandsUnavailable` on `snapshot.sales` and `menuUnavailable` on `snapshot.menu`; render `"غير متاح"` / `"—"` in `CoresHubStudio` Branch, Brand, and Menu sections when unavailable. Add SSR test in `phase-14-partial-and-batch.test.ts`. |
| **A4** | `src/lib/aether/global-filter-engine.ts:1656-1686`, `src/components/aether/FullJourney360.tsx:1279-1313`, `src/components/erp/ReceivablesAgingStudio.tsx:66-116`, `src/components/accounting/VentureAccountingHub.tsx:212-300` | `pullFreshCoreSnapshotFromOdoo` wraps receivables in `safeSubQuery(..., null, markFailure('receivables'))`, setting `liveSummary.aggregatorReceivables = null`. Yet `global-filter-engine.ts:1682` falls back to `buildEmptyReceivables(...)` (`openReceivableKwd: 0`, `unreconciledLineCount: 0`), so `FullJourney360`, `ReceivablesAgingStudio`, and `VentureAccountingHub` render **`0.000 KWD` and `0` lines** on query failure! Also `VentureAccountingHub` (used on `/accounting` outside `/erp`) lacks `<OdooPartialWarningBanner />`. | Add `unavailable: boolean` (and nullable KWD/count display guards) on `WorkspaceReceivablesMeta` when `liveSummary.aggregatorReceivables === null` (or `'receivables'` in `unavailableSections`); render `"غير متاح"` / `"—"` across `FullJourney360`, `ReceivablesAgingStudio`, and `VentureAccountingHub`, and mount `<OdooPartialWarningBanner />` in `ReceivablesAgingStudio` & `VentureAccountingHub` (when `!embeddedInErp`). Verify `stockTransfers === null` is never rendered as `0`. |
| **A5** | `src/lib/odoo-live-connector.ts:3401-3411, 3518-3529` & `src/lib/aether/global-filter-engine.ts:988-1009, 1687-1704` | (1) When `bucketTotalsUnavailable === true` (e.g. `year` failed), `formatEnvelopeFromCore` emits `companyTotals.grossPreExclusionKwd: 0`, `reconciliationGapKwd: 0`, and `reconciledExact: true` instead of `null` / `false`. (2) When `hourly` (`hourlySeries === null`) or bucket totals fail, `computeGlobalWorkspace` passes `quietHoursActualKwd = 0` into `buildSummaryCards`, causing card #6 (`Quiet Hours Sales 3–6 PM`) to display **`0.00 د.ك` (`🟢`)** instead of `"غير متاح"` / `"—"` (`🟠`). | Make `grossPreExclusionKwd` and `reconciliationGapKwd` `number | null` (`null` and `reconciledExact: false` when `bucketCompanyNet === null`), and pass `quietHoursActualKwd: number | null` (`null` when `hourlySectionUnavailable || sectionUnavailable`) so summary card #6 renders `"غير متاح"` / `"—"` (`🟠`). |
| **A6** | `scripts/sync-odoo-live.mjs:215-252, 790-805, 934-937, 1058-1128` & `scripts/odoo-journey-extract.mjs:201-243` | (1) When `pos.payment` fails with `AccessError` (`bPay === null`, `bPayReadable === false`) while `bSess` succeeds (`locTarget > 0`), `reconcileAmounts` (`rawSum <= 0`) dumps **100% of `locTarget` into `'dine-in'`** (`keys[0]`) and `0` into the other 7 channels instead of `null`. (2) Same bug when `pos.order.line` fails with `AccessError` (`bLines === null`): `reconcileAmounts` dumps **100% of `targetNet` into `'china-garden'`** and `0` into the other 5 brands. (3) Rolling-30 `brands[i].netKwd` defaults to `0` (`brandNet.get(b.id) || 0`) when `pos.order` or `pos.order.line` has `AccessError`. (4) Master-data sales prerequisites (`pos.config`, `pos.category`, `pos.payment.method` `search_read`) and POS queries in `scripts/odoo-journey-extract.mjs:201-243` still use `safe(..., [])`, allowing non-permission HTTP 502 errors to write partial/zeroed files. | Guard `extractBucket` and rolling-30 brand/channel builders so `AccessError` on `pos.payment` or `pos.order.line` emits `null` (`netKwd: null, orders: null`), never reconciling unknown breakdowns into `'dine-in'` or `'china-garden'`; route POS master-data & journey POS queries through `salesQuery` so any non-permission failure exits non-zero before writing `JOURNEY_OUT` or `SNAPSHOT`. Add unit tests in `phase-14-partial-and-batch.test.ts` and update `docs/phases/phase-14-checklist.md`. |

---

## 3. Complete Route Inventory — All 109 `page.tsx` Routes (`Tier 1`, `Tier 2`, `Tier 3`)

Verified 1-to-1 against `Get-ChildItem -Path src/app -Recurse -Filter "page.tsx"` (`24 + 52 + 33 = 109` routes total).

### 3.1 Tier 1 — Executive, Live Odoo POS/GL, Comparison, SLA & AI Command Surfaces (24 Routes)

| # | URL Route | Source File (`src/app/...`) | Primary Studio / Component | Phase B Shard |
| --- | --- | --- | --- | --- |
| 1 | `/erp` | `src/app/erp/page.tsx` | `FullJourney360` | `tier1-overview` |
| 2 | `/erp/cores` | `src/app/erp/cores/page.tsx` | `CoresHubStudio` | `tier1-cores` |
| 3 | `/erp/sales-analysis` | `src/app/erp/sales-analysis/page.tsx` | `CoresHubStudio` (`sales`) | `tier1-cores` |
| 4 | `/erp/menu-engineering` | `src/app/erp/menu-engineering/page.tsx` | `CoresHubStudio` (`menu`) | `tier1-cores` |
| 5 | `/erp/sales-scorecard` | `src/app/erp/sales-scorecard/page.tsx` | `SalesScorecardStudio` | `tier1-finance-score` |
| 6 | `/erp/brand-sales-analytics` | `src/app/erp/brand-sales-analytics/page.tsx` | `BrandSalesAnalyticsDashboard` | `tier1-cores` |
| 7 | `/erp/aggregator-radar` | `src/app/erp/aggregator-radar/page.tsx` | `DeliveryRadarV5` | `tier1-delivery-comp` |
| 8 | `/erp/before-after` | `src/app/erp/before-after/page.tsx` | `BeforeAfterStudio` | `tier1-delivery-comp` |
| 9 | `/erp/weekday-comparison` | `src/app/erp/weekday-comparison/page.tsx` | `WeekdayComparisonStudio` | `tier1-delivery-comp` |
| 10 | `/erp/executive-pnl` | `src/app/erp/executive-pnl/page.tsx` | `ExecutivePnlStudio` | `tier1-finance-score` |
| 11 | `/erp/finance` | `src/app/erp/finance/page.tsx` | `VentureAccountingHub` | `tier1-finance-score` |
| 12 | `/erp/ledger` | `src/app/erp/ledger/page.tsx` | `LedgerWorkspace` | `tier1-finance-score` |
| 13 | `/erp/receivables` | `src/app/erp/receivables/page.tsx` | `ReceivablesAgingStudio` | `tier1-finance-score` |
| 14 | `/erp/cost-intelligence` | `src/app/erp/cost-intelligence/page.tsx` | `CostIntelligenceV2` | `tier1-ops-sla` |
| 15 | `/erp/warehouse-chain` | `src/app/erp/warehouse-chain/page.tsx` | `WarehouseDailyChainStudio` | `tier1-ops-sla` |
| 16 | `/erp/prep-sla` | `src/app/erp/prep-sla/page.tsx` | `PrepSlaPage` / SLA studio | `tier1-ops-sla` |
| 17 | `/erp/delivery-sla` | `src/app/erp/delivery-sla/page.tsx` | `DeliverySlaPage` / SLA studio | `tier1-ops-sla` |
| 18 | `/erp/odoo-sync` | `src/app/erp/odoo-sync/page.tsx` | `OdooSync` + `AdminPosTerminalMappingPanel` | `tier1-ops-sla` |
| 19 | `/erp/feryal-ai` | `src/app/erp/feryal-ai/page.tsx` | `FeryalGovernanceStudio` | `tier1-ai-gov` |
| 20 | `/erp/feryal` | `src/app/erp/feryal/page.tsx` | Feryal redirect / entry | `tier1-ai-gov` |
| 21 | `/erp/ai-brief` | `src/app/erp/ai-brief/page.tsx` | Executive AI Daily Brief | `tier1-ai-gov` |
| 22 | `/erp/alerts` | `src/app/erp/alerts/page.tsx` | Alerts Radar | `tier1-ai-gov` |
| 23 | `/erp/governance` | `src/app/erp/governance/page.tsx` | Governance Studio | `tier1-ai-gov` |
| 24 | `/dashboard` | `src/app/(panel)/dashboard/page.tsx` | Panel Executive Dashboard (`OdooAiCommandCenter`) | `tier1-overview` |

### 3.2 Tier 2 — Operational `/erp/*` Domain Pages & Core `(panel)` / POS / KDS Modules (52 Routes)

| # | URL Route | Source File (`src/app/...`) | Domain / Module | Phase B Shard |
| --- | --- | --- | --- | --- |
| 25 | `/erp/ai` | `src/app/erp/ai/page.tsx` | ERP AI Command | `tier2-erp-intel` |
| 26 | `/erp/booth-feasibility` | `src/app/erp/booth-feasibility/page.tsx` | EXB & Booth Feasibility | `tier2-erp-intel` |
| 27 | `/erp/competitors` | `src/app/erp/competitors/page.tsx` | Market Competitors | `tier2-erp-intel` |
| 28 | `/erp/compliance` | `src/app/erp/compliance/page.tsx` | Regulatory Compliance | `tier2-erp-ops` |
| 29 | `/erp/contracts` | `src/app/erp/contracts/page.tsx` | Vendor & Lease Contracts | `tier2-erp-ops` |
| 30 | `/erp/crm` | `src/app/erp/crm/page.tsx` | ERP CRM Workspace | `tier2-erp-comm` |
| 31 | `/erp/delivery` | `src/app/erp/delivery/page.tsx` | ERP Delivery Operations | `tier2-erp-comm` |
| 32 | `/erp/delivery-control` | `src/app/erp/delivery-control/page.tsx` | Delivery Dispatch Control | `tier2-erp-comm` |
| 33 | `/erp/demand-forecast` | `src/app/erp/demand-forecast/page.tsx` | Demand Forecasting | `tier2-erp-intel` |
| 34 | `/erp/events-intelligence` | `src/app/erp/events-intelligence/page.tsx` | Kuwait Events Intelligence | `tier2-erp-intel` |
| 35 | `/erp/events-projects` | `src/app/erp/events-projects/page.tsx` | Events & Seasonal Projects | `tier2-erp-intel` |
| 36 | `/erp/food-safety` | `src/app/erp/food-safety/page.tsx` | HACCP & Batch Food Safety | `tier2-erp-ops` |
| 37 | `/erp/hr` | `src/app/erp/hr/page.tsx` | ERP HR & Workforce | `tier2-erp-ops` |
| 38 | `/erp/intelligence` | `src/app/erp/intelligence/page.tsx` | Enterprise Intelligence | `tier2-erp-intel` |
| 39 | `/erp/inventory` | `src/app/erp/inventory/page.tsx` | ERP Inventory & Balances | `tier2-erp-ops` |
| 40 | `/erp/kds` | `src/app/erp/kds/page.tsx` | ERP Kitchen Display | `tier2-erp-ops` |
| 41 | `/erp/kitchen` | `src/app/erp/kitchen/page.tsx` | Central Kitchen Studio | `tier2-erp-ops` |
| 42 | `/erp/market` | `src/app/erp/market/page.tsx` | Market Radar | `tier2-erp-comm` |
| 43 | `/erp/marketing` | `src/app/erp/marketing/page.tsx` | Campaigns & Marketing | `tier2-erp-comm` |
| 44 | `/erp/operations` | `src/app/erp/operations/page.tsx` | Field Operations | `tier2-erp-ops` |
| 45 | `/erp/planning` | `src/app/erp/planning/page.tsx` | Executive Planning | `tier2-erp-intel` |
| 46 | `/erp/procurement` | `src/app/erp/procurement/page.tsx` | P2P Procurement Workspace | `tier2-erp-ops` |
| 47 | `/erp/projects` | `src/app/erp/projects/page.tsx` | Expansion Projects | `tier2-erp-intel` |
| 48 | `/erp/recipes` | `src/app/erp/recipes/page.tsx` | ERP Recipes & BOM | `tier2-erp-ops` |
| 49 | `/erp/regulations` | `src/app/erp/regulations/page.tsx` | Kuwait Municipality & Law | `tier2-erp-ops` |
| 50 | `/erp/sales-crm` | `src/app/erp/sales-crm/page.tsx` | B2B Catering & Sales CRM | `tier2-erp-comm` |
| 51 | `/erp/smart-dropzone` | `src/app/erp/smart-dropzone/page.tsx` | AI Document Dropzone | `tier2-erp-comm` |
| 52 | `/erp/social-reviews` | `src/app/erp/social-reviews/page.tsx` | Guest & Social Reviews | `tier2-erp-comm` |
| 53 | `/kds` | `src/app/(kds)/kds/page.tsx` | Standalone KDS Board | `tier2-panel-ops` |
| 54 | `/pos` | `src/app/(pos)/pos/page.tsx` | Standalone Offline-Capable POS | `tier2-panel-ops` |
| 55 | `/accounting` | `src/app/(panel)/accounting/page.tsx` | Panel Accounting & GL | `tier2-panel-fin` |
| 56 | `/accounting/reconciliation` | `src/app/(panel)/accounting/reconciliation/page.tsx` | Bank & POS Reconciliation | `tier2-panel-fin` |
| 57 | `/bi-analytics` | `src/app/(panel)/bi-analytics/page.tsx` | Panel BI Analytics | `tier2-panel-fin` |
| 58 | `/central-kitchen` | `src/app/(panel)/central-kitchen/page.tsx` | Panel Central Kitchen | `tier2-panel-ops` |
| 59 | `/crm` | `src/app/(panel)/crm/page.tsx` | Panel CRM & Quotations | `tier2-panel-fin` |
| 60 | `/delivery-hub` | `src/app/(panel)/delivery-hub/page.tsx` | Panel Delivery Hub | `tier2-panel-ops` |
| 61 | `/hr` | `src/app/(panel)/hr/page.tsx` | Panel HR & Payroll | `tier2-panel-hr` |
| 62 | `/hr/compliance-radar` | `src/app/(panel)/hr/compliance-radar/page.tsx` | Civil ID / Visa Expiry Radar | `tier2-panel-hr` |
| 63 | `/hr/smart-folder-upload` | `src/app/(panel)/hr/smart-folder-upload/page.tsx` | HR Dossier Smart Upload | `tier2-panel-hr` |
| 64 | `/inventory` | `src/app/(panel)/inventory/page.tsx` | Panel Inventory Items | `tier2-panel-ops` |
| 65 | `/payments` | `src/app/(panel)/payments/page.tsx` | Panel Payments | `tier2-panel-fin` |
| 66 | `/purchases` | `src/app/(panel)/purchases/page.tsx` | Panel Purchase Orders | `tier2-panel-ops` |
| 67 | `/purchases/suppliers/[id]` | `src/app/(panel)/purchases/suppliers/[id]/page.tsx` | Supplier Statement Detail | `tier2-panel-ops` |
| 68 | `/recipes` | `src/app/(panel)/recipes/page.tsx` | Panel Recipes | `tier2-panel-ops` |
| 69 | `/reports` | `src/app/(panel)/reports/page.tsx` | Enterprise Reports Registry | `tier2-panel-fin` |
| 70 | `/sales` | `src/app/(panel)/sales/page.tsx` | Panel Sales Invoices | `tier2-panel-fin` |
| 71 | `/sales/customers/[id]` | `src/app/(panel)/sales/customers/[id]/page.tsx` | Customer Statement Detail | `tier2-panel-fin` |
| 72 | `/smart-ingest/[module]` | `src/app/(panel)/smart-ingest/[module]/page.tsx` | Departmental Smart Ingest | `tier2-panel-hr` |
| 73 | `/stock-count` | `src/app/(panel)/stock-count/page.tsx` | Physical Stock Count | `tier2-panel-ops` |
| 74 | `/warehouses` | `src/app/(panel)/warehouses/page.tsx` | Warehouses & Locations | `tier2-panel-ops` |
| 75 | `/audit` | `src/app/(panel)/audit/page.tsx` | System Audit Trail | `tier2-panel-hr` |
| 76 | `/ess` | `src/app/ess/page.tsx` | Employee Self-Service Portal | `tier2-panel-hr` |

### 3.3 Tier 3 — Admin, IAM, Org, Settings, Automation, Print Layouts & Public/Auth Routes (33 Routes)

| # | URL Route | Source File (`src/app/...`) | Role / Purpose | Phase B Shard |
| --- | --- | --- | --- | --- |
| 77 | `/erp/admin` | `src/app/erp/admin/page.tsx` | ERP System Administration | `tier3-admin-iam` |
| 78 | `/erp/archive` | `src/app/erp/archive/page.tsx` | Governance Archive | `tier3-admin-iam` |
| 79 | `/erp/iam` | `src/app/erp/iam/page.tsx` | IAM Members & Roles | `tier3-admin-iam` |
| 80 | `/erp/iam/accept` | `src/app/erp/iam/accept/page.tsx` | Invitation Acceptance | `tier3-admin-iam` |
| 81 | `/erp/org` | `src/app/erp/org/page.tsx` | Organization & Branches | `tier3-admin-iam` |
| 82 | `/app-builder` | `src/app/(panel)/app-builder/page.tsx` | Module Enablement Studio | `tier3-settings` |
| 83 | `/automation` | `src/app/(panel)/automation/page.tsx` | Automation Rules | `tier3-settings` |
| 84 | `/automations` | `src/app/(panel)/automations/page.tsx` | Automations Alias | `tier3-settings` |
| 85 | `/crm/quotes/[id]/print` | `src/app/(panel)/crm/quotes/[id]/print/page.tsx` | Printable Quotation Sheet | `tier3-print-public` |
| 86 | `/deploy` | `src/app/(panel)/deploy/page.tsx` | Deployment Status | `tier3-settings` |
| 87 | `/directory` | `src/app/(panel)/directory/page.tsx` | Venture Contact Directory | `tier3-settings` |
| 88 | `/hr/payroll/[id]/print` | `src/app/(panel)/hr/payroll/[id]/print/page.tsx` | Printable Payslip / Payroll | `tier3-print-public` |
| 89 | `/profile` | `src/app/(panel)/profile/page.tsx` | User Profile & Locale | `tier3-settings` |
| 90 | `/purchases/[id]/print` | `src/app/(panel)/purchases/[id]/print/page.tsx` | Printable Purchase Order | `tier3-print-public` |
| 91 | `/roles` | `src/app/(panel)/roles/page.tsx` | RBAC Role Matrix | `tier3-admin-iam` |
| 92 | `/saas` | `src/app/(panel)/saas/page.tsx` | Tenant & Plan Overview | `tier3-settings` |
| 93 | `/sales/[id]/print` | `src/app/(panel)/sales/[id]/print/page.tsx` | Printable Sales Invoice | `tier3-print-public` |
| 94 | `/settings` | `src/app/(panel)/settings/page.tsx` | General Settings | `tier3-settings` |
| 95 | `/settings/aetherbi` | `src/app/(panel)/settings/aetherbi/page.tsx` | AetherBI Preferences | `tier3-settings` |
| 96 | `/settings/aetherbi-connect` | `src/app/(panel)/settings/aetherbi-connect/page.tsx` | Odoo Connector Settings | `tier3-settings` |
| 97 | `/settings/apps` | `src/app/(panel)/settings/apps/page.tsx` | Installed Apps | `tier3-settings` |
| 98 | `/settings/notifications` | `src/app/(panel)/settings/notifications/page.tsx` | Alert Channels | `tier3-settings` |
| 99 | `/settings/odoo-data-center` | `src/app/(panel)/settings/odoo-data-center/page.tsx` | Odoo Data Center | `tier3-settings` |
| 100 | `/settings/odoo-sync` | `src/app/(panel)/settings/odoo-sync/page.tsx` | Panel Odoo Sync | `tier3-settings` |
| 101 | `/settings/payments` | `src/app/(panel)/settings/payments/page.tsx` | Payment Gateways | `tier3-settings` |
| 102 | `/users` | `src/app/(panel)/users/page.tsx` | Panel Users Admin | `tier3-admin-iam` |
| 103 | `/` | `src/app/page.tsx` | Root Entry / Redirect | `tier3-print-public` |
| 104 | `/home` | `src/app/home/page.tsx` | Landing / Home Redirect | `tier3-print-public` |
| 105 | `/login` | `src/app/login/page.tsx` | Authentication Screen | `tier3-print-public` |
| 106 | `/download` | `src/app/download/page.tsx` | Desktop / PWA Download | `tier3-print-public` |
| 107 | `/pay/[token]` | `src/app/pay/[token]/page.tsx` | Customer Payment Link | `tier3-print-public` |
| 108 | `/admin` | `src/app/admin/page.tsx` | Platform Admin Console | `tier3-admin-iam` |
| 109 | `/admin/ai-runs` | `src/app/admin/ai-runs/page.tsx` | AI Run Telemetry Log | `tier3-admin-iam` |

---

## 4. Swarm Worker Disjoint File Ownership Plan

**Golden Concurrency Rule:** No two active workers ever own the same file or directory in the same wave. Only the wave's verification gate runs `npm.cmd run build` (so `.next` is never contended). Every commit passes through `reviewer-carbon` (read-only forensic review) before `git commit` and milestone `git push origin fix/aetherbi-followup-2026-11-16`.

### Wave 1 — Phase A Completion & `docs/phases/phase-14-checklist.md`
- **`phase-a-carbon` (Gemini 4 Carbon High):**
  - **Exclusive Ownership:** `src/lib/odoo-live-connector.ts`, `src/lib/odoo/live-sync-core.ts`, `src/lib/aether/global-filter-engine.ts`, `src/lib/aether/cores-hub-engine.ts`, `src/components/erp/SalesScorecardStudio.tsx`, `src/components/erp/ExecutivePnlStudio.tsx`, `src/components/erp/ReceivablesAgingStudio.tsx`, `src/components/accounting/VentureAccountingHub.tsx`, `src/components/aether/FullJourney360.tsx`, `src/components/aether/CoresHubStudio.tsx`, `scripts/sync-odoo-live.mjs`, `scripts/odoo-journey-extract.mjs`, `src/lib/__tests__/phase-14-partial-and-batch.test.ts`, `docs/phases/phase-14-checklist.md`.
  - **Deliverable:** Write RED tests first for Gaps `A1`–`A6`, implement minimal fixes so zero failed sections or `AccessError` paths ever emit `0` or force-allocate to `'dine-in'` / `'china-garden'`, update `docs/phases/phase-14-checklist.md`, pass `tsc` + `vitest` + `build`, and hand off to `@reviewer-carbon` -> commit & milestone push #1.

### Wave 2 — Design System Foundation (Single-Owner Token/Primitive Pass + Formatter Tests)
- **`design-system-hydrogen` (Hydrogen XHigh — UI Tokens, Typography & Shared Primitives):**
  - **Exclusive Ownership:** `src/app/globals.css`, `tailwind.config.js`, `src/components/ui/kpi-card.tsx` (`KpiCard`), `src/components/ui/section-card.tsx` (`SectionCard`), `src/components/ui/chart-card.tsx` (`ChartCard`), `src/components/ui/data-table.tsx` (`DataTable`), `src/components/ui/state-block.tsx` (`StateBlock` — loading, empty, unlinked, forbidden, partial, error), `src/components/ui/partial-warning-banner.tsx` (`PartialWarningBanner`, re-exporting/wrapping `OdooPartialWarningBanner` while preserving `data-odoo-partial-warning="true"`), `src/components/ui/index.ts`.
  - **Scope:** Establish crisp Obsidian-Emerald dark (`#090E0C` / `#101815`) and neutral light (`#F7F7F8` / `#FFFFFF`) tokens, `tabular-nums` (`dir="ltr"` numeric islands in RTL), accessible contrast, focus rings, and zero layout-jank skeletons without breaking existing callers of `src/components/ui/data-table.tsx` or `stat-card.tsx`.
- **`formatters-carbon` (Gemini 4 Carbon High — Canonical Formatters & Unit Tests):**
  - **Exclusive Ownership:** `src/lib/format.ts`, `src/lib/format-kwd.ts`, `src/lib/__tests__/format.test.ts`.
  - **Scope:** Add canonical, backwards-compatible `formatKwd(val, opts)`, `formatInt(val, opts)`, `formatPct(val, opts)`, and `Asia/Kuwait` date/time formatters to `src/lib/format.ts` (returning `"غير متاح"` / `"—"` on `null | undefined | NaN`, preserving 3-decimal fils precision `0.000` and negative signs `-20.000`, keeping existing `formatMoney`/`formatQty`/`formatDate`/`round2`/`round3` exports intact) + exhaustive unit tests in `src/lib/__tests__/format.test.ts`.
- **Gate:** `reviewer-carbon` review -> `tsc` + `vitest` + `build` -> commit & milestone push #2.

### Wave 3A — Phase B Tier 1 Audit & Polish + Parameterized Canteen/Exclusion Verification
Executed in parallel across strictly disjoint directories:
- **`tier1-overview-ui` (Hydrogen XHigh):** `src/app/erp/page.tsx`, `src/app/erp/layout.tsx`, `src/components/aether/FullJourney360.tsx`, `src/components/aether/TopFilterBar.tsx`, `src/components/aether/OdooSyncPill.tsx`, `src/app/(panel)/dashboard/**`, `src/components/dashboard/**`.
- **`tier1-cores-ui` (Hydrogen XHigh):** `src/app/erp/cores/**`, `src/app/erp/sales-analysis/**`, `src/app/erp/menu-engineering/**`, `src/app/erp/brand-sales-analytics/**`, `src/components/aether/CoresHubStudio.tsx`, `src/components/aether/InteractiveHoverCharts.tsx`, `src/modules/brand-sales-analytics/**`.
- **`tier1-delivery-comp-ui` (Hydrogen XHigh):** `src/app/erp/aggregator-radar/**`, `src/app/erp/before-after/**`, `src/app/erp/weekday-comparison/**`, `src/components/aether/DeliveryRadarV5.tsx`, `src/components/aether/BeforeAfterStudio.tsx`, `src/components/erp/ops-expansion/WeekdayComparisonStudio.tsx`, `src/components/erp/ExecutiveComparisonControlBar.tsx`.
- **`tier1-finance-ops-ui` (Hydrogen XHigh):** `src/app/erp/sales-scorecard/**`, `src/app/erp/executive-pnl/**`, `src/app/erp/finance/**`, `src/app/erp/ledger/**`, `src/app/erp/receivables/**`, `src/app/erp/cost-intelligence/**`, `src/app/erp/warehouse-chain/**`, `src/app/erp/prep-sla/**`, `src/app/erp/delivery-sla/**`, `src/app/erp/odoo-sync/**`, `src/components/erp/SalesScorecardStudio.tsx`, `src/components/erp/ExecutivePnlStudio.tsx`, `src/components/erp/ReceivablesAgingStudio.tsx`, `src/components/erp/WarehouseDailyChainStudio.tsx`, `src/components/aether/CostIntelligenceV2.tsx`, `src/components/accounting/**`, `src/modules/finance/ui/**`, `src/modules/odoo/ui/**`.
- **`tier1-ai-gov-ui` (Hydrogen XHigh):** `src/app/erp/feryal-ai/**`, `src/app/erp/feryal/**`, `src/app/erp/ai-brief/**`, `src/app/erp/alerts/**`, `src/app/erp/governance/**`, `src/components/erp/feryal-governance-studio.tsx`, `src/components/erp/GovernanceBellDrawer.tsx` (preserving PIN gate, auditor read-only guards, and Feryal 2-of-3 consensus badges).
- **`canteen-exclusions-carbon` (Gemini 4 Carbon High — Data & Parameterized Matrix Tests):**
  - **Exclusive Ownership:** `src/lib/__tests__/overnight-canteens-exclusions-matrix.test.ts`, `src/lib/__tests__/tier1-data-contracts.test.ts`.
  - **Scope (Read-Only on Protected Modules):** Parameterized verification across all 7 active restaurant branches (`promenade`, `360-mall`, `ardiya`, `assima`, `salmiya`, `al-kout`, `avenues`), pinned school canteens (`41` NPIS Hawally, `42` FAIPS Ahmadi -> `school-canteens` included when active and free of Heisenberg/Qurain/Jahra veto tokens; archived `#16` & `#35` excluded under active-only policy), and strict exclusions (`Heisenberg` + typos + Arabic `هايزنبرغ`/`هايزن` + POS category `150`, `Qurain`/`قرين`/`QRN`, `Jahra`/`الجهراء`/`JHR`, closed `Hawally` restaurant vs NPIS Hawally school canteen exemption) across live snapshot, period cube, comparison engine, reports registry, and Feryal context.
- **Gate:** `reviewer-carbon` review -> `tsc` + `vitest` + `build` -> commit & milestone push #3.

### Wave 3B — Phase B Tier 2 Audit & Polish (52 Operational Routes)
- **`tier2-erp-intel-comm` (Hydrogen XHigh):** `src/app/erp/{ai,booth-feasibility,competitors,crm,delivery,delivery-control,demand-forecast,events-intelligence,events-projects,intelligence,market,marketing,planning,projects,sales-crm,smart-dropzone,social-reviews}/**`, `src/components/events/**`, `src/components/radar/**`, `src/components/SmartDropzonePortal.tsx`.
- **`tier2-erp-ops` (Hydrogen XHigh):** `src/app/erp/{compliance,contracts,food-safety,hr,inventory,kds,kitchen,operations,procurement,recipes,regulations}/**`, `src/modules/{procurement,inventory,kitchen,operations}/ui/**`.
- **`tier2-panel-fin-ops` (Hydrogen XHigh):** `src/app/(panel)/{accounting,bi-analytics,central-kitchen,crm,delivery-hub,inventory,payments,purchases,recipes,reports,sales,stock-count,warehouses}/**`, `src/app/(kds)/**`, `src/app/(pos)/**`, `src/components/{crm,kds,pos,purchases,recipes,reports,sales,warehouses}/**`.
- **`tier2-panel-hr-ess` (Hydrogen XHigh):** `src/app/(panel)/{hr,smart-ingest,audit}/**`, `src/app/ess/**`, `src/components/hr/**`, `src/components/hr-digital-dossier.tsx`, `src/components/hr-wps-toolbar.tsx`, `src/components/SmartDepartmentFolderUpload.tsx`.
- **`tier2-data-carbon` (Gemini 4 Carbon High):** `src/lib/__tests__/tier2-routes-states.test.ts` (verifies honest empty/unlinked states, RBAC/auditor read-only enforcement, and zero invented fallback figures across Tier 2 engines/APIs).
- **Gate:** `reviewer-carbon` review -> `tsc` + `vitest` + `build` -> commit & milestone push #4.

### Wave 3C — Phase B Tier 3 Audit & Polish (33 Admin, IAM, Settings, Print & Public Routes)
- **`tier3-admin-settings-ui` (Hydrogen XHigh):** `src/app/erp/{admin,archive,iam,org}/**`, `src/app/admin/**`, `src/app/(panel)/{app-builder,automation,automations,deploy,directory,profile,roles,saas,settings,users}/**`, `src/components/automation/**`, `src/components/Settings.tsx`.
- **`tier3-print-public-ui` (Hydrogen XHigh):** `src/app/{page.tsx,home,login,download,pay}/**`, `src/app/(panel)/crm/quotes/[id]/print/**`, `src/app/(panel)/hr/payroll/[id]/print/**`, `src/app/(panel)/purchases/[id]/print/**`, `src/app/(panel)/sales/[id]/print/**`, `src/components/{invoice-sheet.tsx,print-button.tsx,statement-view.tsx}`.
- **Gate:** `reviewer-carbon` review -> `tsc` + `vitest` + `build` -> commit & milestone push #5.

### Wave 4 — Phase C Deep Quality Pass & Final Deliverable (`docs/phases/overnight-report.md`)
- **`phase-c-carbon` (Gemini 4 Carbon High):**
  - Dead code, orphaned imports, and stray `console.log` audit across `src/`.
  - Canonical `formatKwd` / `formatInt` / `formatPct` adoption check and strict nullable TypeScript narrowing (`no explicit any` / zero unsafe `?? 0` on nullable Odoo metrics).
  - `Asia/Kuwait` (`UTC+3`) calendar-day boundary audit (`kuwaitDateBoundsToOdooUtc`, `21:00:00Z` prior UTC day) across live queries, date pickers, and formatters.
  - Bilingual AR/EN (`rtl`/`ltr`) dictionary parity check (`src/lib/i18n.tsx`) and zero raw translation keys.
  - Resolve the 3 `@next/next/no-img-element` warnings so `npm.cmd run lint` and `npm.cmd run build` pass with **zero** warnings and **zero** errors.
  - Run `scripts/verify-brain-integrity.mjs` (if applicable), `npx.cmd tsc --noEmit`, `npx.cmd vitest run`, temp-file and `prisma/dev.db` cleanliness checks, and `npm.cmd run build`.
  - Write comprehensive `docs/phases/overnight-report.md`.
- **Final Gate:** `reviewer-carbon` full-branch audit (`b548541..HEAD`) -> final commit & push to `origin fix/aetherbi-followup-2026-11-16`.

---

## 5. Protected Modules & Invariants (DO NOT BREAK OR WEAKEN)

Workers **MUST NOT** modify or weaken any of the following modules or invariants without explicit coordinator escalation:

1. **School Canteen Rule & Active-Only Register Allow-List:** `src/lib/odoo/company-pos.ts` (`schoolCanteenRegisterIds` = `[41, 42]`, `ARCHIVED_PINNED_REGISTER_POLICY = 'active_only_todo_abdullah'` keeping `#16` and `#35` active-only, `posOrderCount` `RangeError` guard on `count > 1`, `posOrderNet` signed refund arithmetic).
2. **Entity Exclusion Engine:** `src/lib/odoo/excluded-entities.ts` (`ODOO_EXCLUSION_RULES`, `isExcludedOdooEntity`, `appendOdooNameExclusion`, `stripExcludedOdooTree`, `hasClosedBranchCanteenExemption`).
3. **Canonical POS Registry & Order Query Builder:** `src/lib/odoo/pos-registry.json` and `src/lib/odoo/pos-order-query.ts` (`kuwaitDateBoundsToOdooUtc`, `buildPosOrderKpiDomain`, `describePosOrderQuery`, `mergeDaySessionPricelistGroups`, `mergeHourGroups`, `mergeSessionGroups`, `mergeSessionPaymentGroups`).
4. **Odoo Console Domain Extractor:** `src/modules/odoo/domain/console.ts`.
5. **AI Structured Claim Verifier & Feryal 2-of-3 Consensus:** `src/server/ai/structured-claim.ts` (`comparisonMatchesFacts`), `src/lib/feryal-council-facts.ts`, `src/lib/dual-heavy-brain.ts`.
6. **Governance PIN Bootstrap & Verification:** `src/lib/governance-pin.ts` and `src/app/api/erp/governance/route.ts`.
7. **Database & Vitest Ephemeral Isolation:** `src/lib/db.ts`, `vitest.config.mts`, `src/lib/__tests__/support/vitest-global-setup.ts`, `prisma/dev.db` (never touch, never seed), and `/tmp` (`C:\tmp` + `os.tmpdir()`) cleanup.
8. **Phase 13 Atomic `(net, nonRefundCount)` Pairings & Existing Test Suite:** Never unwrap or split `Promise.all([netQuery, countQuery])` units in `odoo-live-connector.ts` / `live-sync-core.ts`, and never weaken or delete any existing test assertion across `**/__tests__/**`.
9. **Large-File & Secret Safety:** Never read `src/lib/full-journey-enterprise-brain.ts` end-to-end; never log or commit `.env*`, `ODOO_*`, API keys, PINs, or raw Odoo error payloads.

---

## 6. Risk Register

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Stale `@prisma/client` types in fresh worktrees (`aiRun` / `aiDailyBrief` missing) | High (observed on cold checkout) | Medium | Run `npx.cmd prisma generate` (read-only client codegen; touches `node_modules/.prisma`, never `prisma/dev.db`) before standalone `npx.cmd tsc --noEmit`. |
| Windows PowerShell `.ps1` execution policy blocks `npx` / `npm` | High | Low | Strictly invoke `npx.cmd` and `npm.cmd` after `Set-Location 'F:\restaurant-ai-hq-complete\restaurant-ai-hq-complete\restaurant-ai-hqw'`. |
| Concurrent `next build` corrupts `.next` trace files | High if parallelized | High | Individual workers run only `npx.cmd tsc --noEmit` and targeted `npx.cmd vitest run <file>`; full `npm.cmd run build` runs strictly once per wave at the gate. |
| Nullable Odoo figure (`null` / `undefined`) coerced via `Number(x) \|\| 0`, `safeNum(x)`, or `x ?? 0` in UI/charts | Medium | Critical (Blocker N2 violation) | Enforce strict `number \| null` propagation into `formatKwd` / `formatInt` / `formatPct` and exclude `null` points from chart series/denominators rather than plotting `0`. |
| RTL/LTR bidi mangling of negative KWD (`-20.000`) or date ranges (`2026-10-16 → 2026-11-15`) | Medium | Medium | Wrap formatted numeric/currency/date tokens in `dir="ltr"` + `tabular-nums` spans inside Arabic (`dir="rtl"`) containers. |
| Accidental write to `prisma/dev.db` or leftover `aetherbi-vitest-*` / `vf-vitest-run-*` temp directories | Low | High | Verify `git diff prisma/dev.db` is empty and temp directories have `0` leftovers at every wave gate before committing. |

---

## 7. Open `TODO(Abdullah)` Tracker (Preserved — Do Not Guess Business Policy)

All open business-policy questions remain explicitly tracked for Abdullah without inventing IDs or altering accepted rules:

1. **Archived Pinned Registers `#16` & `#35` (`src/lib/odoo/company-pos.ts:12`):** Confirm whether archived pinned registers `#16 E-Mall (Promenade)` and `#35 Delivery (Ardiya Temp)` should remain active-only (`ARCHIVED_PINNED_REGISTER_POLICY = 'active_only_todo_abdullah'`) or include historical orders.
2. **Pinned School Canteen `pos.config` IDs (`src/lib/odoo/pos-registry.json:3`, `src/lib/odoo/company-pos.ts:20-21`):** Supply/confirm the verified real Odoo `pos.config` IDs for `NPIS` (currently pinned `41`) and `FAIPS` (currently pinned `42`), and confirm whether `pos.config` `43` (`FAS Fahaheel`) is a school canteen.
3. **Closed-Hawally Canteen-Over-Restaurant Precedence (`docs/phases/phase-13-checklist.md:33`):** Confirm whether a non-NPIS label combining `"Hawally"` + `"Restaurant"` + `"Canteen"` (`"Hawally Restaurant Canteen"`) should remain kept as a canteen record or require an explicit school code (`NPIS` / `FAIPS` / `FAS`).
4. **GL Account `#2839` (`src/lib/__tests__/phase-12-exclusions.test.ts:74`, `src/lib/__tests__/phase-9-company-pos.test.ts:43`):** Confirm whether GL account `#2839` (`Cash On Hand/ NPIS Hawally Branch Cashier - فرع حولي - NPIS`) belongs to active school-canteen accounting.
5. **Batch Sync (`scripts/sync-odoo-live.mjs`) Semantic Alignment with Live Connector (`docs/phases/phase-14-checklist.md:57-60`):**
   - **5a (Refund order counts, `sync-odoo-live.mjs:277, 1065`):** Batch sync sums `__count` across all orders including refunds (`amount_total < 0`), whereas live connector counts non-refund orders (`['amount_total', '>=', 0]`). Confirm whether batch sync should switch to non-refund order counts.
   - **5b (Negative net clamp, `sync-odoo-live.mjs:964-993, 1064, 1087`):** Batch sync clamps negative net amounts via `Math.max(0, ...)`, whereas live connector preserves signed negative KWD. Confirm whether batch sync should remove the clamp.
   - **5c (UTC midnight vs. Kuwait midnight, `sync-odoo-live.mjs:246-256, 999-1010`):** Batch sync queries `pos.order.date_order` with naive `${from} 00:00:00` UTC, whereas live connector converts `Asia/Kuwait` (`UTC+3`) calendar day bounds (`21:00:00` prior UTC day). Confirm whether batch sync should switch to Kuwait midnight bounds.
