# AetherBI — Redo Phase 1 Checklist (`docs/redo/phase-1-checklist.md`)

- **Branch**: `feat/aetherbi-redo-2026-11-18` (based on `origin/claude/aetherbi-phase-5-integration` @ `e67c1a7`)
- **Author**: `Abdullah Awirah <werech21-lab@users.noreply.github.com>`
- **Hard Owner Rules Verified**:
  - Zero invented numbers and zero hand-typed KWD literals in any new or edited test/fixture.
  - Missing inputs render «غير متاح» / «Not available» / `—` (never `0.000`).
  - `prisma/dev.db` and `.env*` untouched; zero password, key, PIN, role, or permission rule changes.
  - All Odoo RPC scripts strictly read-only (`fields_get`, `search_count`, `search_read`, `read_group`, `read`).

---

## 1. Item-by-Item Traceability (`Item → file:line → Proving Test Name`)

### Item 1.1 — Arabic Custom-Range Ledger & Shared Bucket Resolver (`C1`)

| File & Exact Lines | Responsibility | Proving Test File & Exact Test Name(s) |
|---|---|---|
| `src/lib/aether/global-filter-engine.ts:225-247, 258-337, 344-357` | `resolveSummaryLatestCoveredDay`, sparse-day-safe `deriveCustomBucketFromDaily` (covers `[fromIso..toInclusiveIso]` inside `[days[0], latestCoveredDay]` even when boundary days had `0` POS orders), and shared `resolveSummaryBucket` | `src/lib/__tests__/redo-phase-1/scorecard-and-bucket.test.ts:221` — `sums [fromIso..toInclusiveIso] when start and/or end day had 0 POS orders (absent keys in dailyByBranch) inside covered history` |
| `src/lib/aether/global-filter-engine.ts:1533, 1639-1643, 2135` | Shared `resolveSummaryBucket` in `computeGlobalWorkspace` + unclamped signed `finalSalesKwd` | `src/lib/__tests__/phase-5/custom-range-ledger-parity.test.ts:150` — `the payload has no customBucket for the range, so the bucket is derived from its real daily rows`<br>`src/lib/__tests__/phase-5/custom-range-ledger-parity.test.ts:160` — `%s: ledger rows sum exactly to the headline and every branch shows its order count`<br>`src/lib/__tests__/phase-5/custom-range-ledger-parity.test.ts:178` — `Arabic and English ledgers are identical (same rows, same sales, same orders)`<br>`src/lib/__tests__/phase-5/custom-range-ledger-parity.test.ts:189` — `booth-enabled real-structure payload: shows «بوثات المعارض» / Exhibition Booths, AR row set == EN row set, Σrows = headline ±0.001, and no «—» where orders > 0` |
| `src/lib/aether/cores-hub-engine.ts:679, 781-785, 846-854, 935-937` | Unifies Cores `selectedBucket` and `activeBucket` on `resolveSummaryBucket` | `src/lib/__tests__/redo-phase-1/negative-refund-unclamped.test.ts:260` — `2. cores-hub-engine resolves custom-range bucket via resolveSummaryBucket (1.1) and reconciles negative refund hour in periodHourly` |
| `src/components/aether/GlobalFilterContext.tsx:11, 81-132` | Exports `sanitizeFilters` and validates `branch` against `DASHBOARD_BRANCH_CARD_IDS` (`exhibitions` & `school-canteens` preserved in URL/storage) | `src/lib/__tests__/redo-phase-1/scorecard-and-bucket.test.ts:288` — `preserves branch=exhibitions and branch=school-canteens in GlobalFilterContext sanitizeFilters` |
| `src/components/aether/DeliveryRadarV5.tsx:19, 234-237`<br>`src/components/erp/feryal-governance-studio.tsx:31, 874-875`<br>`src/lib/reports/enterprise-reports-registry.ts:9, 97-101`<br>`src/modules/brand-sales-analytics/ui/BrandSalesAnalyticsDashboard.tsx:14, 137-140` | Replaces all remaining direct `liveSummary.customBucket` reads with `resolveSummaryBucket` | `src/lib/__tests__/redo-phase-1/scorecard-and-bucket.test.ts:269` — `unifies enterprise-reports-registry custom bucket resolution via resolveSummaryBucket (never leaking month totals)`<br>`src/lib/__tests__/redo-phase-1/scorecard-and-bucket.test.ts:303` — `replaces all direct liveSummary.customBucket reads in DeliveryRadarV5, feryal-governance-studio, enterprise-reports-registry & BrandSalesAnalyticsDashboard with resolveSummaryBucket` |

---

### Item 1.2 — Scorecard Custom Range Parity & Loading Skeleton (`C2`)

| File & Exact Lines | Responsibility | Proving Test File & Exact Test Name(s) |
|---|---|---|
| `src/components/aether/GlobalFilterContext.tsx:65, 153, 284-348, 365-368, 602, 622, 651` | Exposes `loadingSummary` (`true` on initial mount before first `pullSilentStatus()` settles and while uncached custom sync is in flight) | `src/lib/__tests__/redo-phase-1/scorecard-and-bucket.test.ts:322` — `renders loading skeleton when loadingSummary=true and liveSummary=null (never Odoo unavailable + 0.000)` |
| `src/lib/aether/global-filter-engine.ts:1647-1662, 1909-1962` | Marks totals, brands, branches, and channels unavailable (`غير متاح` / `—`, never `0.000`) when custom range has no active bucket | `src/lib/__tests__/redo-phase-1/scorecard-and-bucket.test.ts:362` — `marks totals, brands, branches and channels unavailable (غير متاح / —, never 0.000) when custom range has no active bucket` |
| `src/components/erp/SalesScorecardStudio.tsx:49, 65-156, 170-208, 258, 464-516` | Loading skeleton (`data-state-block="loading"`), calm unavailable early return (zero `0.000` underneath), `resolveSummaryBucket`, per-branch order counts, and `unattributed` row parity with Home | `src/lib/__tests__/redo-phase-1/scorecard-and-bucket.test.ts:348` — `renders calm unavailable StateBlock and returns early when !liveSummary or !odooConnected (zero 0.000 cards/rows underneath)`<br>`src/lib/__tests__/redo-phase-1/scorecard-and-bucket.test.ts:392` — `%s: Custom 2026-11-01..2026-11-17 on loadLiveTodaySummary() matches Home headline & branch rows, Σrows = headline ±0.001, no — where orders > 0, and zero 0.000`<br>`src/lib/__tests__/redo-phase-1/scorecard-and-bucket.test.ts:430` — `AR and EN Scorecard branch rows & totals match Home identically on booth+canteen real-day payload (incl. بوثات المعارض & مقاصف المدارس, zero 0.000)` |

---

### Item 1.3 — Hawally Name Exclusion Removed (`C4`)

| File & Exact Lines | Responsibility | Proving Test File & Exact Test Name(s) |
|---|---|---|
| `src/lib/odoo/excluded-entities.ts:30-35, 174-181, 348-354` | Explicit `pos_config: [24, 25, 39, 40]` rule; zero `haw*`/`حولي`/`hwl` rules; dead closed-branch exemption helper removed while Jahra rules remain active | `src/lib/__tests__/phase-5/hawally-not-excluded.test.ts:30` — `Promenade shop configs 8–11 are accepted with English "Hawally" and Arabic «حولي» in register names and stock context`<br>`src/lib/__tests__/phase-5/hawally-not-excluded.test.ts:56` — `NPIS Hawally school canteen (41) is accepted with English "Hawally" and Arabic «حولي»`<br>`src/lib/__tests__/phase-5/hawally-not-excluded.test.ts:70` — `analytic accounts and Odoo search domains do not exclude Hawally / «حولي»`<br>`src/lib/__tests__/phase-5/hawally-not-excluded.test.ts:118` — `explicit id exclusions: 24, 25, 39, 40 remain strictly excluded`<br>`src/lib/__tests__/phase-5/hawally-not-excluded.test.ts:128` — `Jahra is still rejected by name across POS, analytic, and stock locations` |
| `src/lib/odoo-live-connector.ts:5464-5513` | Exports `resolveStockLocationRole`; routes Hawally/`حولي` stock locations to `school-canteens` (`#41` NPIS) or `promenade` (never `ck` or excluded) | `src/lib/__tests__/phase-5/hawally-not-excluded.test.ts:91` — `stock locations referencing Hawally / «حولي» map to promenade or school-canteens (never ck or excluded)` |
| `scripts/verify-brain-integrity.mjs:155-156, 196-205, 245-248`<br>`src/lib/__tests__/zero-invented-data-acceptance.test.ts:500-505` | Runtime integrity check proving `pos_config [24, 25, 39, 40]` & Jahra excluded while Promenade (`8–11`) & NPIS Hawally (`41`) accepted | `src/lib/__tests__/zero-invented-data-acceptance.test.ts:469` — `contains zero Math.random, faker, mock/seed production data generators, OdooAuditCertificate, فارق 0.000, or Hawally UI strings while preserving server-side Odoo exclusion filters` |

---

### Item 1.4 — Qurain Central Kitchen Stock/Transfers (`C5`) & Double-Count Audit Prep (`C3`)

*(Per Master Prompt line 83: because live `.env.local` POS double-count audit has not yet been executed on the owner's Mac, Qurain POS sales remain honestly «غير متاح» while Qurain Central Kitchen warehouse stock & transfers (`C5`), `EXB = Exhibition Booths (never a kitchen)`, and the read-only Mac audit script are complete.)*

| File & Exact Lines | Responsibility | Proving Test File & Exact Test Name(s) |
|---|---|---|
| `src/lib/odoo-live-connector.ts:916-961, 2448-2475, 5491-5500` | Rewrites `DECOMMISSIONED_SITE_RE` & `isDecommissionedWarehouseRecord` to match ONLY Jahra & Heisenberg; makes `'QRN/Stock'` & Qurain `stock.picking` transfers visible as «القرين (المطبخ المركزي)» / `Qurain (Central Kitchen)`; fixes wrong `Ardiya Central Kitchen (EXB/CK)` comment; maps `EXB` to `EXHIBITION_BRANCH_ID` (never `'ck'`) | `src/lib/__tests__/redo-phase-1/qurain-c5.test.ts:68` — `un-decommissions QRN/Qurain/«القرين» on warehouse paths (role: ck) while keeping Jahra & Heisenberg decommissioned`<br>`src/lib/__tests__/redo-phase-1/qurain-c5.test.ts:126` — `surfaces real QRN/Stock quants from venturefoods_odoo_cids1_dump.json in fetchLiveOdooWarehouseChain & Qurain stockTransfers`<br>`src/lib/__tests__/tier2-routes-states.test.ts:790` — `filters excluded entities & croissant/avocado out of live Odoo inventory (warehouse-chain) & procurement (purchase-orders) while preserving NPIS #41 & FAIPS #42 canteens` |
| `src/lib/aether/planning-engine.ts:165-170`<br>`src/app/api/erp/role-directory/route.ts:93-95, 126-128`<br>`src/lib/auth/role-access-policy.ts:106` | Eliminates all remaining `EXB = Central Kitchen` mislabels (`EXB` -> «بوثات المعارض» / `Exhibition Booths`) | `src/lib/__tests__/redo-phase-1/qurain-c5.test.ts:96` — `maps EXB to Exhibition Booths (never ck / kitchen) across stock locations, transfer fallbacks, planning copy & role docs` |
| `src/lib/odoo-live-connector.ts:994, 1817, 1838, 1852, 2550, 2574, 4487, 4501, 4694, 6418, 6471, 6690` | Keeps Qurain POS/GL/PO excluded & Feryal «كم مبيعات القرين هالشهر؟» returning «غير متاح» (never `0.000`) until the owner's Mac audit runs | `src/lib/__tests__/redo-phase-1/qurain-c5.test.ts:266` — `keeps Qurain POS sales excluded / «غير متاح» per Master Prompt line 83 until the owner runs the Mac audit` |
| `scripts/audit-qurain-double-count.mjs:31-265` | Read-only Qurain double-count audit with SHA-256 partner PII redaction, FAS/EXB internal site detection, and `customer.{orderIds, orders, byDay, byConfig}` + `companyComparison` + `integrity` | `src/lib/__tests__/redo-phase-1/qurain-c5.test.ts:284` — `hardens audit-qurain-double-count: redacts PII, recognizes FAS/EXB internal sites, retains customer orderIds/byDay/byConfig, and verifies Σbranches + Qurain == headline` |

---

### Item 1.5 — Reconcile 1–17 Nov vs Owner Reference `66,487.04 KWD` (`C7`)

| File & Exact Lines | Responsibility | Proving Test File & Exact Test Name(s) |
|---|---|---|
| `scripts/lib/pos-variance-lib.mjs:48-262, 302-357`<br>`scripts/audit-pos-variance.mjs:50-231`<br>`docs/redo/reconciliation-1-17-nov.md:1-73` | Reads `pos.config` with `context: { active_test: false }`, separates `archived-whitelisted` (`#16`, `#35`) from `active-restaurant`, surfaces `#36` (`unknown-unmapped`), booths (`26–33, 37, 38`), canteens (`41–43`), and explicit excluded (`24, 25, 39, 40`), and writes `docs/redo/reconciliation-1-17-nov.md` without changing totals | `src/lib/__tests__/redo-phase-1/reconcile-1-17-nov.test.ts:33` — `separates archived #16/#35 from active restaurants, surfaces unknown #36, booths, canteens, excluded [24,25,39,40], and renders redo reconciliation doc`<br>`src/lib/__tests__/phase-5/pos-variance-audit.test.ts:20` — `separates exhibition booths and flags the basis gap that explains the target variance` |
| `scripts/run-mac-readonly-probes.mjs:31-45, 99-330` | Unified read-only Mac probe runner (`fields_get`, `search_count`, `search_read`, `read_group`, `read` ONLY; automatic secret/URL redaction) | `src/lib/__tests__/redo-phase-1/reconcile-1-17-nov.test.ts:129` — `enforces strictly read-only Odoo RPC methods in run-mac-readonly-probes.mjs` |

---

### Item 1.6 — Negative Refund Clamp Removal (`U7`)

| File & Exact Lines | Responsibility | Proving Test File & Exact Test Name(s) |
|---|---|---|
| `src/lib/aether/cores-hub-engine.ts:311-314, 437, 447` | Removes `Math.max(0, ...)` on `salesKwd` in `toSalesPoint` and normalizes `-0` -> `0` so negative refund hours/days pass through signed and `Σ(hourly) === periodTotal` | `src/lib/__tests__/redo-phase-1/negative-refund-unclamped.test.ts:207` — `1. computeCoresHubSnapshot & CoresHubStudio keep a real negated refund hour negative and Σ(hourly) === periodTotal within ±0.001 (AR + EN)` |
| `src/components/aether/FullJourney360.tsx:416, 424, 512-517, 608, 700-727` | Removes `Math.max(0, ...)` clamps on `workspace.unattributedSalesKwd`, `unattributedOrders`, `comboData`, `comboHourlyFallback`, and `weeklyPills` | `src/lib/__tests__/redo-phase-1/negative-refund-unclamped.test.ts:313` — `3. FullJourney360 renders 1-day timeline with negative refund hour via comboHourlyFallback -> TimelineAreaChart without clamping or SVG NaN`<br>`src/lib/__tests__/redo-phase-1/negative-refund-unclamped.test.ts:350` — `4. FullJourney360 preserves negative unattributedSalesKwd, negative daily comboData, and negative weeklyPills with Σ(branchCards) === headline` |
| `src/components/charts/v35-chart-theme.ts:146-156`<br>`src/components/charts/v35-chart-kit.tsx:303-383, 696-703, 737, 800-822, 1051-1068, 1130, 1188-1234, 1357, 1732, 2280-2283, 2326, 2397-2427` | Signed `formatCompactKwdTick`, signed `safeFinite`, `resolveSignedAxisBounds` (`['auto', 'auto']` / `['auto', 0]` when `min < 0`), `renderSignedBarShape` (positive `Math.abs(height)` anchored at `y + height`), while keeping `safeNonNegative` on proportional `V35DonutChart` & `StackedProgressBar` | `src/lib/__tests__/redo-phase-1/negative-refund-unclamped.test.ts:444` — `5. v35-chart-kit SalesNetComposedChart, ComparisonBarChart, TimelineAreaChart, and renderSignedBarShape handle negative values cleanly while V35DonutChart & StackedProgressBar keep proportional safety`<br>`src/lib/__tests__/redo-phase-1/scorecard-and-bucket.test.ts:246` — `preserves net-negative refund slices in computeGlobalWorkspace without Math.max(0, ...) clamping` |

---

## 2. Owner Mac `.env.local` One-Liner Command (Live Read-Only Captures)

To capture the live Odoo 17 read-only reports on the Mac where `.env.local` holds the real Odoo credentials (without printing or committing any credentials, URLs, or partner PII):

```bash
node scripts/run-mac-readonly-probes.mjs
```

This single command executes ONLY `fields_get | search_count | search_read | read_group | read` and generates:
1. `src/lib/__tests__/fixtures/dashboard-booth-era-live.json` (auto-picked up by `custom-range-ledger-parity.test.ts`)
2. `docs/phase-5/qurain-audit-2026-11-01_2026-11-17.{json,md}` + current calendar month (`qurain-audit-<YYYY-MM-01>_<today>.{json,md}`)
3. `docs/redo/reconciliation-1-17-nov.md` + `docs/phase-5/pos-variance-2026-11-01_2026-11-17.{json,md}`
4. `docs/redo/odoo-model-probe.{md,json}` (for Phase 2.1)

---

## 3. Real Playwright AR + EN (`1440` & `390`) Screenshots & Verified Totals

Generated via `node scripts/capture-phase1-screenshots.mjs` against a real `next start` production server (`docs/redo/screenshots/phase-1/`, 48 PNGs + `manifest.json`):

| Period | Verified Headline (`AR === EN`, `Home === Cores === Scorecard`) | Verified `Σ(rows)` | Files (`docs/redo/screenshots/phase-1/`) |
|---|---:|---:|---|
| **Month** (`2026-10-19..2026-11-17`) | `130,946.856 KWD` (`30,821` orders) | `130,946.856 KWD` | `{erp-home,erp-cores,erp-sales-scorecard}__month__{ar-1440,en-1440,ar-390,en-390}.png` |
| **Today** (`2026-11-17` 06:00 KWT) | `154.700 KWD` (`24` orders) | `154.700 KWD` | `{erp-home,erp-cores,erp-sales-scorecard}__today__{ar-1440,en-1440,ar-390,en-390}.png` |
| **Yesterday** (`2026-11-16`) | `3,629.125 KWD` (`819` orders) | `3,629.125 KWD` | `{erp-home,erp-cores,erp-sales-scorecard}__yesterday__{ar-1440,en-1440,ar-390,en-390}.png` |
| **Custom** (`2026-11-01..2026-11-17`) | `66,116.688 KWD` (`15,063` orders) | `66,116.688 KWD` | `{erp-home,erp-cores,erp-sales-scorecard}__custom-2026-11-01-2026-11-17__{ar-1440,en-1440,ar-390,en-390}.png` |
